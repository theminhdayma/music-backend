import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';

@Injectable()
export class R2Service {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    const endpoint = this.configService.get<string>('STORAGE_ENDPOINT');
    const accessKeyId = this.configService.get<string>('STORAGE_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'STORAGE_SECRET_ACCESS_KEY',
    );
    this.bucketName =
      this.configService.get<string>('STORAGE_BUCKET_NAME') || '';

    this.s3Client = new S3Client({
      endpoint: endpoint,
      credentials: {
        accessKeyId: accessKeyId || '',
        secretAccessKey: secretAccessKey || '',
      },
      region: 'auto',
    });
  }

  getS3Client(): S3Client {
    return this.s3Client;
  }

  getBucketName(): string {
    return this.bucketName;
  }
}
