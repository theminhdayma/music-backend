import { Module } from '@nestjs/common';
import { MusicUploadService } from './music-upload.service';
import { MusicUploadController } from './music-upload.controller';
import { MusicService } from './music.service';
import { MusicController } from './music.controller';
import { OwnershipService } from './ownership.service';
import { OwnershipController } from './ownership.controller';
import { SocialService } from './social.service';
import { SocialController } from './social.controller';
import { BullModule } from '@nestjs/bullmq';
import { AnalysisCompletedProcessor } from './audio-analysis.processor';
import { MusicGateway } from './music.gateway';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'audio-analysis',
    }),
    BullModule.registerQueue({
      name: 'analysis-completed',
    }),
  ],
  controllers: [
    MusicUploadController,
    MusicController,
    OwnershipController,
    SocialController,
  ],
  providers: [
    MusicUploadService,
    MusicService,
    OwnershipService,
    SocialService,
    AnalysisCompletedProcessor,
    MusicGateway,
  ],
  exports: [
    MusicUploadService,
    MusicService,
    OwnershipService,
    SocialService,
    AnalysisCompletedProcessor,
    MusicGateway,
  ],
})
export class MusicModule {}
