import express from "express"
import { v1Router } from "./v1"
import dotenv from "dotenv"
import { main } from "./pdfTest"
import { GoogleAuth } from 'google-auth-library';
import { ChatVertexAI } from "@langchain/google-vertexai";
import { VertexAIEmbeddings } from "@langchain/google-vertexai";
import {QdrantClient} from '@qdrant/js-client-rest';






  const llm = new ChatVertexAI({
    model: "gemini-1.5-flash",
    temperature: 0,
    apiKey:process.env.GEMINI_API
  });

  const embeddings = new VertexAIEmbeddings({
    model: "text-embedding-004"
  });

  const client = new QdrantClient({
    url: process.env.QDRANY_URL,
    apiKey:process.env.QDRANT_KEY
});
  

const app = express()

app.use(express.json())
dotenv.config()



app.use('/api/v1',v1Router)


main()





app.listen(3003,()=>{
    console.log('server running')
})