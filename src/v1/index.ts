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


const client = new PrismaClient()
dotenv.config()





v1Router.get('/',(req,res)=>{
    res.json("Hey")
})



const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    credentials :process.env.GOOGLE_APPLICATION_CREDENTIALS
});

const llm = new ChatVertexAI({
    model: "gemini-1.5-flash",
    temperature: 0,
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

    }catch(err)
    {   
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
         const deleteDoc = await client.document.delete({
             where: { userId, documentId }
         });

        const qdrantClient = new QdrantClient({
            url: process.env.QDRANT_URL!,
            apiKey: process.env.QDRANT_KEY!,
        });

        const deleteVectors = await qdrantClient.delete("pdf_embeddings", {
            filter: {
                must: [{ key: "metadata.documentId", match: { value: documentId } }],
            },
        });

        res.status(200).json({
            message: "Document and embeddings deleted successfully",
        });

    } catch (err) {
        console.error("Error deleting document:", err);
        res.status(500).json({ message: "Could not delete documents" });
    }
});

v1Router.get('/history/:queryRoomID',userMiddleware,async (req,res)=>{
    const userId = req.userId;
    const roomID = Number(req.params.queryRoomID)


    try{
        const messages = await client.message.findMany({
            where:{
                QuerieID:roomID,
                queries:{
                    userId:userId
                },
                
                
            },
            orderBy:{
                createdAt:'asc'
            },
            take:50
            
            
        },
    
        )

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

v1Router.post('/query/:documentId',userMiddleware, async (req, res) => {
    const { query } = req.body; 
    const documentId = req.params.documentId
    const userId = req.userId
    if (!query || !userId) {
         res.status(400).json({ message: "Query is required" });
         return
    }
    
    console.log(documentId,userId)
  
    try {
      const embeddedQuery = await embeddings.embedQuery(query);
  
      const vecStore = await vectorStore(); 
      const filter = {
        must: [
          { key: "metadata.documentId", match: { value:documentId } },
          { key: "metadata.userId", match: { value: userId } }
        ]
      };
      const result = await vecStore.similaritySearchVectorWithScore(embeddedQuery, 5,filter); 
      
      console.log("results",result)
      const contextFromSearch = result
        .map(item => item[0]?.pageContent) 
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
      
      const promptTemplate = await pull<ChatPromptTemplate>("rlm/rag-prompt");

      const messages = await promptTemplate.invoke({ question: query, context: supportPrompt });

      const response = await llm.invoke(messages);
      console.log("Answer Result:", response.content);


      const QueryRoom = await client.queries.findFirst({where:{docId:documentId}})
  
         if(!QueryRoom){
             res.status(500).json({message:"Could not find query room"})
            return;
        }
      await client.message.createMany({
         data:[
             {sentBy:"User",content:query,QuerieID:QueryRoom.id},
            {sentBy:"Bot",content:response.content,QuerieID:QueryRoom.id}

         ]
      })

      res.status(200).json({  answer:response.content,results: result });
    } catch (error) {
      console.error("Error in query:", error);
      res.status(500).json({message:"Error searchinf"})

    }
  });


  