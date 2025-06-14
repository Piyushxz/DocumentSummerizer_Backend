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
const prompts_1 = require("@langchain/core/prompts");
const upload_1 = __importDefault(require("../upload"));
const processAndStorePdf_1 = require("../processAndStorePdf");
const path_1 = __importDefault(require("path"));
const js_client_rest_1 = require("@qdrant/js-client-rest");
const dotenv_1 = __importDefault(require("dotenv"));
const userMiddleware_1 = __importDefault(require("../middlewares/userMiddleware"));
const client = new client_1.PrismaClient();
dotenv_1.default.config();
//  OPTIMIZED LLM CONFIGURATION 
// Smart token management for cost efficiency while maintaining quality
const createOptimizedLLM = (queryLength, contextLength = 0) => {
    // More generous token allocation to prevent cutoff
    let maxTokens;
    // Consider both query length and context size
    const totalInputSize = queryLength + contextLength;
    if (queryLength < 30 && totalInputSize < 500) {
        maxTokens = 800; // Increased from 400
    }
    else if (queryLength < 100 && totalInputSize < 1500) {
        maxTokens = 1500; // Increased from 800
    }
    else if (totalInputSize < 3000) {
        maxTokens = 2000; // Increased from 1200
    }
    else {
        maxTokens = 2500; // For very complex queries
    }
    return new google_vertexai_1.ChatVertexAI({
        model: "gemini-1.5-flash",
        temperature: 0.6,
        maxOutputTokens: maxTokens,
        topP: 0.8,
        topK: 30,
        // Add safety settings to prevent premature stopping
        safetySettings: [
            {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_ONLY_HIGH"
            }
        ]
    });
};
//   PROMPT SYSTEM 
const createSmartPrompt = (documentName, contextFromSearch, query, queryType) => {
    // Different prompt styles based on query type
    const baseInstructions = `You are an expert document analyst. Based on the document "${documentName}", provide a helpful response.`;
    if (queryType === 'summary') {
        return `${baseInstructions}

Context: ${contextFromSearch}
Query: ${query}

Provide a well-structured summary with:
1. Key points (3-5 main ideas)
2. Important details
3. Relevant examples from the document
Keep it comprehensive but focused.`;
    }
    if (queryType === 'specific') {
        return `${baseInstructions}

Context: ${contextFromSearch}
Query: ${query}

Provide a detailed answer that:
1. Directly answers the specific question
2. Includes relevant quotes or data from the document
3. Explains the context and implications
Focus on accuracy and specific details.`;
    }
    // Default detailed prompt
    return `${baseInstructions}

Context: ${contextFromSearch}
Query: ${query}

Provide a comprehensive response that:
1. Thoroughly addresses the question
2. Uses specific examples from the document
3. Explains concepts clearly
4. Includes relevant details and context
Structure your response logically and be thorough but concise.`;
};
// ============ SMART QUERY TYPE DETECTION ============
const detectQueryType = (query) => {
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('summary') || lowerQuery.includes('overview') ||
        lowerQuery.includes('main points') || lowerQuery.includes('key')) {
        return 'summary';
    }
    if (lowerQuery.includes('what is') || lowerQuery.includes('how much') ||
        lowerQuery.includes('when') || lowerQuery.includes('where') ||
        lowerQuery.includes('specific') || lowerQuery.includes('exact')) {
        return 'specific';
    }
    return 'detailed';
};
// ============ RESPONSE CACHING SYSTEM ============
const responseCache = new Map();
const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes
const getCachedResponse = (cacheKey) => {
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
        return cached.response;
    }
    responseCache.delete(cacheKey);
    return null;
};
const setCachedResponse = (cacheKey, response) => {
    responseCache.set(cacheKey, {
        response,
        timestamp: Date.now()
    });
    // Cleanup old cache entries (keep max 100)
    if (responseCache.size > 100) {
        const oldestKey = responseCache.keys().next().value;
        responseCache.delete(oldestKey);
    }
};
// ============ USAGE TRACKING ============
let usageStats = {
    totalQueries: 0,
    totalTokensUsed: 0,
    averageTokensPerQuery: 0,
    cacheHits: 0,
    estimatedCost: 0,
    lastReset: Date.now()
};
const trackUsage = (inputTokens, outputTokens) => {
    const totalTokens = inputTokens + outputTokens;
    usageStats.totalQueries++;
    usageStats.totalTokensUsed += totalTokens;
    usageStats.averageTokensPerQuery = usageStats.totalTokensUsed / usageStats.totalQueries;
    // Rough cost calculation (Gemini 1.5 Flash pricing)
    const inputCost = (inputTokens / 1000000) * 0.075;
    const outputCost = (outputTokens / 1000000) * 0.30;
    usageStats.estimatedCost += inputCost + outputCost;
};
// ROUTER CODE 
exports.v1Router.get('/', (req, res) => {
    res.json("Hey");
});
const auth = new google_auth_library_1.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS
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
// USER AUTHENTICATION 
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
//  DOCUMENT MANAGEMENT 
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
        const document = yield client.document.findFirst({
            where: { userId, documentId }
        });
        if (!document) {
            res.status(404).json({ message: "Document not found or access denied" });
            return;
        }
        yield client.document.delete({
            where: { userId, documentId }
        });
        const qdrantClient = new js_client_rest_1.QdrantClient({
            url: process.env.QDRANT_URL,
            apiKey: process.env.QDRANT_KEY,
        });
        try {
            yield qdrantClient.delete("pdf_embeddings", {
                filter: {
                    must: [{ key: "metadata.documentId", match: { value: documentId } }],
                },
            });
            console.log("✅ Direct filter delete successful");
        }
        catch (filterError) {
            console.log("❌ Direct filter delete failed, using scroll method:");
            let deletedCount = 0;
            let offset = null;
            do {
                const scrollResult = yield qdrantClient.scroll("pdf_embeddings", {
                    limit: 100,
                    offset: offset,
                    with_payload: true,
                    with_vector: false
                });
                const pointsToDelete = scrollResult.points
                    .filter(point => {
                    var _a;
                    const metadata = ((_a = point.payload) === null || _a === void 0 ? void 0 : _a.metadata) || point.payload;
                    return metadata && (
                    //@ts-ignore
                    metadata.documentId === documentId);
                })
                    .map(point => point.id);
                if (pointsToDelete.length > 0) {
                    yield qdrantClient.delete("pdf_embeddings", {
                        points: pointsToDelete
                    });
                    deletedCount += pointsToDelete.length;
                    console.log(`Deleted ${pointsToDelete.length} embeddings`);
                }
                offset = scrollResult.next_page_offset;
            } while (offset);
            console.log(`✅ Total embeddings deleted: ${deletedCount}`);
        }
        try {
            const queryRoom = yield client.queries.findFirst({
                where: { docId: documentId }
            });
            if (queryRoom) {
                yield client.message.deleteMany({
                    where: { QuerieID: queryRoom.id }
                });
                yield client.queries.delete({
                    where: { id: queryRoom.id }
                });
                console.log("✅ Cleaned up query room and messages");
            }
        }
        catch (cleanupError) {
            console.warn("Warning: Could not clean up query room:");
        }
        res.status(200).json({
            message: "Document and embeddings deleted successfully",
            documentName: document.documentName
        });
    }
    catch (err) {
        console.error("Error deleting document:", err);
        res.status(500).json({
            message: "Could not delete document"
        });
    }
}));
exports.v1Router.get('/history/:docId', userMiddleware_1.default, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.userId;
    const docId = req.params.docId;
    try {
        const QueryRoomID = yield client.queries.findFirst({
            where: {
                docId: docId
            }
        });
        const messages = yield client.message.findMany({
            where: {
                QuerieID: QueryRoomID === null || QueryRoomID === void 0 ? void 0 : QueryRoomID.id,
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
//USAGE STATS ENDPOINT 
exports.v1Router.get('/usage-stats', userMiddleware_1.default, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.json(Object.assign(Object.assign({}, usageStats), { estimatedCostUSD: `$${usageStats.estimatedCost.toFixed(4)}`, cacheHitRate: usageStats.totalQueries > 0 ?
            `${((usageStats.cacheHits / usageStats.totalQueries) * 100).toFixed(1)}%` : '0%' }));
}));
// QUERY ENDPOINT 
exports.v1Router.post('/query/:documentId', userMiddleware_1.default, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { query } = req.body;
    const documentId = req.params.documentId;
    const userId = req.userId;
    if (!query || !userId) {
        res.status(400).json({ message: "Query and valid token are required" });
        return;
    }
    console.log(`🔍 Querying document: ${documentId} for user: ${userId}`);
    try {
        // Check cache first
        const cacheKey = `${documentId}-${userId}-${query.toLowerCase().trim()}`;
        const cachedResponse = getCachedResponse(cacheKey);
        if (cachedResponse) {
            console.log("Cache hit - returning cached response");
            usageStats.cacheHits++;
            res.status(200).json(Object.assign(Object.assign({}, cachedResponse), { cached: true }));
            return;
        }
        // Verify document exists
        const document = yield client.document.findFirst({
            where: {
                documentId: documentId,
                userId: userId
            }
        });
        if (!document) {
            res.status(404).json({ message: "Document not found or access denied" });
            return;
        }
        // Get embeddings and search (optimized chunk selection)
        const embeddedQuery = yield exports.embeddings.embedQuery(query);
        const vecStore = yield vectorStore();
        // Reduced initial search for efficiency
        const searchResults = yield vecStore.similaritySearchVectorWithScore(embeddedQuery, 12);
        // Post-filter and optimize
        const filteredResults = searchResults
            .filter(item => {
            var _a;
            const metadata = (_a = item[0]) === null || _a === void 0 ? void 0 : _a.metadata;
            if (!metadata)
                return false;
            const docMatches = metadata.documentId === documentId ||
                metadata.doc_id === documentId ||
                metadata.docId === documentId;
            const userMatches = metadata.userId === userId ||
                metadata.user_id === userId ||
                metadata.uid === userId;
            return docMatches && userMatches && item[1] < 0.7; // Stricter similarity threshold
        })
            .slice(0, 4); // Reduced from 6 to 4 chunks
        console.log(`📊 Found ${filteredResults.length} relevant chunks`);
        if (!filteredResults || filteredResults.length === 0) {
            res.status(404).json({
                message: "No relevant content found for this document"
            });
            return;
        }
        // Build optimized context
        const contextFromSearch = filteredResults
            .map(item => { var _a; return (_a = item[0]) === null || _a === void 0 ? void 0 : _a.pageContent; })
            .filter(content => content && content.trim().length > 20)
            .join("\n\n");
        if (!contextFromSearch.trim()) {
            res.status(404).json({
                message: "No sufficiently relevant content found for this query"
            });
            return;
        }
        // Smart prompt and LLM selection
        const queryType = detectQueryType(query);
        const smartPrompt = createSmartPrompt(document.documentName, contextFromSearch, query, queryType);
        const optimizedLLM = createOptimizedLLM(query.length);
        console.log(`🤖 Using ${queryType} prompt with max ${optimizedLLM.maxOutputTokens} tokens`);
        const promptTemplate = prompts_1.ChatPromptTemplate.fromTemplate(smartPrompt);
        const messages = yield promptTemplate.invoke({
            document: document.documentName,
            context: contextFromSearch,
            question: query
        });
        const response = yield optimizedLLM.invoke(messages);
        // Track usage
        const inputTokens = messages.toString().split(' ').length * 0.75; // Rough estimate
        //@ts-ignore
        const outputTokens = response.content.split(' ').length * 0.75; // Rough estimate
        trackUsage(inputTokens, outputTokens);
        console.log(`📈 Tokens used - Input: ~${Math.round(inputTokens)}, Output: ~${Math.round(outputTokens)}`);
        // Save to database
        const QueryRoom = yield client.queries.findFirst({
            where: { docId: documentId }
        });
        if (QueryRoom) {
            yield client.message.createMany({
                data: [
                    { sentBy: "User", content: query, QuerieID: QueryRoom.id },
                    { sentBy: "Bot", content: response.content, QuerieID: QueryRoom.id }
                ]
            });
        }
        // Prepare response
        const responseData = {
            answer: response.content,
            sourceChunks: filteredResults.length,
            documentName: document.documentName,
            queryType: queryType,
            tokensUsed: Math.round(inputTokens + outputTokens),
            cached: false
        };
        // Cache the response
        setCachedResponse(cacheKey, responseData);
        res.status(200).json(responseData);
    }
    catch (error) {
        console.error("❌ Error in query:", error);
        res.status(500).json({
            message: "Error processing query"
        });
    }
}));
