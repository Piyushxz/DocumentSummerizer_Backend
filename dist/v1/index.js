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
exports.embeddings = exports.v1Router = void 0;
const express_1 = require("express");
const zod_1 = __importDefault(require("zod"));
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
exports.v1Router = (0, express_1.Router)();
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const google_auth_library_1 = require("google-auth-library");
const google_vertexai_1 = require("@langchain/google-vertexai");
const google_vertexai_2 = require("@langchain/google-vertexai");
const qdrant_1 = require("@langchain/qdrant");
const hub_1 = require("langchain/hub");
const upload_1 = __importDefault(require("../upload"));
const processAndStorePdf_1 = require("../processAndStorePdf");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.v1Router.get('/', (req, res) => {
    res.json("Hey");
});
const auth = new google_auth_library_1.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS
});
const llm = new google_vertexai_1.ChatVertexAI({
    model: "gemini-1.5-flash",
    temperature: 0,
});
exports.embeddings = new google_vertexai_2.VertexAIEmbeddings({
    model: "text-embedding-004",
});
function vectorStore() {
    return __awaiter(this, void 0, void 0, function* () {
        const vecStore = yield qdrant_1.QdrantVectorStore.fromExistingCollection(exports.embeddings, {
            url: process.env.QDRANT_URL,
            collectionName: "gemini_embeddings",
            apiKey: process.env.QDRANT_KEY
        });
        return vecStore;
    });
}
const prismaClient = new client_1.PrismaClient();
exports.v1Router.post('/user/signup', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const requiredBody = zod_1.default.object({
        username: zod_1.default.string().min(5).max(10),
        email: zod_1.default.string().email(),
        password: zod_1.default.string().min(5).max(50)
    });
    const parsedBody = requiredBody.safeParse(req.body);
    if (!parsedBody.success) {
        res.status(400).json({ message: "Invalid Format!" });
        return;
    }
    const hashedPassword = yield bcryptjs_1.default.hash(parsedBody.data.password, 5);
    try {
        yield prismaClient.user.create({
            data: {
                username: parsedBody.data.username,
                email: parsedBody.data.email,
                password: hashedPassword
            }
        });
        res.status(201).json({ message: "User created" });
    }
    catch (e) {
        res.status(500).json({ message: "Server error" });
        console.log(e);
    }
}));
exports.v1Router.post('/user/signin', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password } = req.body;
    let foundUser = null;
    try {
        foundUser = yield prismaClient.user.findFirst({
            where: {
                username: username,
            }
        });
        if (!foundUser) {
            res.status(404).json({ message: 'User does not exist' });
            return;
        }
        const validPassword = yield bcryptjs_1.default.compare(password, foundUser.password);
        if (!validPassword) {
            res.status(401).json({ message: 'Invalid Password' });
            return;
        }
        const token = jsonwebtoken_1.default.sign({ id: foundUser.id }, process.env.SECRET_KEY);
        res.status(200).json({ message: "Signed in", token: token });
    }
    catch (e) {
        res.status(500).json({ message: "server erro" });
    }
}));
exports.v1Router.post("/upload", upload_1.default.single("file"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.file) {
            res.status(400).json({ error: "No file uploaded" });
            return;
        }
        const filePath = req.file.path;
        const fileName = path_1.default.basename(filePath);
        yield (0, processAndStorePdf_1.processAndStorePdf)(fileName);
        // Delete the file after processing
        fs_1.default.unlink(filePath, (err) => {
            if (err)
                console.error("Error deleting file:", err);
            else
                console.log("Temporary file deleted:", filePath);
        });
        res.json({ message: "File processed successfully!" });
    }
    catch (error) {
        res.status(500).json({ error: "Error processing file" });
    }
}));
exports.v1Router.post('/query', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { query } = req.body; // Get the query from the request body
    try {
        // Step 1: Embed the query using the embeddings model
        const embeddedQuery = yield exports.embeddings.embedQuery(query);
        // Step 2: Perform similarity search on the vector store with the embedded query
        const vecStore = yield vectorStore(); // Ensure the vector store is set up correctly
        const result = yield vecStore.similaritySearchVectorWithScore(embeddedQuery, 5); // Fetch top 5 results with scores
        console.log("results", result);
        // Extract the pageContent from the result
        const contextFromSearch = result
            .map(item => { var _a; return (_a = item[0]) === null || _a === void 0 ? void 0 : _a.pageContent; }) // item[0] is the Document object
            .filter(content => content) // Filter out any undefined content
            .join("\n"); // Combine the page content into a single string
        console.log("Context From Search:", contextFromSearch);
        // Step 4: Combine the context into a final full context string
        const fullContext = `\n${contextFromSearch}`;
        console.log("Full Context:", fullContext);
        const supportPrompt = `
      Context: ${fullContext}\n\n
      Query: ${query}\n\n
      Answer the question based on the provided document. If necessary, enhance your response with general knowledge, 
      but prioritize the information from the document.
    `;
        const promptTemplate = yield (0, hub_1.pull)("rlm/rag-prompt");
        const messages = yield promptTemplate.invoke({ question: query, context: supportPrompt });
        const response = yield llm.invoke(messages);
        console.log("Answer Result:", response.content);
        // Step 8: Send back the generated answer and search results as response
        res.status(200).json({ answer: response.content, results: result });
    }
    catch (error) {
        console.error("Error in query:", error);
        res.status(500).json({ message: "Error searchinf" });
    }
}));
