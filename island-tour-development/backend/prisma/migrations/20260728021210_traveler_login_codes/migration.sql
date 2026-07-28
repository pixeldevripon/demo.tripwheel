-- CreateTable
CREATE TABLE "traveler_login_codes" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "traveler_login_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "traveler_login_codes_email_createdAt_idx" ON "traveler_login_codes"("email", "createdAt");
