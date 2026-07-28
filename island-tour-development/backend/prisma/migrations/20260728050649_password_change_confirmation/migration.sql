-- CreateTable
CREATE TABLE "password_change_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "newPasswordHash" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "requestedIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_change_requests_userId_key" ON "password_change_requests"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "password_change_requests_tokenHash_key" ON "password_change_requests"("tokenHash");

-- CreateIndex
CREATE INDEX "password_change_requests_expiresAt_idx" ON "password_change_requests"("expiresAt");

-- AddForeignKey
ALTER TABLE "password_change_requests" ADD CONSTRAINT "password_change_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
