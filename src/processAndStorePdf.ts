import fs from "fs";
import path from "path";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { QdrantClient } from "@qdrant/js-client-rest";
import { QdrantVectorStore } from "@langchain/qdrant";
import { VertexAIEmbeddings } from "@langchain/google-vertexai";

// Define the temporary directory
const tempDir = "./folder";

export async function processAndStorePdf(pdfFilename:string) {
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
    console.log("Loaded Docs:", docs);

    // Step 2: Split Documents
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const splitDocs = await textSplitter.splitDocuments(docs);
    console.log("Split Docs:", splitDocs);

    // Step 3: Extract Text and Metadata
    const texts = splitDocs.map((doc) => doc.pageContent);
    const metadata = splitDocs.map((doc) => doc.metadata);

    // Step 4: Generate Embeddings
    const embeddings = new VertexAIEmbeddings({
      model: "text-embedding-004",
    });

    // Step 5: Store Embeddings in Qdrant
    const vectorStore = await QdrantVectorStore.fromTexts(
      texts,
      metadata,
      embeddings,
      {
        client: new QdrantClient({
          url: process.env.QDRANT_URL,
          apiKey: process.env.QDRANT_KEY,
        }),
        collectionName: "gemini_embeddings",
      }
    );

    console.log("Embeddings successfully stored in Qdrant!");

    // Step 6: Delete the file after processing
    fs.unlink(pdfPath, (err) => {
      if (err) console.error("Error deleting file:", err);
      else console.log(`Temporary file deleted: ${pdfPath}`);
    });

  } catch (error) {
    console.error("Error processing file:", error);
  }
}
