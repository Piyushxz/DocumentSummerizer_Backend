import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { QdrantClient } from "@qdrant/js-client-rest";
import { QdrantVectorStore } from "@langchain/qdrant";
import { VertexAIEmbeddings } from "@langchain/google-vertexai";
const pdfPath = "./Full_Stack_Engineer_Internship_Assignment.pdf";

export async function processAndStorePdf() {
  try {
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
          apiKey:process.env.QDRANT_KEY
        }),
        collectionName: "gemini_embeddings",
      }
    );
    processAndStorePdf()

    console.log("Embeddings successfully stored in Qdrant!");

  } catch (error) {
    console.error("Error processing file:", error);
  }
}
