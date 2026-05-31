/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { RoyaltyService } from './royalty.service';

describe('PaymentService', () => {
  let service: PaymentService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: RoyaltyService,
          useValue: {
            distributeRoyalty: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            songLicenseConfig: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            userLicense: {
              findUnique: jest.fn(),
              create: jest.fn(),
            },
            $transaction: jest.fn((callback) => callback(prisma)),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => {
              if (key === 'STRIPE_SECRET_KEY') return 'sk_test_123';
              if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_123';
            }),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    prisma = module.get<PrismaService>(PrismaService);

    // Mock Stripe instance internally to prevent actual API calls
    (service as any).stripe = {
      paymentIntents: {
        create: jest.fn().mockResolvedValue({
          id: 'pi_test123',
          client_secret: 'secret_test123',
        }),
      },
      webhooks: {
        constructEvent: jest.fn(),
      },
    };
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPaymentIntent', () => {
    it('should throw an error if song config is not found', async () => {
      (prisma.songLicenseConfig.findUnique as jest.Mock).mockResolvedValue(
        null,
      );
      await expect(
        service.createPaymentIntent('song1', 'commercial', 'user1'),
      ).rejects.toThrow('License config not found for song song1');
    });

    it('should throw an error if license type is disabled', async () => {
      (prisma.songLicenseConfig.findUnique as jest.Mock).mockResolvedValue({
        commercialEnabled: false,
      });
      await expect(
        service.createPaymentIntent('song1', 'commercial', 'user1'),
      ).rejects.toThrow(
        'License type commercial is not enabled or available for this song',
      );
    });

    it('should return a client secret when successful', async () => {
      (prisma.songLicenseConfig.findUnique as jest.Mock).mockResolvedValue({
        commercialEnabled: true,
        commercialPrice: 2999,
      });

      const result = await service.createPaymentIntent(
        'song1',
        'commercial',
        'user1',
      );
      expect(result.clientSecret).toBe('secret_test123');
      expect(
        (service as any).stripe.paymentIntents.create,
      ).toHaveBeenCalledWith({
        amount: 2999,
        currency: 'usd',
        metadata: {
          songId: 'song1',
          userId: 'user1',
          licenseType: 'commercial',
        },
      });
    });
  });

  describe('handleWebhook', () => {
    it('should throw if signature is invalid', async () => {
      (
        (service as any).stripe.webhooks.constructEvent as jest.Mock
      ).mockImplementation(() => {
        throw new Error('Invalid signature');
      });
      await expect(
        service.handleWebhook(Buffer.from('body'), 'invalid_sig'),
      ).rejects.toThrow('Webhook Error: Invalid signature');
    });

    it('should insert a license and return true on payment_intent.succeeded', async () => {
      const mockEvent = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test123',
            amount: 2999,
            currency: 'usd',
            metadata: {
              songId: 'song1',
              userId: 'user1',
              licenseType: 'commercial',
            },
          },
        },
      };
      (
        (service as any).stripe.webhooks.constructEvent as jest.Mock
      ).mockReturnValue(mockEvent);
      (prisma.userLicense.findUnique as jest.Mock).mockResolvedValue(null); // Not processed yet
      (prisma.userLicense.create as jest.Mock).mockResolvedValue({
        id: 'license1',
      });

      const result = await service.handleWebhook(
        Buffer.from('body'),
        'valid_sig',
      );
      expect(result).toBe(true);
      expect(prisma.userLicense.create).toHaveBeenCalled();
    });

    it('should ignore webhook if already processed (idempotency)', async () => {
      const mockEvent = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test123',
            metadata: {
              songId: 'song1',
              userId: 'user1',
              licenseType: 'commercial',
            },
          },
        },
      };
      (
        (service as any).stripe.webhooks.constructEvent as jest.Mock
      ).mockReturnValue(mockEvent);
      (prisma.userLicense.findUnique as jest.Mock).mockResolvedValue({
        id: 'license1',
      }); // Already exists

      const result = await service.handleWebhook(
        Buffer.from('body'),
        'valid_sig',
      );
      expect(result).toBe(true);
      expect(prisma.userLicense.create).not.toHaveBeenCalled();
    });
  });
});
