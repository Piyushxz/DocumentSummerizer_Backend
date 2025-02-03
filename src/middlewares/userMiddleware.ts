import { Request,Response,NextFunction } from "express";
import jwt, { JwtPayload } from 'jsonwebtoken'

declare global {
    namespace Express {
      interface Request {
        userId?: string;
      }
    }
  }
  

export default function userMiddleware(req:Request,res:Response,next:NextFunction){
    const token = req.headers.authorization 




    const decoded = jwt.verify(token as string,process.env.SECRET_KEY) as JwtPayload

    if(!decoded.id){
        res.status(404).json({message:"Invalid Token"})
        return
    }
    req.userId = decoded.id;

    next()


    
}