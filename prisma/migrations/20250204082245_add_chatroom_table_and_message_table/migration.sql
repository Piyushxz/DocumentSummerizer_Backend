-- CreateTable
CREATE TABLE "Queries" (
    "id" SERIAL NOT NULL,
    "docId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "QuerieID" INTEGER NOT NULL,
    "sentBy" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Queries" ADD CONSTRAINT "Queries_docId_fkey" FOREIGN KEY ("docId") REFERENCES "Document"("documentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Queries" ADD CONSTRAINT "Queries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_QuerieID_fkey" FOREIGN KEY ("QuerieID") REFERENCES "Queries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
