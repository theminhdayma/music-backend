/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { LicensingService } from './licensing.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('LicensingService', () => {
  let service: LicensingService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LicensingService,
        {
          provide: PrismaService,
          useValue: {
            song: {
              findUnique: jest.fn(),
            },
            songLicenseConfig: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            userLicense: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<LicensingService>(LicensingService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findMyLicenses', () => {
    it('should return licenses of the user', async () => {
      const mockLicenses = [
        { id: 'license1', userId: 'user1', song: { title: 'Song 1' } },
      ];
      (prisma.userLicense.findMany as jest.Mock).mockResolvedValue(
        mockLicenses,
      );

      const result = await service.findMyLicenses('user1');
      expect(result).toEqual(mockLicenses);
      expect(prisma.userLicense.findMany).toHaveBeenCalledWith({
        where: { userId: 'user1' },
        include: { song: true },
      });
    });
  });

  describe('getLicenseOptions', () => {
    it('should return license config if found', async () => {
      const mockConfig = { songId: 'song1', personalPrice: 0 };
      (prisma.songLicenseConfig.findUnique as jest.Mock).mockResolvedValue(
        mockConfig,
      );

      const result = await service.getLicenseOptions('song1');
      expect(result).toEqual(mockConfig);
    });

    it('should throw NotFoundException if config is missing', async () => {
      (prisma.songLicenseConfig.findUnique as jest.Mock).mockResolvedValue(
        null,
      );
      await expect(service.getLicenseOptions('song1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateLicenseConfig', () => {
    it('should update config if user is the owner', async () => {
      const mockSong = { id: 'song1', ownerId: 'owner1' };
      const mockUpdateDto = { commercialPrice: 1999 };
      (prisma.song.findUnique as jest.Mock).mockResolvedValue(mockSong);
      (prisma.songLicenseConfig.update as jest.Mock).mockResolvedValue({
        songId: 'song1',
        commercialPrice: 1999,
      });

      const result = await service.updateLicenseConfig(
        'song1',
        'owner1',
        mockUpdateDto,
      );
      expect(result.commercialPrice).toBe(1999);
      expect(prisma.songLicenseConfig.update).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user is not the owner', async () => {
      const mockSong = { id: 'song1', ownerId: 'owner2' };
      (prisma.song.findUnique as jest.Mock).mockResolvedValue(mockSong);

      await expect(
        service.updateLicenseConfig('song1', 'owner1', {
          commercialPrice: 1999,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if song not found', async () => {
      (prisma.song.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateLicenseConfig('song1', 'owner1', {
          commercialPrice: 1999,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('purchaseFreeLicense', () => {
    it('should throw BadRequestException if license configuration not found', async () => {
      (prisma.songLicenseConfig.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(
        service.purchaseFreeLicense('song1', 'user1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if personal license is disabled', async () => {
      (prisma.songLicenseConfig.findUnique as jest.Mock).mockResolvedValue({
        personalEnabled: false,
      });

      await expect(
        service.purchaseFreeLicense('song1', 'user1'),
      ).rejects.toThrow('Personal license is not enabled for this song');
    });

    it('should throw BadRequestException if personal license is not free', async () => {
      (prisma.songLicenseConfig.findUnique as jest.Mock).mockResolvedValue({
        personalEnabled: true,
        personalPrice: 99,
      });

      await expect(
        service.purchaseFreeLicense('song1', 'user1'),
      ).rejects.toThrow(
        'Personal license for this song is not free. Use payment gateway instead.',
      );
    });

    it('should throw BadRequestException if user already has this license', async () => {
      (prisma.songLicenseConfig.findUnique as jest.Mock).mockResolvedValue({
        personalEnabled: true,
        personalPrice: 0,
      });
      (prisma.userLicense.findFirst as jest.Mock).mockResolvedValue({
        id: 'existing_license',
      });

      await expect(
        service.purchaseFreeLicense('song1', 'user1'),
      ).rejects.toThrow('You already own a Personal license for this song');
    });

    it('should successfully create free user license', async () => {
      (prisma.songLicenseConfig.findUnique as jest.Mock).mockResolvedValue({
        personalEnabled: true,
        personalPrice: 0,
      });
      (prisma.userLicense.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.userLicense.create as jest.Mock).mockResolvedValue({
        id: 'license_new',
        licenseKey: 'STMV-SONG-PERS-XXXXXX',
      });

      const result = await service.purchaseFreeLicense('song1', 'user1');
      expect(result.id).toBe('license_new');
      expect(prisma.userLicense.create).toHaveBeenCalled();
    });
  });

  describe('validateLicense', () => {
    it('should return true if active license is found', async () => {
      (prisma.userLicense.findFirst as jest.Mock).mockResolvedValue({
        id: 'license1',
      });

      const result = await service.validateLicense('song1', 'user1');
      expect(result).toBe(true);
    });

    it('should return false if active license is not found', async () => {
      (prisma.userLicense.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.validateLicense('song1', 'user1');
      expect(result).toBe(false);
    });
  });
});
