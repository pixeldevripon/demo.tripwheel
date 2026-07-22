-- Post-tour review invitations (the collection gap) + the WhatsApp reminder opt-in.
-- Purely additive: no column is dropped or renamed.


-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "reviewWhatsappOptIn" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "review_invitations" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "reviewId" TEXT,
    "sentAt" TIMESTAMP(3),
    "remindedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "suppressedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "review_invitations_bookingId_key" ON "review_invitations"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "review_invitations_token_key" ON "review_invitations"("token");

-- CreateIndex
CREATE INDEX "review_invitations_sentAt_completedAt_idx" ON "review_invitations"("sentAt", "completedAt");

-- CreateIndex
CREATE INDEX "review_invitations_remindedAt_sentAt_completedAt_idx" ON "review_invitations"("remindedAt", "sentAt", "completedAt");

-- AddForeignKey
ALTER TABLE "review_invitations" ADD CONSTRAINT "review_invitations_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

