import fs from "fs";
import pdf from "pdf-parse";

async function extractTextFromPdf(pdfPath: string): Promise<string> {
  const dataBuffer = fs.readFileSync(pdfPath); // Read PDF file into a buffer

  try {
    const data = await pdf(dataBuffer); // Parse PDF buffer
    return data.text; // Extracted text from the PDF
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    return "";
  }
}

// Example usage
const pdfPath = "./path/to/your.pdf";
extractTextFromPdf(pdfPath)
  .then((text) => {
    console.log("Extracted Text:", text);
  })
  .catch((error) => {
    console.error("Error:", error);
  });
