import { Service, Inject } from 'typedi';
import { logger } from '@aitheon/core-server';
import { environment } from '../../environment';
import * as aws from 'aws-sdk';
import { Readable } from 'stream';
import { AWSError, S3 } from 'aws-sdk';

@Service()
export class S3Service {
  constructor() {
  }

  async copyObject(sourceObjectName: string, targetObjectName: string) {
    try {
      const s3 = new aws.S3({
        region: environment.awsRegion
      });

      const params: S3.Types.CopyObjectRequest = {
        Bucket: environment.s3BucketName,
        CopySource: `${environment.s3BucketName}/${sourceObjectName}`,
        Key: targetObjectName,
        ACL: 'public-read'
      };

      const result = await s3.copyObject(params).promise();

      if (result && result.$response && result.$response.error) {
        logger.error('[S3Service] AWS error copyObject:', result.$response.error);
        throw new Error(result.$response.error.message);
      }
      return targetObjectName;

    } catch (err) {
      logger.error('[S3Service] copyObject', err);
      throw err;
    }
  }

  async getObjectBody(objectName: string) {
    return (await this.getObject(objectName, true)).Body;
  }

  async getObject(objectName: string, loadBody = false) {
    try {
      const s3 = new aws.S3({
        region: environment.awsRegion
      });

      const params: S3.Types.GetObjectRequest = {
        Bucket: environment.s3BucketName,
        Key: objectName
      };
      if (!loadBody) {
        params.Range = 'bytes=0-9';
      }

      const result = await s3.getObject(params).promise();

      if (result && result.$response && result.$response.error) {
        logger.error('[S3Service] AWS error getObject:', result.$response.error);
        if (result.$response.error.statusCode === 404) {
          return undefined;
        } else {
          throw new Error(result.$response.error.message);
        }
      }
      return result;

    } catch (err) {
      logger.error('[S3Service] getObject', err);
      throw err;
    }
  }

  async listBuckets() {
    try {
      const s3 = new aws.S3({
        region: environment.awsRegion
      });

      const data = await s3.listBuckets().promise();
      logger.info('Buckets:');
      for (const bucket of data.Buckets) {
        logger.info(bucket.Name);
      }

    } catch (err) {
      logger.error('[S3Service] listBuckets', err);
      throw err;
    }
  }
}