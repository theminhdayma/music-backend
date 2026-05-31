import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '@nestjs/common';
import { MusicGateway } from './music.gateway';

interface AnalysisCompletedJobData {
  songId: string;
  status: 'success' | 'failed';
  bpm?: number;
  key?: string;
  duration?: number;
  waveform?: number[];
  stems?: Record<string, string>;
  error?: string;
}

interface AnalysisProcessResult {
  success: boolean;
  songId: string;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

@Processor('analysis-completed')
export class AnalysisCompletedProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalysisCompletedProcessor.name);

  constructor(
    private prisma: PrismaService,
    private musicGateway: MusicGateway,
  ) {
    super();
  }

  async process(
    job: Job<AnalysisCompletedJobData, AnalysisProcessResult, string>,
  ): Promise<AnalysisProcessResult> {
    const payload = job.data;
    const { songId, status } = payload;
    this.logger.log(
      `Received analysis result for song ${songId} with status: ${status}`,
    );

    if (status === 'success') {
      const { bpm, key, duration, waveform, stems = {} } = payload;
      const bpmDecimal =
        bpm !== undefined && bpm !== null ? Number(bpm.toFixed(2)) : null;

      try {
        // 1. Cập nhật Song table
        const updatedSong = await this.prisma.song.update({
          where: { id: songId },
          data: {
            bpm: bpmDecimal,
            key,
            duration,
            processingStatus: 'done',
          },
        });

        // 2. Upsert SongAnalysis table
        const analysis = await this.prisma.songAnalysis.upsert({
          where: { songId },
          update: {
            bpm: bpmDecimal,
            key,
            duration,
            waveform,
          },
          create: {
            songId,
            bpm: bpmDecimal,
            key,
            duration,
            waveform,
          },
        });

        // 3. Tạo các bản ghi Stems
        const createdStems = [];
        for (const [stemType, fileUrl] of Object.entries(stems)) {
          // Chuẩn hóa loại stem: map 'vocals' thành 'vocal' để tương thích với db comment
          const type = stemType === 'vocals' ? 'vocal' : stemType;

          const stem = await this.prisma.stem.create({
            data: {
              songId,
              type,
              fileUrl: fileUrl,
              duration,
            },
          });
          createdStems.push(stem);
        }

        this.logger.log(`Updated song ${songId} successfully in database.`);

        // 4. Phát WebSocket Event báo hoàn thành
        this.musicGateway.emitSongStatusUpdate(songId, {
          songId,
          status: 'done',
          song: updatedSong,
          analysis,
          stems: createdStems,
        });
      } catch (dbError: unknown) {
        const errorMessage = getErrorMessage(dbError);
        this.logger.error(
          `Database transaction failed for song ${songId}: ${errorMessage}`,
        );

        await this.prisma.song
          .update({
            where: { id: songId },
            data: { processingStatus: 'failed' },
          })
          .catch(() => {});

        this.musicGateway.emitSongStatusUpdate(songId, {
          songId,
          status: 'failed',
          error: errorMessage,
        });

        throw dbError;
      }
    } else {
      // AI Service báo lỗi
      await this.prisma.song
        .update({
          where: { id: songId },
          data: { processingStatus: 'failed' },
        })
        .catch(() => {});

      this.musicGateway.emitSongStatusUpdate(songId, {
        songId,
        status: 'failed',
        error: payload.error || 'AI separation failed.',
      });
    }

    return { success: true, songId };
  }
}
