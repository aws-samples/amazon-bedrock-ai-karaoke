import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as assets from 'aws-cdk-lib/aws-s3-assets';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as path from 'path';

export class AiKaraokeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, 'Results');
  
    const vocab_filter_name = 'BadWords' + '-' + this.stackName
    const language_code = 'en-US'

    const profanity_list = new assets.Asset(this, 'ProfanityList', {
      path: path.resolve(__dirname, './server/profanity.txt'),
    });

    let resource = new cr.AwsCustomResource(this, 'VocabFilter', {
      onUpdate: { // will also be called for a CREATE event
        service: 'TranscribeService',
        action: 'createVocabularyFilter',
        parameters: {
          VocabularyFilterName: vocab_filter_name,
          LanguageCode: language_code,
          VocabularyFilterFileUri: profanity_list.s3ObjectUrl
        },
        physicalResourceId: cr.PhysicalResourceId.of(vocab_filter_name)
      },
      onDelete: { // will be called for a DELETE event
        service: 'TranscribeService',
        action: 'deleteVocabularyFilter',
        parameters: {
          VocabularyFilterName: vocab_filter_name,
        },
        physicalResourceId: cr.PhysicalResourceId.of(vocab_filter_name)
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });

    profanity_list.grantRead(resource);

    // Create VPC
    const vpc = new ec2.Vpc(this, 'VPC', {
      maxAzs: 1,
      subnetConfiguration: [
        {
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          name: 'EcsAnywhereVpc',
          cidrMask: 24,
        }
      ]
    });

    // Create ECS cluster
    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc
    });

    // Create ExternalTaskDefinition
    const taskDefinition = new ecs.ExternalTaskDefinition(this, 'TaskDef', {
      networkMode: ecs.NetworkMode.HOST
    });

    bucket.grantReadWrite(taskDefinition.taskRole)

    taskDefinition.taskRole.attachInlinePolicy(
      new iam.Policy(this, 'TranscribeStreamingPolicy', {
        statements: [new iam.PolicyStatement({
          actions: [
            'transcribe:StartStreamTranscriptionWebSocket',
            'transcribe:StartStreamTranscription',
          ],
          resources: ['*'],
          effect: iam.Effect.ALLOW,
          }),
    ],
    }));

    taskDefinition.taskRole.attachInlinePolicy(
      new iam.Policy(this, 'BedrockPolicy', {
        statements: [new iam.PolicyStatement({
          actions: [
            'bedrock:InvokeModel',
            'bedrock:InvokeModelWithResponseStream',
            'bedrock:ListFoundationModels'
          ],
          resources: ['*'],
          effect: iam.Effect.ALLOW,
          }),
    ],
    }));

    taskDefinition.addVolume({
      host: {
        sourcePath: '/results',
      },
      name: 'results',
    })

    const myLinuxParams = new ecs.LinuxParameters(this, 'LinuxParams');
    myLinuxParams.addDevices({
      hostPath: '/dev/bus/usb/',
      permissions: [ecs.DevicePermission.READ, ecs.DevicePermission.WRITE, ecs.DevicePermission.MKNOD]
    });
    myLinuxParams.addDevices({
      hostPath: '/dev/snd/',
      permissions: [ecs.DevicePermission.READ, ecs.DevicePermission.WRITE, ecs.DevicePermission.MKNOD]
    });
    myLinuxParams.addDevices({
      hostPath: '/dev/gpio',
      permissions: [ecs.DevicePermission.READ, ecs.DevicePermission.WRITE, ecs.DevicePermission.MKNOD]
    });
    myLinuxParams.addDevices({
      hostPath: '/dev/gpiochip0',
      permissions: [ecs.DevicePermission.READ, ecs.DevicePermission.WRITE, ecs.DevicePermission.MKNOD]
    });
    myLinuxParams.addDevices({
      hostPath: '/dev/gpiomem0',
      permissions: [ecs.DevicePermission.READ, ecs.DevicePermission.WRITE, ecs.DevicePermission.MKNOD]
    });
    myLinuxParams.addDevices({
      hostPath: '/dev/gpiochip4',
      permissions: [ecs.DevicePermission.READ, ecs.DevicePermission.WRITE, ecs.DevicePermission.MKNOD]
    });
    myLinuxParams.addDevices({
      hostPath: '/dev/gpiomem4',
      permissions: [ecs.DevicePermission.READ, ecs.DevicePermission.WRITE, ecs.DevicePermission.MKNOD]
    });

    myLinuxParams.addCapabilities(ecs.Capability.ALL);

    const server = taskDefinition.addContainer('Server', {
      image: ecs.ContainerImage.fromAsset(path.resolve(__dirname,'./server')),
      memoryReservationMiB: 1024,
      logging: new ecs.AwsLogDriver({ streamPrefix: 'server', mode: ecs.AwsLogDriverMode.NON_BLOCKING }),
      environment: {
        LANGUAGE_CODE: language_code,
        VOCAB_FILTER_NAME: vocab_filter_name,
        VOCAB_FILTER_METHOD: 'mask', // remove | mask | tag
        BUCKET_NAME: bucket.bucketName,
        AWS_DEFAULT_REGION: this.region,
      },
      privileged: true,
      linuxParameters : myLinuxParams,
      containerName : 'Server',
      essential: true,
      command: ['/bin/bash', '-c', 'python3 -u server.py']
    })

    const client = taskDefinition.addContainer('Client', {
      image: ecs.ContainerImage.fromAsset(path.resolve(__dirname, './client')),
      memoryReservationMiB: 1024,
      logging: new ecs.AwsLogDriver({ streamPrefix: 'client', mode: ecs.AwsLogDriverMode.NON_BLOCKING }),
      environment: {
        AWS_DEFAULT_REGION: this.region,
      },
      privileged: false,
      containerName : 'Client',
      essential: true
    })

    const transfer = taskDefinition.addContainer('Transfer', {
      image: ecs.ContainerImage.fromAsset(path.resolve(__dirname, './s3-transfer')),
      memoryReservationMiB: 128,
      privileged: false,
      logging: new ecs.AwsLogDriver({ streamPrefix: 'transfer', mode: ecs.AwsLogDriverMode.NON_BLOCKING }),
      environment: {
        AWS_DEFAULT_REGION: this.region,
        BUCKET_NAME: bucket.bucketName
      },
      essential: false
    });

    taskDefinition.addContainer('Fans', {
      image: ecs.ContainerImage.fromAsset(path.resolve(__dirname,'./fans')),
      memoryReservationMiB: 64,
      logging: new ecs.AwsLogDriver({ streamPrefix: 'fans', mode: ecs.AwsLogDriverMode.NON_BLOCKING }),
      essential: false,
      privileged: true,
      containerName : 'Fans'
    });

    server.addMountPoints({
      containerPath: '/results',
      sourceVolume: 'results',
      readOnly: false,
    });

    transfer.addMountPoints({
      containerPath: '/results',
      sourceVolume: 'results',
      readOnly: false,
    });

    client.addMountPoints({
      containerPath: '/usr/share/nginx/html/results',
      sourceVolume: 'results',
      readOnly: true,
    });

    new ecs.ExternalService(this, 'Service', {
      serviceName: this.stackName,
      cluster: cluster,
      taskDefinition,
      desiredCount: 1
    })
    
    // Create IAM Role
    new iam.Role( this, 'EcsAnywhereInstanceRole', {
      assumedBy : new iam.ServicePrincipal('ssm.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSKeyManagementServicePowerUser'),
        iam.ManagedPolicy.fromManagedPolicyArn(this, 'EcsAnywhereEC2Policy', 
        'arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role'),
      ]
    })
  }
}
