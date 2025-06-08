import fs from "fs";
import path from "path";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { QdrantClient } from "@qdrant/js-client-rest";
import { QdrantVectorStore } from "@langchain/qdrant";
import { VertexAIEmbeddings } from "@langchain/google-vertexai";
import { PrismaClient } from "@prisma/client";

const tempDir = path.resolve(__dirname, "../temp"); 

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const client = new PrismaClient()

export async function processAndStorePdf(pdfFilename: string,userId:string,documentName:string) {
  try {
    // Construct the full file path
    const pdfPath = path.join(tempDir, pdfFilename);

    if (!fs.existsSync(pdfPath)) {
      throw new Error(`File not found: ${pdfPath}`);
    }

    console.log(`Processing file: ${pdfPath}`);

    // Step 1: Load PDF
    const loader = new PDFLoader(pdfPath);
    const docs = await loader.load();
    console.log("Loaded Docs:", docs.length);

    // Step 2: Split Documents
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const splitDocs = await textSplitter.splitDocuments(docs);
    console.log("Split Docs:", splitDocs.length);

    // Step 3: Generate Embeddings
    const embeddings = new VertexAIEmbeddings({
      model: "text-embedding-004",
    });

    // Step 4: Store Embeddings in Qdrant

    const newDocumentWithChat = await client.document.create({
      data: {
        documentName: documentName,
        userId: userId,
        queries:{
          create:{
            userId:userId,
            
          }
        }
      },
    });
    

    const documentId = newDocumentWithChat.documentId
    const vectorStore = await QdrantVectorStore.fromTexts(
      splitDocs.map((doc) => doc.pageContent),
      splitDocs.map((doc) => ({
        ...doc.metadata,  
        documentId: documentId,  
        userId: userId,  
      })),
      embeddings,
      {

        client: new QdrantClient({
          url: process.env.QDRANT_URL!,
          apiKey: process.env.QDRANT_KEY!,
        }),
        collectionName: "pdf_embeddings",
      }
    );
    console.log("Embeddings successfully stored in Qdrant!");

    // Step 5: Delete the file after processing
    fs.unlink(pdfPath, (err) => {
      if (err) console.error("Error deleting file:", err);
      else console.log(`Temporary file deleted: ${pdfPath}`);
    });

  } catch (error) {
    console.error("Error processing file:", error);
  }
}
