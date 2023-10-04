#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AiKaraokeStack } from '../lib/ai.karaoke-stack';

const app = new cdk.App();
new AiKaraokeStack(app, 'AiKaraokeStack', {
    description: "(uksb-1tupboc24)"
});