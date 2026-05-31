import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Create Users
  const creator = await prisma.user.upsert({
    where: { email: 'creator@stemverse.com' },
    update: {},
    create: {
      email: 'creator@stemverse.com',
      displayName: 'Original Creator',
      role: 'creator',
      isVerified: true,
    },
  });

  const remixer = await prisma.user.upsert({
    where: { email: 'remixer@stemverse.com' },
    update: {},
    create: {
      email: 'remixer@stemverse.com',
      displayName: 'AI Remixer',
      role: 'remixer',
      isVerified: true,
    },
  });

  const consumer = await prisma.user.upsert({
    where: { email: 'fan@stemverse.com' },
    update: {},
    create: {
      email: 'fan@stemverse.com',
      displayName: 'Music Fan',
      role: 'consumer',
    },
  });

  console.log(`Users seeded: creator (${creator.id}), remixer (${remixer.id}), consumer (${consumer.id})`);

  // 2. Create Wallets
  await prisma.userWallet.upsert({
    where: { userId: creator.id },
    update: {},
    create: {
      userId: creator.id,
      balanceUsd: 15000, // $150.00
      totalEarned: 25000,
    },
  });

  await prisma.userWallet.upsert({
    where: { userId: remixer.id },
    update: {},
    create: {
      userId: remixer.id,
      balanceUsd: 5000, // $50.00
      totalEarned: 5000,
    },
  });

  console.log('Wallets seeded.');

  // 3. Create a Song
  const song = await prisma.song.create({
    data: {
      ownerId: creator.id,
      title: 'Summer Breeze',
      genre: 'Synthwave',
      bpm: 110.0,
      key: 'Am',
      mood: 'Retro',
      tags: ['synth', 'retrowave', 'summer'],
      fileUrl: 'https://r2.cloudflarestorage.com/stemverse-audio/summer-breeze.mp3',
      duration: 180,
      licenseType: 'remix',
      remixAllowed: true,
      royaltySplitRemixer: 20.00,
      royaltySplitPlatform: 10.00,
      processingStatus: 'done',
      isPublished: true,
      stems: {
        create: [
          { type: 'vocal', fileUrl: 'https://r2.cloudflarestorage.com/stemverse-audio/summer-breeze-vocals.wav', duration: 180 },
          { type: 'drums', fileUrl: 'https://r2.cloudflarestorage.com/stemverse-audio/summer-breeze-drums.wav', duration: 180 },
          { type: 'bass', fileUrl: 'https://r2.cloudflarestorage.com/stemverse-audio/summer-breeze-bass.wav', duration: 180 },
          { type: 'melody', fileUrl: 'https://r2.cloudflarestorage.com/stemverse-audio/summer-breeze-melody.wav', duration: 180 },
        ],
      },
      analysis: {
        create: {
          bpm: 110.0,
          key: 'Am',
          mood: 'Retro',
          waveform: [0.1, 0.3, 0.5, 0.4, 0.6, 0.8, 0.2, 0.1, 0.5],
          duration: 180,
        },
      },
      licenseConfig: {
        create: {
          personalPrice: 99, // $0.99
          commercialPrice: 2999, // $29.99
          remixPrice: 499, // $4.99
          exclusivePrice: 19999, // $199.99
        },
      },
    },
  });

  console.log(`Song seeded: ${song.title} (${song.id})`);

  // Create initial OwnershipRelation for A (Summer Breeze)
  await prisma.ownershipRelation.create({
    data: {
      parentSongId: null,
      childSongId: song.id,
      ownerId: creator.id,
      splitPercentage: 100.00,
      relationshipType: 'original',
    },
  });

  // Create user remixer2
  const remixer2 = await prisma.user.upsert({
    where: { email: 'phonkmaster@stemverse.com' },
    update: {},
    create: {
      email: 'phonkmaster@stemverse.com',
      displayName: 'Phonk Master',
      role: 'remixer',
      isVerified: true,
    },
  });

  await prisma.userWallet.upsert({
    where: { userId: remixer2.id },
    update: {},
    create: {
      userId: remixer2.id,
      balanceUsd: 0,
      totalEarned: 0,
    },
  });

  // Create Song B (Chill Remix of A)
  const songB = await prisma.song.create({
    data: {
      ownerId: remixer.id,
      title: 'Summer Breeze (Chill Remix)',
      genre: 'Chillout',
      bpm: 90.0,
      key: 'Am',
      mood: 'Relaxing',
      tags: ['chill', 'remix', 'summer'],
      fileUrl: 'https://r2.cloudflarestorage.com/stemverse-audio/summer-breeze-chill-remix.mp3',
      duration: 210,
      licenseType: 'remix',
      remixAllowed: true,
      royaltySplitRemixer: 20.00,
      royaltySplitPlatform: 10.00,
      processingStatus: 'done',
      isPublished: true,
      stems: {
        create: [
          { type: 'vocal', fileUrl: 'https://r2.cloudflarestorage.com/stemverse-audio/summer-breeze-chill-vocals.wav', duration: 210 },
          { type: 'drums', fileUrl: 'https://r2.cloudflarestorage.com/stemverse-audio/summer-breeze-chill-drums.wav', duration: 210 },
        ],
      },
      analysis: {
        create: {
          bpm: 90.0,
          key: 'Am',
          mood: 'Relaxing',
          waveform: [0.1, 0.2, 0.4, 0.3, 0.5, 0.4, 0.3, 0.2, 0.1],
          duration: 210,
        },
      },
      licenseConfig: {
        create: {
          personalPrice: 99, // $0.99
          commercialPrice: 2999, // $29.99
          remixPrice: 499, // $4.99
          exclusivePrice: 19999, // $199.99
        },
      },
    },
  });

  // Create OwnershipRelation for B (Chill Remix)
  await prisma.ownershipRelation.create({
    data: {
      parentSongId: song.id,
      childSongId: songB.id,
      ownerId: remixer.id,
      splitPercentage: 20.00,
      relationshipType: 'remix',
    },
  });

  console.log(`Song B seeded: ${songB.title} (${songB.id})`);

  // Create Song C (Phonk Remix of B)
  const songC = await prisma.song.create({
    data: {
      ownerId: remixer2.id,
      title: 'Summer Breeze (Phonk Remix)',
      genre: 'Phonk',
      bpm: 130.0,
      key: 'A#m',
      mood: 'Aggressive',
      tags: ['phonk', 'remix', 'summer'],
      fileUrl: 'https://r2.cloudflarestorage.com/stemverse-audio/summer-breeze-phonk-remix.mp3',
      duration: 150,
      licenseType: 'personal',
      remixAllowed: false,
      royaltySplitRemixer: 20.00,
      royaltySplitPlatform: 10.00,
      processingStatus: 'done',
      isPublished: true,
      stems: {
        create: [
          { type: 'vocal', fileUrl: 'https://r2.cloudflarestorage.com/stemverse-audio/summer-breeze-phonk-vocals.wav', duration: 150 },
        ],
      },
      analysis: {
        create: {
          bpm: 130.0,
          key: 'A#m',
          mood: 'Aggressive',
          waveform: [0.3, 0.6, 0.8, 0.9, 0.7, 0.8, 0.9, 0.5, 0.3],
          duration: 150,
        },
      },
      licenseConfig: {
        create: {
          personalPrice: 199, // $1.99
          commercialPrice: 3999, // $39.99
          remixPrice: 999, // $9.99
          exclusivePrice: 29999, // $299.99
        },
      },
    },
  });

  // Create OwnershipRelation for C (Phonk Remix)
  await prisma.ownershipRelation.create({
    data: {
      parentSongId: songB.id,
      childSongId: songC.id,
      ownerId: remixer2.id,
      splitPercentage: 20.00,
      relationshipType: 'remix',
    },
  });

  console.log(`Song C seeded: ${songC.title} (${songC.id})`);
  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
