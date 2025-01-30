import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

// Path to the PDF file (could be user-uploaded)
const pdfPath = "./Full_Stack_Engineer_Internship_Assignment.pdf";

export async function main() {
  try {
    // Step 1: Load the PDF
    const loader = new PDFLoader(pdfPath);
    const docs = await loader.load();
    console.log("Loaded Docs:", docs);

    // Step 2: Split the loaded document into chunks
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000, // Customize chunk size as needed
      chunkOverlap: 200, // Customize chunk overlap as needed
    });

    const splitDocs = await textSplitter.splitDocuments(docs);
    console.log("Split Docs:", splitDocs);

  } catch (error) {
    console.error("Error processing the PDF:", error);
  }
}

main();
