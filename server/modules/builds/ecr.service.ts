import { Service, Inject } from 'typedi';
import { rimraf, ensureDir, exists } from '../core/fs';
import * as git from 'nodegit';
import * as fs from 'fs';
import { resolve as resolvePath } from 'path';
import { logger } from '@aitheon/core-server';
import { environment } from '../../environment';
import { BuildType } from './build.model';
import * as aws from 'aws-sdk';
import * as semver from 'semver';
import * as _ from 'lodash';

@Service()
export class EcrService {

  constructor() {
  }

  async getLatestVersion(namespace: string) {
    try {
      const ecr = new aws.ECR({
        region: 'eu-west-1'
      });
      // change it to
      const data = await ecr.listImages({ repositoryName: namespace, maxResults: 1000, filter: { tagStatus: 'TAGGED' } }).promise();
      let versions = [];
      let latestVersion = '1.0.0';
      if (data.imageIds.length > 0) {
        const tags = data.imageIds.filter((i) => !!i.imageTag).map((i) => { return i.imageTag; }).map((i) => semver.valid(i)).filter((i) => !!i);
        if (tags.length > 0) {
          versions = semver.rsort(tags);
          latestVersion = versions[0];
        }
      }
      latestVersion = semver.inc(latestVersion, 'minor');
      return latestVersion;
    } catch (err) {
      logger.error('[EcrService] listImages:', err);
      throw err;
    }
  }

  async getImageByTag(repositoryName: string,  tag: string) {
    try {
      const ecr = new aws.ECR({
        region: 'eu-west-1'
      });
      const data = await ecr.batchGetImage({ imageIds: [{ imageTag: tag }], repositoryName }).promise();
      if (data.images.length > 0) {
        return data.images[0];
      }
      return;
    } catch (err) {
      logger.error('[EcrService] getImageByTag:', err);
      throw err;
    }
  }

  async tagImage(image: aws.ECR.Image, tag: string) {
    try {
      const ecr = new aws.ECR({
        region: 'eu-west-1'
      });
      const params = {
        imageManifest: image.imageManifest, /* required */
        repositoryName: image.repositoryName, /* required */
        imageTag: tag,
        registryId: image.registryId
      };
      const data = await ecr.putImage(params).promise();
      if (data && data.$response && data.$response.error) {
        logger.error('[EcrService] AWS error tagImage:', data.$response.error);
        throw new Error(data.$response.error.message);
      }
    } catch (err) {
      if (err.code === 'ImageAlreadyExistsException') {
        return;
      }
      logger.error('[EcrService] tagImage:', err);
      throw err;
    }
  }


  async listImages(repositoryName: string) {
    try {
      const ecr = new aws.ECR({
        region: 'eu-west-1'
      });
      const data = await ecr.describeImages({
        repositoryName,
        maxResults: 1000,
        filter: {
          tagStatus: 'TAGGED'
        },
      }).promise();

      const images = _.take(_.orderBy(data.imageDetails, (img) => { return new Date(img.imagePushedAt); }).reverse(), 20);
      return images;
    } catch (err) {
      logger.error('[EcrService] listImages:', err);
      throw err;
    }
  }

  async hasCacheLayer(name: string) {
    try {
      const ecr = new aws.ECR({
        region: 'eu-west-1'
      });
      const data = await ecr.listImages({ repositoryName: `${ name }/cache` }).promise();
      return true;
    } catch (err) {
      return false;
    }
  }

}
