import { Router } from "express";
import z from 'zod'
import { PrismaClient } from "@prisma/client";
import bcryptjs from 'bcryptjs'
export const v1Router = Router()
import jwt from 'jsonwebtoken'
import { GoogleAuth } from 'google-auth-library';
import { ChatVertexAI } from "@langchain/google-vertexai";
import { VertexAIEmbeddings } from "@langchain/google-vertexai";
import { QdrantVectorStore } from "@langchain/qdrant";
import * as path from 'path';
import * as fs from 'fs';
import { processAndStorePdf } from "../processAndStorePdf";
import dotenv from "dotenv"


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
    await QdrantVectorStore.fromExistingCollection(embeddings, {
        url: process.env.QDRANT_URL,
        collectionName: "gemini_embeddings",
        apiKey: process.env.QDRANT_KEY
    });
}

vectorStore();

const prismaClient = new PrismaClient();

const pdfPath = path.resolve(__dirname, '../../Full_Stack_Engineer_Internship_Assignment.pdf');

if (fs.existsSync(pdfPath)) {
    console.log("File exists:", pdfPath);
} else {
    console.log("File does not exist:", pdfPath);
}
// async function processAndStore() {
//    try {
//         // Step 1: Load PDF
//         const loader = new PDFLoader(pdfPath);
//         const docs = await loader.load();
//         console.log("Loaded Docs:", docs);

//         // Step 2: Split Documents
//         const textSplitter = new RecursiveCharacterTextSplitter({
//             chunkSize: 1000,
//             chunkOverlap: 200,
//         });
//         const splitDocs = await textSplitter.splitDocuments(docs);
//         console.log("Split Docs:", splitDocs);

//         // Step 3: Extract Text and Metadata
//         const texts = splitDocs.map((doc) => doc.pageContent);
//         const metadata = splitDocs.map((doc) => doc.metadata);

//         // Step 4: Store Embeddings in Qdrant
//         const vectorStore = await QdrantVectorStore.fromTexts(
//             texts,
//             metadata,
//             embeddings,
//             {
//                 client: new QdrantClient({ url:'https://9998d475-d66e-4dfc-b5fb-4da33df563b5.us-east4-0.gcp.cloud.qdrant.io:6333', apiKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIiwiZXhwIjoxNzQ2MDQyMzMxfQ.IhRRIbkJnYe6nuN6byTr9QZZIBOTnZEGlQItegeJj8M' }),
//                 collectionName: "gemini_embeddings",
//             }
//         );

//         console.log("Embeddings successfully stored in Qdrant!");
//     } catch (error) {
//         console.error("Error processing and storing embeddings:", error);
//     }
// }

// processAndStore();



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

        res.status(200).json({message:"Signed in", token : token})


        
    }catch(e){
        res.status(500).json({message:"server erro"})
    }


})