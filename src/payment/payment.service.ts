import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { RoyaltyService } from './royalty.service';

type StripeMetadata = Record<string, string>;

interface StripePaymentIntentLike {
  id: string;
  amount: number;
  currency: string;
  metadata: StripeMetadata;
  client_secret: string | null;
}

interface StripeWebhookEventLike {
  type: string;
  data: {
    object: StripePaymentIntentLike;
  };
}

interface StripeClientLike {
  paymentIntents: {
    create(input: {
      amount: number;
      currency: string;
      metadata: StripeMetadata;
    }): Promise<StripePaymentIntentLike>;
  };
  webhooks: {
    constructEvent(
      body: Buffer,
      signature: string,
      secret: string,
    ): StripeWebhookEventLike;
  };
}

@Injectable()
export class PaymentService {
  private readonly stripe: StripeClientLike;
  private readonly webhookSecret: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private royaltyService: RoyaltyService,
  ) {
    const stripeSecretKey =
      this.configService.get<string>('STRIPE_API_KEY') || 'sk_test_xxx';
    this.webhookSecret =
      this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || 'whsec_xxx';
    this.stripe = new Stripe(stripeSecretKey) as unknown as StripeClientLike;
  }

  async createPaymentIntent(
    songId: string,
    licenseType: 'commercial' | 'remix' | 'exclusive',
    userId: string,
  ) {
    const songConfig = await this.prisma.songLicenseConfig.findUnique({
      where: { songId },
    });

    if (!songConfig) {
      throw new NotFoundException(
        `License config not found for song ${songId}`,
      );
    }

    let price = 0;
    let enabled = false;

    switch (licenseType) {
      case 'commercial':
        price = songConfig.commercialPrice;
        enabled = songConfig.commercialEnabled;
        break;
      case 'remix':
        price = songConfig.remixPrice;
        enabled = songConfig.remixEnabled;
        break;
      case 'exclusive':
        price = songConfig.exclusivePrice;
        enabled = songConfig.exclusiveEnabled;
        break;
    }

    if (!enabled) {
      throw new BadRequestException(
        `License type ${licenseType} is not enabled or available for this song`,
      );
    }

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: price,
      currency: 'usd',
      metadata: {
        songId,
        userId,
        licenseType,
      },
    });

    return {
      clientSecret: paymentIntent.client_secret,
    };
  }

  async handleWebhook(body: Buffer, signature: string): Promise<boolean> {
    let event: StripeWebhookEventLike;

    try {
      event = this.stripe.webhooks.constructEvent(
        body,
        signature,
        this.webhookSecret,
      );
    } catch (err) {
      throw new BadRequestException(`Webhook Error: ${(err as Error).message}`);
    }

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      const metadata = paymentIntent.metadata;
      const { songId, userId, licenseType } = metadata;

      // Idempotency Check
      const existingLicense = await this.prisma.userLicense.findUnique({
        where: { paymentId: paymentIntent.id },
      });

      if (existingLicense) {
        return true; // Already processed
      }

      let newLicenseId = '';

      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Create License
        const randomStr = Math.random()
          .toString(36)
          .substring(2, 10)
          .toUpperCase();
        const shortSong = songId.substring(0, 4).toUpperCase();
        const licenseKey = `STMV-${shortSong}-${licenseType.substring(0, 4).toUpperCase()}-${randomStr}`;

        const createdLicense = await tx.userLicense.create({
          data: {
            userId,
            songId,
            licenseType: licenseType,
            licenseKey,
            pricePaid: paymentIntent.amount,
            currency: paymentIntent.currency.toUpperCase(),
            paymentId: paymentIntent.id,
          },
        });
        newLicenseId = createdLicense.id;

        // If exclusive, disable future exclusive sales
        if (licenseType === 'exclusive') {
          await tx.songLicenseConfig.update({
            where: { songId },
            data: { exclusiveEnabled: false },
          });
        }
      });

      if (newLicenseId) {
        await this.royaltyService.distributeRoyalty(
          songId,
          paymentIntent.amount,
          newLicenseId,
        );
      }
    }

    return true;
  }
}
