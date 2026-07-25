-- AlterTable
ALTER TABLE "operators" ADD COLUMN     "activePaymentProvider" "PaymentProvider" NOT NULL DEFAULT 'STRIPE';
