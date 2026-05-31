/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { AnalysisCompletedProcessor } from './audio-analysis.processor';
import { PrismaService } from '../prisma/prisma.service';
import { MusicGateway } from './music.gateway';
import { Job } from 'bullmq';

describe('AnalysisCompletedProcessor', () => {
  let processor: AnalysisCompletedProcessor;
  let prisma: PrismaService;
  let musicGateway: MusicGateway;

  const mockPrisma = {
    song: {
      update: jest.fn(),
    },
    songAnalysis: {
      upsert: jest.fn(),
    },
    stem: {
      create: jest.fn(),
    },
  };

  const mockMusicGateway = {
    emitSongStatusUpdate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalysisCompletedProcessor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MusicGateway, useValue: mockMusicGateway },
      ],
    }).compile();

    processor = module.get<AnalysisCompletedProcessor>(
      AnalysisCompletedProcessor,
    );
    prisma = module.get<PrismaService>(PrismaService);
    musicGateway = module.get<MusicGateway>(MusicGateway);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('process', () => {
    it('should successfully process analysis results, update DB and emit WebSocket event', async () => {
      const mockJob = {
        data: {
          songId: 'song-uuid',
          status: 'success',
          bpm: 120,
          key: 'Am',
          duration: 180,
          waveform: [0.012, 0.045, 0.098],
          stems: {
            vocal: 'songs/song-uuid/stems/vocal.wav',
            drums: 'songs/song-uuid/stems/drums.wav',
            bass: 'songs/song-uuid/stems/bass.wav',
            other: 'songs/song-uuid/stems/other.wav',
          },
        },
      } as Job;

      mockPrisma.song.update.mockResolvedValue({
        id: 'song-uuid',
        title: 'Test Song',
      });
      mockPrisma.songAnalysis.upsert.mockResolvedValue({ id: 'analysis-uuid' });
      mockPrisma.stem.create.mockImplementation((args) =>
        Promise.resolve({ id: 'stem-uuid', ...args.data }),
      );

      const result = await processor.process(mockJob);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);

      // Verify DB updates
      expect(prisma.song.update).toHaveBeenCalledWith({
        where: { id: 'song-uuid' },
        data: {
          bpm: 120,
          key: 'Am',
          duration: 180,
          processingStatus: 'done',
        },
      });

      expect(prisma.songAnalysis.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { songId: 'song-uuid' },
          create: expect.objectContaining({
            songId: 'song-uuid',
            bpm: 120,
            key: 'Am',
            duration: 180,
          }),
        }),
      );

      expect(prisma.stem.create).toHaveBeenCalledTimes(4);
      expect(musicGateway.emitSongStatusUpdate).toHaveBeenCalledWith(
        'song-uuid',
        expect.objectContaining({
          songId: 'song-uuid',
          status: 'done',
        }),
      );
    });

    it('should handle failed analysis result from AI service', async () => {
      const mockJob = {
        data: {
          songId: 'song-uuid',
          status: 'failed',
          error: 'GPU OOM',
        },
      } as Job;

      mockPrisma.song.update.mockResolvedValue({ id: 'song-uuid' });

      const result = await processor.process(mockJob);

      expect(result).toBeDefined();
      expect(prisma.song.update).toHaveBeenCalledWith({
        where: { id: 'song-uuid' },
        data: {
          processingStatus: 'failed',
        },
      });

      expect(musicGateway.emitSongStatusUpdate).toHaveBeenCalledWith(
        'song-uuid',
        expect.objectContaining({
          songId: 'song-uuid',
          status: 'failed',
          error: 'GPU OOM',
        }),
      );
    });
  });
});
