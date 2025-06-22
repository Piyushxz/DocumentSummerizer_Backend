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
exports.processAndStorePdf = processAndStorePdf;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const pdf_1 = require("@langchain/community/document_loaders/fs/pdf");
const textsplitters_1 = require("@langchain/textsplitters");
const js_client_rest_1 = require("@qdrant/js-client-rest");
const qdrant_1 = require("@langchain/qdrant");
const google_vertexai_1 = require("@langchain/google-vertexai");
const client_1 = require("@prisma/client");
const tempDir = path_1.default.resolve(__dirname, "../temp");
if (!fs_1.default.existsSync(tempDir)) {
    fs_1.default.mkdirSync(tempDir, { recursive: true });
}
const client = new client_1.PrismaClient();
function processAndStorePdf(pdfFilename, userId, documentName) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const pdfPath = path_1.default.join(tempDir, pdfFilename);
            if (!fs_1.default.existsSync(pdfPath)) {
                throw new Error(`File not found: ${pdfPath}`);
            }
            console.log(`Processing file: ${pdfPath}`);
            // Step 1: Load PDF
            const loader = new pdf_1.PDFLoader(pdfPath);
            const docs = yield loader.load();
            console.log("Loaded Docs:", docs.length);
            // Step 2: Split Documents
            const textSplitter = new textsplitters_1.RecursiveCharacterTextSplitter({
                chunkSize: 1000,
                chunkOverlap: 200,
            });
            const splitDocs = yield textSplitter.splitDocuments(docs);
            console.log("Split Docs:", splitDocs.length);
            // Step 3: Create document in database first
            const newDocumentWithChat = yield client.document.create({
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
            const embeddings = new google_vertexai_1.VertexAIEmbeddings({
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
                metadata: Object.assign(Object.assign({}, doc.metadata), { documentId: documentId, userId: userId })
            }));
            console.log("Sample metadata structure:", JSON.stringify(metadatas[0], null, 2));
            // Step 5: Store in Qdrant
            const qdrantClient = new js_client_rest_1.QdrantClient({
                url: process.env.QDRANT_URL,
                apiKey: process.env.QDRANT_KEY,
            });
            const vectorStore = yield qdrant_1.QdrantVectorStore.fromTexts(texts, metadatas, embeddings, {
                client: qdrantClient,
                collectionName: "pdf_embeddings",
            });
            console.log("Embeddings successfully stored in Qdrant!");
            // Step 6: Verify storage by checking a few points
            const points = yield qdrantClient.scroll('pdf_embeddings', {
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
            fs_1.default.unlink(pdfPath, (err) => {
                if (err)
                    console.error("Error deleting file:", err);
                else
                    console.log(`Temporary file deleted: ${pdfPath}`);
            });
            return { success: true, documentId, chunksStored: splitDocs.length };
        }
        catch (error) {
            console.error("Error processing file:", error);
            throw error;
        }
    });
}
