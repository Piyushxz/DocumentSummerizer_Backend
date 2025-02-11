-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_QuerieID_fkey";

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_QuerieID_fkey" FOREIGN KEY ("QuerieID") REFERENCES "Queries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
