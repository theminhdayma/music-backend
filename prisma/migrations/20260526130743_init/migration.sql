-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255),
    "role" VARCHAR(20) NOT NULL DEFAULT 'consumer',
    "display_name" VARCHAR(100),
    "avatar_url" TEXT,
    "bio" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_banned" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "provider_account_id" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "songs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "genre" VARCHAR(50),
    "bpm" DECIMAL(6,2),
    "key" VARCHAR(10),
    "mood" VARCHAR(50),
    "tags" TEXT[],
    "lyrics" TEXT,
    "instruments" TEXT[],
    "vocal_type" VARCHAR(50),
    "file_url" TEXT NOT NULL,
    "duration" INTEGER,
    "license_type" VARCHAR(20) NOT NULL DEFAULT 'personal',
    "remix_allowed" BOOLEAN NOT NULL DEFAULT true,
    "commercial_allowed" BOOLEAN NOT NULL DEFAULT false,
    "ai_voice_cloning_allowed" BOOLEAN NOT NULL DEFAULT false,
    "royalty_split_remixer" DECIMAL(5,2) NOT NULL DEFAULT 20.00,
    "royalty_split_platform" DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    "processing_status" VARCHAR(20) NOT NULL DEFAULT 'queued',
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "total_streams" INTEGER NOT NULL DEFAULT 0,
    "total_remixes" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "songs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stems" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "song_id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "file_url" TEXT NOT NULL,
    "duration" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "stems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "song_analysis" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "song_id" UUID NOT NULL,
    "bpm" DECIMAL(6,2),
    "key" VARCHAR(10),
    "mood" VARCHAR(50),
    "waveform" JSONB,
    "duration" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "song_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "song_license_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "song_id" UUID NOT NULL,
    "personal_price" INTEGER NOT NULL,
    "commercial_price" INTEGER NOT NULL,
    "remix_price" INTEGER NOT NULL,
    "exclusive_price" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "song_license_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ownership_relations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "parent_song_id" UUID,
    "child_song_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "split_percentage" DECIMAL(5,2) NOT NULL,
    "relationship_type" VARCHAR(20) NOT NULL DEFAULT 'remix',
    "license_rules" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ownership_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_licenses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "song_id" UUID NOT NULL,
    "license_type" VARCHAR(20) NOT NULL,
    "price_paid" INTEGER NOT NULL,
    "license_key" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "royalty_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "song_id" UUID NOT NULL,
    "event_type" VARCHAR(30) NOT NULL,
    "event_id" UUID NOT NULL,
    "role" VARCHAR(30) NOT NULL,
    "gross_amount" INTEGER NOT NULL,
    "platform_fee" INTEGER NOT NULL,
    "net_amount" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "status" VARCHAR(20) NOT NULL DEFAULT 'credited',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "royalty_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_wallets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "balance_usd" INTEGER NOT NULL DEFAULT 0,
    "total_earned" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payouts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "external_id" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follows" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "follower_id" UUID NOT NULL,
    "following_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "likes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "song_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "song_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_accounts_provider_provider_account_id_key" ON "oauth_accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE INDEX "songs_owner_id_idx" ON "songs"("owner_id");

-- CreateIndex
CREATE INDEX "songs_genre_idx" ON "songs"("genre");

-- CreateIndex
CREATE INDEX "songs_is_published_idx" ON "songs"("is_published");

-- CreateIndex
CREATE UNIQUE INDEX "song_analysis_song_id_key" ON "song_analysis"("song_id");

-- CreateIndex
CREATE UNIQUE INDEX "song_license_configs_song_id_key" ON "song_license_configs"("song_id");

-- CreateIndex
CREATE INDEX "ownership_relations_parent_song_id_idx" ON "ownership_relations"("parent_song_id");

-- CreateIndex
CREATE INDEX "ownership_relations_child_song_id_idx" ON "ownership_relations"("child_song_id");

-- CreateIndex
CREATE INDEX "ownership_relations_owner_id_idx" ON "ownership_relations"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_licenses_license_key_key" ON "user_licenses"("license_key");

-- CreateIndex
CREATE INDEX "user_licenses_user_id_idx" ON "user_licenses"("user_id");

-- CreateIndex
CREATE INDEX "user_licenses_song_id_idx" ON "user_licenses"("song_id");

-- CreateIndex
CREATE INDEX "royalty_transactions_user_id_idx" ON "royalty_transactions"("user_id");

-- CreateIndex
CREATE INDEX "royalty_transactions_song_id_idx" ON "royalty_transactions"("song_id");

-- CreateIndex
CREATE INDEX "royalty_transactions_event_id_idx" ON "royalty_transactions"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_wallets_user_id_key" ON "user_wallets"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "follows_follower_id_following_id_key" ON "follows"("follower_id", "following_id");

-- CreateIndex
CREATE UNIQUE INDEX "likes_user_id_song_id_key" ON "likes"("user_id", "song_id");

-- AddForeignKey
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "songs" ADD CONSTRAINT "songs_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stems" ADD CONSTRAINT "stems_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "songs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "song_analysis" ADD CONSTRAINT "song_analysis_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "songs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "song_license_configs" ADD CONSTRAINT "song_license_configs_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "songs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ownership_relations" ADD CONSTRAINT "ownership_relations_parent_song_id_fkey" FOREIGN KEY ("parent_song_id") REFERENCES "songs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ownership_relations" ADD CONSTRAINT "ownership_relations_child_song_id_fkey" FOREIGN KEY ("child_song_id") REFERENCES "songs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ownership_relations" ADD CONSTRAINT "ownership_relations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_licenses" ADD CONSTRAINT "user_licenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_licenses" ADD CONSTRAINT "user_licenses_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "songs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "royalty_transactions" ADD CONSTRAINT "royalty_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "royalty_transactions" ADD CONSTRAINT "royalty_transactions_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "songs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_wallets" ADD CONSTRAINT "user_wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "likes" ADD CONSTRAINT "likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "likes" ADD CONSTRAINT "likes_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "songs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "songs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
