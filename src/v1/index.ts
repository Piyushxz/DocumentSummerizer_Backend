import { Router } from "express";
import z from 'zod'
import { PrismaClient } from "@prisma/client";
import bcryptjs from 'bcryptjs'
export const v1Router = Router()
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'

const client = new PrismaClient()
dotenv.config()



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
    const hashedPassword = await bcryptjs.hash(parsedBody.data.password,5)


    try{
        await client.user.create({
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


v1Router.post('/api/v1/signin',async (req,res)=>{
    const {username,password} = req.body;


    let foundUser = null;


    try{

        foundUser = await client.user.findFirst({
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


        const token = jwt.sign(foundUser.id,process.env.SECRET_KEY);

        res.status(200).json({message:"Signed in", token : token})


        
    }catch(e){
        res.status(500).json({message:"server erro"})
    }


})