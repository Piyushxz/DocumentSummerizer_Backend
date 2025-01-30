import express from "express"
import { PrismaClient } from "@prisma/client"
import { v1Router } from "./v1"


const app = express()
const client = new PrismaClient()

app.use(express.json())


app.use('/api/v1',v1Router)








app.listen(3003,()=>{
    console.log('server running')
})