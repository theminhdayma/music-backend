import { Test, TestingModule } from '@nestjs/testing';
import { R2Service } from './r2.service';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';

describe('R2Service', () => {
  let service: R2Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        R2Service,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'STORAGE_ENDPOINT')
                return 'https://7a7c0c77b860c4763bbe740c158511dd.r2.cloudflarestorage.com';
              if (key === 'STORAGE_ACCESS_KEY_ID')
                return '208f6217a63cd8f95d020ef2aaa5fc2d';
              if (key === 'STORAGE_SECRET_ACCESS_KEY')
                return 'fbe8eb8e45a4287dbc03e4de2e63e654017a7a032002632c7521ac9b094c5d54';
              if (key === 'STORAGE_BUCKET_NAME') return 'music';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<R2Service>(R2Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize S3Client correctly', () => {
    const client = service.getS3Client();
    expect(client).toBeInstanceOf(S3Client);
  });

  it('should return correct bucket name', () => {
    expect(service.getBucketName()).toBe('music');
  });
});
