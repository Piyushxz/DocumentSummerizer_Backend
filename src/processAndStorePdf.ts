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

const client = new PrismaClient();

export async function processAndStorePdf(pdfFilename: string, userId: string, documentName: string) {
  try {
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

    // Step 3: Create document in database first
    const newDocumentWithChat = await client.document.create({
      data: {
        documentName: documentName,
        userId: userId,
        queries: {
          create: {
            userId: userId,
          }
        }
      },
    });

    const documentId = newDocumentWithChat.documentId;
    console.log("Created document with ID:", documentId);

    // Step 4: Generate Embeddings and Store
    const embeddings = new VertexAIEmbeddings({
      model: "text-embedding-004",
    });

    // Prepare texts and metadata - store both ways for compatibility
    const texts = splitDocs.map((doc) => doc.pageContent);
    const metadatas = splitDocs.map((doc, index) => ({
      // Store at root level
      documentId: documentId,
      userId: userId,
      pageNumber: doc.metadata.page || index,
      source: doc.metadata.source || pdfFilename,
      // Also store in metadata object for backward compatibility
      metadata: {
        ...doc.metadata,
        documentId: documentId,
        userId: userId,
      }
    }));

    console.log("Sample metadata structure:", JSON.stringify(metadatas[0], null, 2));

    // Step 5: Store in Qdrant
    const qdrantClient = new QdrantClient({
      url: process.env.QDRANT_URL!,
      apiKey: process.env.QDRANT_KEY!,
    });

    const vectorStore = await QdrantVectorStore.fromTexts(
      texts,
      metadatas,
      embeddings,
      {
        client: qdrantClient,
        collectionName: "pdf_embeddings",
      }
    );

    console.log("Embeddings successfully stored in Qdrant!");

    // Step 6: Verify storage by checking a few points
    const points = await qdrantClient.scroll('pdf_embeddings', {
      limit: 2,
      with_payload: true,
      with_vector: false,
      filter: {
        must: [
          { key: "documentId", match: { value: documentId } }
        ]
      }
    });

    console.log("Verification - stored points:", points.points.length);
    if (points.points.length > 0) {
      console.log("Sample stored payload:", JSON.stringify(points.points[0].payload, null, 2));
    }

    // Step 7: Delete the temporary file
    fs.unlink(pdfPath, (err) => {
      if (err) console.error("Error deleting file:", err);
      else console.log(`Temporary file deleted: ${pdfPath}`);
    });

    return { success: true, documentId, chunksStored: splitDocs.length };

  } catch (error) {
    console.error("Error processing file:", error);
    throw error;
  }
}