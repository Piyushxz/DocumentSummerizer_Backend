import { Router } from "express";

export const v1Router = Router()




v1Router.get('/',(req,res)=>{
    res.json("Hey")
})