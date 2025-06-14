import { Router } from "express";
import z from 'zod'
import { PrismaClient } from "@prisma/client";
import bcryptjs from 'bcryptjs'
export const v1Router = Router()
import jwt from 'jsonwebtoken'
import { GoogleAuth } from 'google-auth-library';
import { ChatVertexAI, VertexAI } from "@langchain/google-vertexai";
import { VertexAIEmbeddings } from "@langchain/google-vertexai";
import { QdrantVectorStore } from "@langchain/qdrant";
import { pull } from "langchain/hub";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import upload from "../upload";
import { processAndStorePdf } from "../processAndStorePdf";
import path from "path";
import { QdrantClient } from "@qdrant/js-client-rest";
import dotenv from "dotenv"
import userMiddleware from "../middlewares/userMiddleware";
import { createQdrantIndex } from "../utils";

const client = new PrismaClient()
dotenv.config()

//  OPTIMIZED LLM CONFIGURATION 
// Smart token management for cost efficiency while maintaining quality
const createOptimizedLLM = (queryLength:any, contextLength = 0) => {
    // More generous token allocation to prevent cutoff
    let maxTokens;
    
    // Consider both query length and context size
    const totalInputSize = queryLength + contextLength;
    
    if (queryLength < 30 && totalInputSize < 500) {
        maxTokens = 800; // Increased from 400
    } else if (queryLength < 100 && totalInputSize < 1500) {
        maxTokens = 1500; // Increased from 800
    } else if (totalInputSize < 3000) {
        maxTokens = 2000; // Increased from 1200
    } else {
        maxTokens = 2500; // For very complex queries
    }

    return new ChatVertexAI({
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
const createSmartPrompt = (documentName : any, contextFromSearch : any, query : any, queryType : any) => {
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
const detectQueryType = (query : any) => {
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

const getCachedResponse = (cacheKey:any) => {
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
        return cached.response;
    }
    responseCache.delete(cacheKey);
    return null;
};

const setCachedResponse = (cacheKey:any, response:any) => {
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

const trackUsage = (inputTokens:any, outputTokens:any) => {
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
v1Router.get('/',(req,res)=>{
    res.json("Hey")
})

const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    credentials :process.env.GOOGLE_APPLICATION_CREDENTIALS
});

export const embeddings = new VertexAIEmbeddings({
    model: "text-embedding-004",
});

async function vectorStore() {
    const vecStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
        url: process.env.QDRANT_URL,
        collectionName: "pdf_embeddings",
        apiKey: process.env.QDRANT_KEY
    });
    return vecStore
}

const prismaClient = new PrismaClient();

// USER AUTHENTICATION 
v1Router.post('/user/signup',async (req,res)=>{
    const requiredBody = z.object({
        username:z.string().min(5).max(10),
        email:z.string().email(),
        password:z.string().min(5).max(50)
    })

    const parsedBody = requiredBody.safeParse(req.body)

    if(!parsedBody.success){
        res.status(400).json({message:"Invalid Format!"})
        return;
    }
    const hashedPassword = await bcryptjs.hash(parsedBody.data.password,5)

    try{
        await prismaClient.user.create({
            data:{
                username:parsedBody.data.username,
                email : parsedBody.data.email,
                password : hashedPassword
            }
        })
        res.status(201).json({message:"User created"})
    }catch(e){
        res.status(500).json({message:"Server error"})
        console.log(e)
    }
})

v1Router.post('/user/signin',async (req,res)=>{
    const {username,password} = req.body;
    let foundUser = null;

    try{
        foundUser = await prismaClient.user.findFirst({
            where:{
                username : username,
            }
        })

        if(!foundUser){
            res.status(404).json({message:'User does not exist'})
            return;
        }

        const validPassword = await bcryptjs.compare(password,foundUser.password)

        if(!validPassword){
            res.status(401).json({message:'Invalid Password'})
            return;
        }

        const token = jwt.sign({id:foundUser.id},process.env.SECRET_KEY);
        res.status(200).json({message:"Signed in", token : token,username:foundUser.username})
        
    }catch(e){
        res.status(500).json({message:"server erro"})
    }
})

//  DOCUMENT MANAGEMENT 

v1Router.get("/documents",userMiddleware,async (req,res)=>{
    const userId = req.userId;

    try{
        const documents = await client.document.findMany({
            where:{
                userId:userId
            },
            orderBy:{
                uploadedAt:'asc'
            }
        }) 
        res.status(200).json({documents})
    }catch(err) {   
        res.status(500).json({message:"Error getting documents"})
        console.log(err)
    }
})

v1Router.delete("/documents", userMiddleware, async (req, res) => {
    const userId = req.userId;
    const documentId = req.body.documentId;

    if (!documentId) {
        res.status(400).json({ message: "documentId is required" });
        return;
    }

    try {
        const document = await client.document.findFirst({
            where: { userId, documentId }
        });

        if (!document) {
            res.status(404).json({ message: "Document not found or access denied" });
            return;
        }

        await client.document.delete({
            where: { userId, documentId }
        });

        const qdrantClient = new QdrantClient({
            url: process.env.QDRANT_URL,
            apiKey: process.env.QDRANT_KEY,
        });

        try {
            await qdrantClient.delete("pdf_embeddings", {
                filter: {
                    must: [{ key: "metadata.documentId", match: { value: documentId } }],
                },
            });
            console.log("✅ Direct filter delete successful");
            
        } catch (filterError) {
            console.log("❌ Direct filter delete failed, using scroll method:");
            
            let deletedCount = 0;
            let offset = null;
            
            do {
                const scrollResult = await qdrantClient.scroll("pdf_embeddings", {
                    limit: 100,
                    offset: offset,
                    with_payload: true,
                    with_vector: false
                });

                const pointsToDelete = scrollResult.points
                    .filter(point => {
                        const metadata = point.payload?.metadata || point.payload;
                        return metadata && (
                            //@ts-ignore
                            metadata.documentId === documentId 
                        );
                    })
                    .map(point => point.id); 

                if (pointsToDelete.length > 0) {
                    await qdrantClient.delete("pdf_embeddings", {
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
            const queryRoom = await client.queries.findFirst({
                where: { docId: documentId }
            });

            if (queryRoom) {
                await client.message.deleteMany({
                    where: { QuerieID: queryRoom.id }
                });

                await client.queries.delete({
                    where: { id: queryRoom.id }
                });

                console.log("✅ Cleaned up query room and messages");
            }
        } catch (cleanupError) {
            console.warn("Warning: Could not clean up query room:");
        }

        res.status(200).json({
            message: "Document and embeddings deleted successfully",
            documentName: document.documentName
        });

    } catch (err) {
        console.error("Error deleting document:", err);
        res.status(500).json({ 
            message: "Could not delete document"
        });
    }
});

v1Router.get('/history/:docId',userMiddleware,async (req,res)=>{
    const userId = req.userId;
    const docId = req.params.docId

    try{
        const QueryRoomID = await client.queries.findFirst({
            where:{
                docId:docId
            }
        })
        const messages = await client.message.findMany({
            where:{
                QuerieID:QueryRoomID?.id,
                queries:{
                    userId:userId
                },
            },
            orderBy:{
                createdAt:'asc'
            },
            take:50
        })

        res.status(200).json({messages})
    }
    catch(err){
        console.log(err)
        res.status(500).json({message:"Could not find chats / server error"})
    }
})

v1Router.post('/favourite',userMiddleware,async (req,res)=>{
    const userID = req.userId;
    const document = req.body.document

    try{
        if(!userID || !document){
            res.status(401).json({message:"Selected a valid token/DocumentID"})
            return;
        }

        const existingDoc = await client.document.findUnique({
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
        
        const doc = await client.document.update({
            data:{
                isArchived: !existingDoc.isArchived
            },
            where:{
                userId:userID,
                documentId:document
            }
        })

        res.status(201).json({message:`${doc.documentName} has been updated`})

    }catch{
        res.status(500).json({message:"Could not update document"})
    }
})

v1Router.get('/favourite',userMiddleware,async (req,res)=>{
    const userID = req.userId;

    try{
        if(!userID ){
            res.status(403).json({message:"Invalid token"})
            return;
        }

        const documents = await client.document.findMany({
            where:{
                userId:userID,
                isArchived:true
            },
            orderBy:{
                uploadedAt:'asc'
            }
        })

        res.status(201).json({documents})
    }
    catch(err){
        res.status(500).json({err:"Error getting archived documents"})
    }
})

v1Router.post("/upload", upload.single("file"),userMiddleware, async (req, res) => {
    const userId = req.userId
    const documentName = req.body.documentName
    
    if(!userId || !documentName){
        res.status(404).json({message:"Invalid Token or no document name"})
        return;
    }
    try {
        if (!req.file) {
           res.status(400).json({ error: "No file uploaded" });
           return
        }
    
        const filePath = req.file.path;
        const fileName = path.basename(filePath);
    
        await processAndStorePdf(fileName,userId,documentName);
        res.json({ message: "File processed successfully!" });
      } catch (error) {
        console.error("Error processing file:", error);
        res.status(500).json({ error: "Error processing file" });
      }
});

//USAGE STATS ENDPOINT 
v1Router.get('/usage-stats', userMiddleware, async (req, res) => {
    res.json({
        ...usageStats,
        estimatedCostUSD: `$${usageStats.estimatedCost.toFixed(4)}`,
        cacheHitRate: usageStats.totalQueries > 0 ? 
            `${((usageStats.cacheHits / usageStats.totalQueries) * 100).toFixed(1)}%` : '0%'
    });
});

// QUERY ENDPOINT 
v1Router.post('/query/:documentId', userMiddleware, async (req, res) => {
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
            res.status(200).json({ 
                ...cachedResponse,
                cached: true 
            });
            return;
        }

        // Verify document exists
        const document = await client.document.findFirst({
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
        const embeddedQuery = await embeddings.embedQuery(query);
        const vecStore = await vectorStore();
        
        // Reduced initial search for efficiency
        const searchResults = await vecStore.similaritySearchVectorWithScore(embeddedQuery, 12);
        
        // Post-filter and optimize
        const filteredResults = searchResults
            .filter(item => {
                const metadata = item[0]?.metadata;
                if (!metadata) return false;
                
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
            .map(item => item[0]?.pageContent)
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

        const promptTemplate = ChatPromptTemplate.fromTemplate(smartPrompt);
        const messages = await promptTemplate.invoke({ 
            document: document.documentName,
            context: contextFromSearch,
            question: query 
        });
        
        const response = await optimizedLLM.invoke(messages);
        
        // Track usage
        const inputTokens = messages.toString().split(' ').length * 0.75; // Rough estimate
        //@ts-ignore
        const outputTokens = response.content.split(' ').length * 0.75; // Rough estimate
        trackUsage(inputTokens, outputTokens);
        
        console.log(`📈 Tokens used - Input: ~${Math.round(inputTokens)}, Output: ~${Math.round(outputTokens)}`);

        // Save to database
        const QueryRoom = await client.queries.findFirst({
            where: { docId: documentId }
        });
    
        if (QueryRoom) {
            await client.message.createMany({
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

    } catch (error) {
        console.error("❌ Error in query:", error);
        res.status(500).json({ 
            message: "Error processing query"
        });
    }
});