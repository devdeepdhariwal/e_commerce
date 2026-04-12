
import { generateAccessToken, generateRefreshToken } from "../utils/token.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import {registeruser, loginUser, getRefreshToken, saveRefreshToken, deleteRefreshToken, getUserById } from "../services/auth.service.js";
import AppError from "../utils/AppError.js";

export const register = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({
                message: "All fields are required",
            });
        }

        const passwordRegex =
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;

        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                message: "Password must be at least 8 digit, include upppercase, lowercase, number, and special character",
            });
        }


        const user = await registeruser({ name, email, password });
        return res.status(201).json({
            message: "User registerd Successfully",
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
            }
        });

    } catch (error) {
        next(error);
    }
}

export const login = async(req, res, next) => {
    try {
       const {email,password} = req.body;
       if(!email || !password){
        return res.status(400).json({
            message : "All fields are neccessary",
        });
       }
       const user = await loginUser({email,password});
       const accessToken = generateAccessToken(user.id);
       const refreshToken = generateRefreshToken(user.id);
       const hash = crypto.createHash("sha256").update(refreshToken).digest("hex")
       await saveRefreshToken(user.id,hash);

       res.cookie("refreshToken",refreshToken,{
         httpOnly : true,
         secure   : process.env.NODE_ENV === "production",
         sameSite : "Strict",
         maxAge : 7*24*60*60*1000,
       });

       res.status(200).json({
        message : "Login Successful",
        accessToken,
       });

    } catch (error) {
       next(error);
    }
}

export const refreshToken = async(req,res,next) =>{
 try {
    const rawToken = req.cookies.refreshToken;
    if(!rawToken){
        return next(new AppError("Refresh token missing", 401));

    }
   try {
    jwt.verify(rawToken, process.env.REFRESH_TOKEN_SECRET);
} catch {
    return next(new AppError("Invalid or expired refresh token", 401));
}
   
   const hash = crypto.createHash("sha256").update(rawToken).digest("hex");

   const record = await getRefreshToken(hash);
   if(!record){
    return next(new AppError("Invalid refresh token",401));
   }

   if(record.expiresAt < new Date()){
    await deleteRefreshToken(hash);
    return next(new AppError("Session Expired", 401));
}
   
   
   await deleteRefreshToken(hash);
   const newRefreshToken = generateRefreshToken(record.userId);
   const newHash = crypto.createHash("sha256").update(newRefreshToken).digest("hex");
   await saveRefreshToken(record.userId,newHash);
   
   const newAccessToken = generateAccessToken(record.userId);

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // true in production (HTTPS)
      sameSite: "Strict",
      maxAge : 7*24*60*60*1000,
    });

    res.status(200).json({
        accessToken : newAccessToken,
    });
 } catch (error) {
    next(error);
 }
}

export async function getMe(req,res,next){
try {
   const userId = req.user.userId;
   const user = await getUserById(userId)
    return res.status(200).json({
        user
    })
} catch (error) {
    next(error)
}
}