
# Copy all files in dir to s3 bucket and delete them from local dir.

import boto3
import os
from apscheduler.schedulers.blocking import BlockingScheduler


def main():
    print("Starting scheduled run of main function")
    s3=boto3.resource('s3')

    bucket_name=os.getenv('BUCKET_NAME')

    for subdir, dirs, files in os.walk("/results"):

        for file in files:
            full_path=os.path.join(subdir, file)
            print(full_path)
            s3.Bucket(bucket_name).upload_file(full_path, full_path)
            print("Uploaded " + full_path)
            os.remove(full_path)

    print("Done")

print("Process starting")
scheduler=BlockingScheduler()
scheduler.add_job(main, 'interval', hours = 1)
scheduler.start()
