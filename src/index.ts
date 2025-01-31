import express from "express"
import { v1Router } from "./v1"
import dotenv from "dotenv"
import { main } from "./pdfTest"
import { GoogleAuth } from 'google-auth-library';
import { ChatVertexAI } from "@langchain/google-vertexai";
import { VertexAIEmbeddings } from "@langchain/google-vertexai";
import {QdrantClient} from '@qdrant/js-client-rest';
import { QdrantVectorStore } from "@langchain/qdrant";







  const llm = new ChatVertexAI({
    model: "gemini-1.5-flash",
    temperature: 0,
    apiKey:process.env.GEMINI_API
  });

  const embeddings = new VertexAIEmbeddings({
    model: "text-embedding-004"
  });

  const client = new QdrantClient({
    url: 'https://9998d475-d66e-4dfc-b5fb-4da33df563b5.us-east4-0.gcp.cloud.qdrant.io:6333',
    apiKey:process.env.QDRANT_KEY

});
  

 async function vectorStore()
 {
    await QdrantVectorStore.fromExistingCollection(embeddings, {
  url: process.env.QDRANT_URL,
  collectionName: "gemini_embeddings",
});
 }

 vectorStore()

const app = express()

app.use(express.json())
dotenv.config()



app.use('/api/v1',v1Router)


main()





app.listen(3003,()=>{
    console.log('server running')
    console.log(process.env.QDRANT_URL,process.env.QDRANT_KEY)
})