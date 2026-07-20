-- AddForeignKey
ALTER TABLE "featured_experiences" ADD CONSTRAINT "featured_experiences_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "destinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
