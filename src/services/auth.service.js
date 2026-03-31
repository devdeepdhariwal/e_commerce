import prisma from "../config/db.js";
import { hashpassword } from "../utils/hash.js";
import { comparehash } from "../utils/hash.js";

export const registeruser = async ({name, email, password}) =>{
 const normalisedemail = email.trim().toLowerCase();
 const existinguser = await prisma.user.findUnique({
  where : {email : normalisedemail},
 });

 if(existinguser){
    throw new Error("User Already Exists");
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
    return res.status(400).json({
        message : "User Not Exits Please Register First",
    });
   }

  const ismatch = comparehash(password,user.password);
  if(!ismatch){
    return res.status(400).json({
        message : "Invalid Password",
    });


  }
  return user;
};