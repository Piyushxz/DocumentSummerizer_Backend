"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const v1_1 = require("./v1");
const dotenv_1 = __importDefault(require("dotenv"));
const pdfTest_1 = require("./pdfTest");
const google_vertexai_1 = require("@langchain/google-vertexai");
const google_vertexai_2 = require("@langchain/google-vertexai");
const js_client_rest_1 = require("@qdrant/js-client-rest");
const llm = new google_vertexai_1.ChatVertexAI({
    model: "gemini-1.5-flash",
    temperature: 0,
    apiKey: process.env.GEMINI_API
});
const embeddings = new google_vertexai_2.VertexAIEmbeddings({
    model: "text-embedding-004"
});
const client = new js_client_rest_1.QdrantClient({
    url: 'https://9998d475-d66e-4dfc-b5fb-4da33df563b5.us-east4-0.gcp.cloud.qdrant.io:6333',
    apiKey: process.env.QDRANT_KEY
});
const app = (0, express_1.default)();
app.use(express_1.default.json());
dotenv_1.default.config();
app.use('/api/v1', v1_1.v1Router);
(0, pdfTest_1.main)();
app.listen(3003, () => {
    console.log('server running');
    console.log(process.env.QDRANT_URL, process.env.QDRANT_KEY);
});
