import { Service, Inject } from 'typedi';
import { environment } from '../../environment';
import { S3Service } from './s3.service';

@Service()
export class ArtifactsService {

  @Inject(type => S3Service)
  s3Service: S3Service;

  buildHttpsArtifactFullName(rootName: string, projectId: string, artifactId: string) {
    return `https://${environment.s3BucketName}.s3.${environment.awsRegion}.amazonaws.com/${this.buildArtifactsName(rootName, projectId, artifactId)}`;
  }

  buildS3ArtifactsFullName(rootName: string, projectId: string, artifactId: string) {
    return `s3://${environment.s3BucketName}/${this.buildArtifactsName(rootName, projectId, artifactId)}`;
  }

  buildArtifactsName(rootName: string, projectId: string, artifactId: string) {
    return `${rootName}/${projectId}/${artifactId}.tar.gz`;
  }

  async getArtifact(rootName: string, projectId: string, artifactId: string) {
    return await this.s3Service.getObjectBody(`${rootName}/${projectId}/${artifactId}.tar.gz`) as Buffer;
  }

  async tagArtifact(artifactName: string, projectId: string, tag: string) {
    return await this.s3Service.copyObject(artifactName, this.buildArtifactsName(environment.rootReleasesName, projectId, tag));
  }
}