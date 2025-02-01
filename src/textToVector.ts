import fs from "fs";
import path from "path";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { QdrantClient } from "@qdrant/js-client-rest";
import { QdrantVectorStore } from "@langchain/qdrant";
import { VertexAIEmbeddings } from "@langchain/google-vertexai";
import pdf from "pdf-parse"

// Define the temporary directory correctly
const tempDir = path.resolve(__dirname, "../temp");  // Adjusted to resolve from the root folder

// Ensure tempDir exists
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Function to process the PDF, extract text, split it, generate embeddings, and store in the vector database
export async function processAndStorePdf2(pdfFilename: string) {
  try {
    // Construct the full file path
    const pdfPath = path.join(tempDir, pdfFilename);

    if (!fs.existsSync(pdfPath)) {
      throw new Error(`File not found: ${pdfPath}`);
    }

    console.log(`Processing file: ${pdfPath}`);

    // Step 1: Extract Text from the PDF (using pdf-parse or PDFLoader)
    const dataBuffer = fs.readFileSync(pdfPath); // Read PDF file into a buffer
    const pdfData = await pdf(dataBuffer); // Use pdf-parse to extract text
    const extractedText = pdfData.text;
    console.log("Extracted Text Length:", extractedText.length);

    // Step 2: Split the Extracted Text into Chunks
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const splitDocs = await textSplitter.splitDocuments([{
      pageContent: extractedText,
      metadata: { source: pdfFilename },
    }]);
    console.log("Split Docs:", splitDocs.length);

    // Step 3: Generate Embeddings using VertexAI (or any other model of choice)
    const embeddings = new VertexAIEmbeddings({
      model: "text-embedding-004",
    });

    // Step 4: Store the Generated Embeddings in Qdrant (or any other vector DB)
    const vectorStore = await QdrantVectorStore.fromTexts(
      splitDocs.map((doc) => doc.pageContent),
      splitDocs.map((doc) => doc.metadata),
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

    // Step 5: Delete the file after processing
    fs.unlink(pdfPath, (err) => {
      if (err) console.error("Error deleting file:", err);
      else console.log(`Temporary file deleted: ${pdfPath}`);
    });

  } catch (error) {
    console.error("Error processing file:", error);
  }
}
