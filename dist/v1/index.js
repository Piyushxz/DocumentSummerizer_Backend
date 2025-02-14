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
const js_client_rest_1 = require("@qdrant/js-client-rest");
const dotenv_1 = __importDefault(require("dotenv"));
const userMiddleware_1 = __importDefault(require("../middlewares/userMiddleware"));
const client = new client_1.PrismaClient();
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
            collectionName: "pdf_embeddings",
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
        res.status(200).json({ message: "Signed in", token: token, username: foundUser.username });
    }
    catch (e) {
        res.status(500).json({ message: "server erro" });
    }
}));
exports.v1Router.get("/documents", userMiddleware_1.default, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.userId;
    try {
        const documents = yield client.document.findMany({
            where: {
                userId: userId
            },
            orderBy: {
                uploadedAt: 'asc'
            }
        });
        res.status(200).json({ documents });
    }
    catch (err) {
        res.status(500).json({ message: "Error getting documents" });
        console.log(err);
    }
}));
exports.v1Router.delete("/documents", userMiddleware_1.default, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.userId;
    const documentId = req.body.documentId;
    if (!documentId) {
        res.status(400).json({ message: "documentId is required" });
        return;
    }
    try {
        const deleteDoc = yield client.document.delete({
            where: { userId, documentId }
        });
        const qdrantClient = new js_client_rest_1.QdrantClient({
            url: process.env.QDRANT_URL,
            apiKey: process.env.QDRANT_KEY,
        });
        const deleteVectors = yield qdrantClient.delete("pdf_embeddings", {
            filter: {
                must: [{ key: "metadata.documentId", match: { value: documentId } }],
            },
        });
        res.status(200).json({
            message: "Document and embeddings deleted successfully",
        });
    }
    catch (err) {
        console.error("Error deleting document:", err);
        res.status(500).json({ message: "Could not delete documents" });
    }
}));
exports.v1Router.get('/history/:queryRoomID', userMiddleware_1.default, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.userId;
    const roomID = Number(req.params.queryRoomID);
    try {
        const messages = yield client.message.findMany({
            where: {
                QuerieID: roomID,
                queries: {
                    userId: userId
                },
            },
            orderBy: {
                createdAt: 'asc'
            },
            take: 50
        });
        res.status(200).json({ messages });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ message: "Could not find chats / server error" });
    }
}));
exports.v1Router.post('/favourite', userMiddleware_1.default, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userID = req.userId;
    const document = req.body.document;
    try {
        if (!userID || !document) {
            res.status(401).json({ message: "Selected a valid token/DocumentID" });
            return;
        }
        const existingDoc = yield client.document.findUnique({
            where: {
                userId: userID,
                documentId: document
            },
            select: { isArchived: true, documentName: true },
        });
        if (!existingDoc) {
            res.status(404).json({ message: "Document not found" });
            return;
        }
        const doc = yield client.document.update({
            data: {
                isArchived: !existingDoc.isArchived
            },
            where: {
                userId: userID,
                documentId: document
            }
        });
        res.status(201).json({ message: `${doc.documentName} has been updated` });
    }
    catch (_a) {
        res.status(500).json({ message: "Could not update document" });
    }
}));
exports.v1Router.get('/favourite', userMiddleware_1.default, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userID = req.userId;
    try {
        if (!userID) {
            res.status(403).json({ message: "Invalid token" });
            return;
        }
        const documents = yield client.document.findMany({
            where: {
                userId: userID,
                isArchived: true
            },
            orderBy: {
                uploadedAt: 'asc'
            }
        });
        res.status(201).json({ documents });
    }
    catch (err) {
        res.status(500).json({ err: "Error getting archived documents" });
    }
}));
exports.v1Router.post("/upload", upload_1.default.single("file"), userMiddleware_1.default, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.userId;
    const documentName = req.body.documentName;
    if (!userId || !documentName) {
        res.status(404).json({ message: "Invalid Token or no document name" });
        return;
    }
    try {
        if (!req.file) {
            res.status(400).json({ error: "No file uploaded" });
            return;
        }
        const filePath = req.file.path;
        const fileName = path_1.default.basename(filePath);
        yield (0, processAndStorePdf_1.processAndStorePdf)(fileName, userId, documentName);
        res.json({ message: "File processed successfully!" });
    }
    catch (error) {
        console.error("Error processing file:", error);
        res.status(500).json({ error: "Error processing file" });
    }
}));
exports.v1Router.post('/query/:documentId', userMiddleware_1.default, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { query } = req.body;
    const documentId = req.params.documentId;
    const userId = req.userId;
    if (!query || !userId) {
        res.status(400).json({ message: "Query is required" });
        return;
    }
    console.log(documentId, userId);
    try {
        const embeddedQuery = yield exports.embeddings.embedQuery(query);
        const vecStore = yield vectorStore();
        const filter = {
            must: [
                { key: "metadata.documentId", match: { value: documentId } },
                { key: "metadata.userId", match: { value: userId } }
            ]
        };
        const result = yield vecStore.similaritySearchVectorWithScore(embeddedQuery, 5, filter);
        console.log("results", result);
        const contextFromSearch = result
            .map(item => { var _a; return (_a = item[0]) === null || _a === void 0 ? void 0 : _a.pageContent; })
            .filter(content => content)
            .join("\n");
        console.log("Context From Search:", contextFromSearch);
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
        //   const QueryRoom = await client.queries.findFirst({where:{docId:documentId}})
        //      if(!QueryRoom){
        //          res.status(500).json({message:"Could not find query room"})
        //         return;
        //     }
        //   await client.message.createMany({
        //      data:[
        //          {sentBy:"User",content:query,QuerieID:QueryRoom.id},
        //         {sentBy:"Bot",content:response.content,QuerieID:QueryRoom.id}
        //      ]
        //   })
        res.status(200).json({ answer: response.content, results: result });
    }
    catch (error) {
        console.error("Error in query:", error);
        res.status(500).json({ message: "Error searchinf" });
    }
}));
