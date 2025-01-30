import express from "express"
import { v1Router } from "./v1"
import dotenv from "dotenv"
import { main } from "./pdfTest"
import { GoogleAuth } from 'google-auth-library';
import { ChatVertexAI } from "@langchain/google-vertexai";




  const llm = new ChatVertexAI({
    model: "gemini-1.5-flash",
    temperature: 0,
    apiKey:'AIzaSyDWicQlGLATs21SNbJeafSm-litjsFck74'
  });
  

const app = express()

app.use(express.json())
dotenv.config()



app.use('/api/v1',v1Router)


main()





app.listen(3003,()=>{
    console.log('server running')
})