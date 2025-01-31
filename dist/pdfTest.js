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
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const pdf_1 = require("@langchain/community/document_loaders/fs/pdf");
const textsplitters_1 = require("@langchain/textsplitters");
const js_client_rest_1 = require("@qdrant/js-client-rest");
const qdrant_1 = require("@langchain/qdrant");
const google_vertexai_1 = require("@langchain/google-vertexai");
const pdfPath = "./Full_Stack_Engineer_Internship_Assignment.pdf";
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Step 1: Load PDF
            const loader = new pdf_1.PDFLoader(pdfPath);
            const docs = yield loader.load();
            console.log("Loaded Docs:", docs);
            // Step 2: Split Documents
            const textSplitter = new textsplitters_1.RecursiveCharacterTextSplitter({
                chunkSize: 1000,
                chunkOverlap: 200,
            });
            const splitDocs = yield textSplitter.splitDocuments(docs);
            console.log("Split Docs:", splitDocs);
            // Step 3: Extract Text and Metadata
            const texts = splitDocs.map((doc) => doc.pageContent);
            const metadata = splitDocs.map((doc) => doc.metadata);
            const embeddings = new google_vertexai_1.VertexAIEmbeddings({
                model: "text-embedding-004",
            });
            // Step 5: Store Embeddings in Qdrant
            const vectorStore = yield qdrant_1.QdrantVectorStore.fromTexts(texts, metadata, embeddings, {
                client: new js_client_rest_1.QdrantClient({
                    url: 'https://9998d475-d66e-4dfc-b5fb-4da33df563b5.us-east4-0.gcp.cloud.qdrant.io:6333',
                    apiKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIiwiZXhwIjoxNzQ2MDQyMzMxfQ.IhRRIbkJnYe6nuN6byTr9QZZIBOTnZEGlQItegeJj8M'
                }),
                collectionName: "gemini_embeddings",
            });
            console.log("Embeddings successfully stored in Qdrant!");
        }
        catch (error) {
            console.error("Error processing file:", error);
        }
    });
}
