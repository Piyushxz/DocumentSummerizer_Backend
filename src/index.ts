import express from "express"
import { v1Router } from "./v1"
import dotenv from "dotenv"
import cors from 'cors'


const app = express()
app.use(cors())
app.use(express.json())
dotenv.config()


app.use('/api/v1',v1Router)


app.listen(3003,()=>{
    console.log('server running')
    console.log(process.env.QDRANT_URL,process.env.QDRANT_KEY)
})