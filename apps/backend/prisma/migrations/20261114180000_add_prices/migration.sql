-- CreateEnum
CREATE TYPE "PriceProvider" AS ENUM ('ITAD', 'CHEAPSHARK');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('PRICE_DROP');

-- AlterEnum
ALTER TYPE "IntegrationProvider" ADD VALUE 'ITAD';

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "cheapSharkId" TEXT,
ADD COLUMN     "itadId" TEXT,
ADD COLUMN     "priceIdsCheckedAt" TIMESTAMP(3),
ADD COLUMN     "steamAppId" INTEGER;

-- CreateTable
CREATE TABLE "PriceSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "country" TEXT NOT NULL DEFAULT 'PT',
    "everyHours" INTEGER NOT NULL DEFAULT 6,
    "lastCheckAt" TIMESTAMP(3),
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamePrice" (
    "gameId" INTEGER NOT NULL,
    "country" TEXT NOT NULL,
    "provider" "PriceProvider" NOT NULL,
    "currency" TEXT NOT NULL,
    "price" DOUBLE PRECISION,
    "regular" DOUBLE PRECISION,
    "cut" INTEGER,
    "shop" TEXT,
    "url" TEXT,
    "lowest" DOUBLE PRECISION,
    "lowestShop" TEXT,
    "lowestAt" TIMESTAMP(3),
    "deals" JSONB NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GamePrice_pkey" PRIMARY KEY ("gameId","country")
);

-- CreateTable
CREATE TABLE "PricePoint" (
    "gameId" INTEGER NOT NULL,
    "country" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,

    CONSTRAINT "PricePoint_pkey" PRIMARY KEY ("gameId","country","day")
);

-- CreateTable
CREATE TABLE "PriceWatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" INTEGER NOT NULL,
    "targetPrice" DOUBLE PRECISION,
    "notifiedPrice" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceWatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "gameId" INTEGER,
    "data" JSONB NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PriceWatch_userId_gameId_key" ON "PriceWatch"("userId", "gameId");

-- CreateIndex
CREATE INDEX "Notification_userId_id_idx" ON "Notification"("userId", "id");

-- AddForeignKey
ALTER TABLE "GamePrice" ADD CONSTRAINT "GamePrice_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("igdbId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricePoint" ADD CONSTRAINT "PricePoint_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("igdbId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceWatch" ADD CONSTRAINT "PriceWatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceWatch" ADD CONSTRAINT "PriceWatch_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("igdbId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

