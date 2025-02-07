-- DropForeignKey
ALTER TABLE "Queries" DROP CONSTRAINT "Queries_docId_fkey";

-- AddForeignKey
ALTER TABLE "Queries" ADD CONSTRAINT "Queries_docId_fkey" FOREIGN KEY ("docId") REFERENCES "Document"("documentId") ON DELETE CASCADE ON UPDATE CASCADE;
