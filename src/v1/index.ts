import { Router } from "express";
import z from 'zod'
import { PrismaClient } from "@prisma/client";
export const v1Router = Router()

const client = new PrismaClient()



v1Router.get('/',(req,res)=>{
    res.json("Hey")
})



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

    try{
        await client.user.create({
            data:{
                username:parsedBody.data.username,
                email : parsedBody.data.email,
                password : parsedBody.data.password
            }
        })

        res.status(201).json({message:"User created"})
    }catch(e){
        res.status(500).json({message:"Server error"})
        console.log(e)
    }


})