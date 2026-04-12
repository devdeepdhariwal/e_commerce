import prisma from "../config/db.js";
import { hashpassword } from "../utils/hash.js";
import { comparehash } from "../utils/hash.js";
import AppError from "../utils/AppError.js";

export const registeruser = async ({name, email, password}) =>{
 const normalisedemail = email.trim().toLowerCase();
 const existinguser = await prisma.user.findUnique({
  where : {email : normalisedemail},
 });

 if(existinguser){
    throw new AppError("User Already Exists",409);
 }

 const hashedpassword = await hashpassword(password);
 const user = await prisma.user.create({
    data :{
        name,
        email : normalisedemail,
        password : hashedpassword,
    },
    select : {
        id   : true,
        name : true,
        email: true,
    }
 })
 return user;
};

export const loginUser = async({email,password}) => {
   const normalisedemail = email.trim().toLowerCase();
   const user = await prisma.user.findUnique({
    where : {email : normalisedemail}
   });

   if(!user){
    throw new AppError ("Invalid Credentials",401);
   }

  const ismatch = await comparehash(password,user.password);
  if(!ismatch){
    throw new AppError("Invalid Credentials",401);
  }
  return user;
};

export async function saveRefreshToken (userId,hash){
  await prisma.token.create({
   data : {
      userId : userId,
      tokenHash : hash,
      expiresAt : new Date(Date.now()+7*24*60*60*1000)
   }
  })
}

export async function getRefreshToken(tokenhash){
   const token = await prisma.token.findUnique({
      where : {tokenHash : tokenhash}
   })
   return token;
}

export async function deleteRefreshToken(tokenhash){
   await prisma.token.delete({
      where : {tokenHash : tokenhash}
   })
}

export async function getUserById(userId){
   const user = await prisma.user.findUnique({
      where : {id : userId},
      select : {
         id : true,
         name : true,
         email : true,
         createdAt : true,
      }
   })

   if(!user){
      throw new AppError("User not found",404);
   }

   return user
}