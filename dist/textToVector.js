"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processAndStorePdf2 = processAndStorePdf2;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const textsplitters_1 = require("@langchain/textsplitters");
const js_client_rest_1 = require("@qdrant/js-client-rest");
const qdrant_1 = require("@langchain/qdrant");
const google_vertexai_1 = require("@langchain/google-vertexai");
const pdf_parse_1 = __importDefault(require("pdf-parse"));
// Define the temporary directory correctly
const tempDir = path_1.default.resolve(__dirname, "../temp"); // Adjusted to resolve from the root folder
// Ensure tempDir exists
if (!fs_1.default.existsSync(tempDir)) {
    fs_1.default.mkdirSync(tempDir, { recursive: true });
}
// Function to process the PDF, extract text, split it, generate embeddings, and store in the vector database
function processAndStorePdf2(pdfFilename) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Construct the full file path
            const pdfPath = path_1.default.join(tempDir, pdfFilename);
            if (!fs_1.default.existsSync(pdfPath)) {
                throw new Error(`File not found: ${pdfPath}`);
            }
            console.log(`Processing file: ${pdfPath}`);
            // Step 1: Extract Text from the PDF (using pdf-parse or PDFLoader)
            const dataBuffer = fs_1.default.readFileSync(pdfPath); // Read PDF file into a buffer
            const pdfData = yield (0, pdf_parse_1.default)(dataBuffer); // Use pdf-parse to extract text
            const extractedText = pdfData.text;
            console.log("Extracted Text Length:", extractedText.length);
            // Step 2: Split the Extracted Text into Chunks
            const textSplitter = new textsplitters_1.RecursiveCharacterTextSplitter({
                chunkSize: 1000,
                chunkOverlap: 200,
            });
            const splitDocs = yield textSplitter.splitDocuments([{
                    pageContent: extractedText,
                    metadata: { source: pdfFilename },
                }]);
            console.log("Split Docs:", splitDocs.length);
            // Step 3: Generate Embeddings using VertexAI (or any other model of choice)
            const embeddings = new google_vertexai_1.VertexAIEmbeddings({
                model: "text-embedding-004",
            });
            // Step 4: Store the Generated Embeddings in Qdrant (or any other vector DB)
            const vectorStore = yield qdrant_1.QdrantVectorStore.fromTexts(splitDocs.map((doc) => doc.pageContent), splitDocs.map((doc) => doc.metadata), embeddings, {
                client: new js_client_rest_1.QdrantClient({
                    url: process.env.QDRANT_URL,
                    apiKey: process.env.QDRANT_KEY,
                }),
                collectionName: "gemini_embeddings",
            });
            console.log("Embeddings successfully stored in Qdrant!");
            // Step 5: Delete the file after processing
            fs_1.default.unlink(pdfPath, (err) => {
                if (err)
                    console.error("Error deleting file:", err);
                else
                    console.log(`Temporary file deleted: ${pdfPath}`);
            });
        }
        catch (error) {
            console.error("Error processing file:", error);
        }
    });
}
