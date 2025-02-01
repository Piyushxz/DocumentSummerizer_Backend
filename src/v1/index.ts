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
import fs from "fs";




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
    const vecStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
        url: process.env.QDRANT_URL,
        collectionName: "gemini_embeddings",
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

        res.status(200).json({message:"Signed in", token : token})


        
    }catch(e){
        res.status(500).json({message:"server erro"})
    }


})



v1Router.post("/upload", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
           res.status(400).json({ error: "No file uploaded" });
           return
        }
    
        const filePath = req.file.path;
        const fileName = path.basename(filePath);
    
        await processAndStorePdf(fileName);
    
        // Delete file after processing
        fs.unlink(filePath, (err) => {
          if (err) console.error("Error deleting file:", err);
          else console.log("Temporary file deleted:", filePath);
        });
    
        res.json({ message: "File processed successfully!" });
      } catch (error) {
        console.error("Error processing file:", error);
        res.status(500).json({ error: "Error processing file" });
      }
  });

v1Router.post('/query', async (req, res) => {
    const { query } = req.body; // Get the query from the request body
  
    try {
      // Step 1: Embed the query using the embeddings model
      const embeddedQuery = await embeddings.embedQuery(query);
  
      // Step 2: Perform similarity search on the vector store with the embedded query
      const vecStore = await vectorStore(); // Ensure the vector store is set up correctly
      const result = await vecStore.similaritySearchVectorWithScore(embeddedQuery, 5); // Fetch top 5 results with scores
      
      console.log("results",result)
      // Extract the pageContent from the result
      const contextFromSearch = result
        .map(item => item[0]?.pageContent) // item[0] is the Document object
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
      
      const promptTemplate = await pull<ChatPromptTemplate>("rlm/rag-prompt");

      const messages = await promptTemplate.invoke({ question: query, context: supportPrompt });

      const response = await llm.invoke(messages);
      console.log("Answer Result:", response.content);
  
  
      // Step 8: Send back the generated answer and search results as response
      res.status(200).json({  answer:response.content,results: result });
    } catch (error) {
      console.error("Error in query:", error);
      res.status(500).json({message:"Error searchinf"})

    }
  });


  