import prisma from "../config/db.js";
import { hashPassword } from "../utils/hash.js";
import { compareHash } from "../utils/hash.js";
import AppError from "../utils/AppError.js";
import redis from "../config/redis.js";
import jwt from "jsonwebtoken";
import crypto from "crypto"
import { sendmail } from "../utils/mailer.js";


export const registerUser = async ({ name, email, password }) => {
   const normalisedEmail = email.trim().toLowerCase();
   const existingUser = await prisma.user.findUnique({
      where: { email: normalisedEmail },
   });

   if (existingUser) {
      throw new AppError("User Already Exists", 409);
   }

   const hashedPassword = await hashPassword(password);
   const user = await prisma.user.create({
      data: {
         name,
         email: normalisedEmail,
         password: hashedPassword,
      },
      select: {
         id: true,
         name: true,
         email: true,
         isEmailVerified : true,
      }
   })
   return user;
};

export const loginUser = async ({ email, password }) => {
   const normalisedEmail = email.trim().toLowerCase();
   const user = await prisma.user.findUnique({
      where: { email: normalisedEmail }
   });

   if (!user) {
      throw new AppError("Invalid Credentials", 401);
   }

   const isMatch = await compareHash(password, user.password);
   if (!isMatch) {
      throw new AppError("Invalid Credentials", 401);
   }
   if(!user.isEmailVerified){
      throw new AppError("Please verify your email",403)
   }
   const { password: _, ...safeUser } = user;
   return safeUser;
};

export async function saveRefreshToken(userId, hash) {
   await prisma.token.create({
      data: {
         userId: userId,
         tokenHash: hash,
         expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
   })
}

export async function getRefreshToken(tokenHash) {
   const token = await prisma.token.findUnique({
      where: { tokenHash }
   })
   return token;
}

export async function deleteRefreshToken(tokenHash) {
   await prisma.token.delete({
      where: { tokenHash }
   })
}

export async function getUserById(userId) {
   const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
         id: true,
         name: true,
         email: true,
         createdAt: true,
         role: true,
         isEmailVerified : true,
      }
   })

   if (!user) {
      throw new AppError("User not found", 404);
   }

   return user
}

export const logoutUser = async (accessToken, refreshToken) => {
   const decoded = jwt.decode(accessToken)
   const now = Math.floor(Date.now() / 1000)
   const ttl = decoded.exp - now
   if (ttl > 0) {
      await redis.set("blacklist:" + accessToken, 1, "EX", ttl);
   }
   const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
   await prisma.token.delete({
      where: { tokenHash }
   })


}

export const sendOtpService = async(email) =>{
if(!email){
   throw new AppError("Email is required",400)
}
const normalisedEmail = email.trim().toLowerCase();
const user = await prisma.user.findUnique({where : {email : normalisedEmail}})
if(!user || user.isEmailVerified){
   return
}
const otp = crypto.randomInt(100000,1000000).toString();
const otpHash = crypto.createHash("sha256").update(otp).digest("hex")
const key = `otp:${normalisedEmail}`
await redis.set(key,otpHash,"EX", 600)
await sendmail({
   to : normalisedEmail,
   subject: "Your Verification code",
   text : `Your code is ${otp}. It will expire in 10 minutes`
})
return 
}

export const verifyOtpService = async(email,otp) => {
if(!email){
   throw new AppError("Email is required",400)
}

if(!otp){
   throw new AppError("Otp is required",400)
}
const normalisedEmail = email.trim().toLowerCase();
const otpHash = crypto.createHash("sha256").update(String(otp)).digest("hex")
const key = `otp:${normalisedEmail}`
const storedHash = await redis.get(key)
if(!storedHash || storedHash != otpHash){
   throw new AppError("Invalid or Expired Otp", 400)
}
const userFound = await prisma.user.findUnique({where : {email : normalisedEmail}})
if(!userFound){
   throw new AppError("Invalid or Expired Otp",400)
}
await prisma.user.update({where : {
   email : normalisedEmail
   },
   data :{
   isEmailVerified : true 
   }
})

await redis.del(key)
return
}

export const forgotPasswordService = async (email) => {
  if (!email) {
    throw new AppError("Email is required", 400);
  }
  const normalisedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalisedEmail } });

  // Silent return to prevent email enumeration
  if (!user) {
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const key = `pwreset:${normalisedEmail}`;

  // 15-minute TTL
  await redis.set(key, tokenHash, "EX", 900);

  await sendmail({
    to: normalisedEmail,
    subject: "Password Reset Request",
    text: `Your password reset token is: ${token}\n\nThis token will expire in 15 minutes.\n\nIf you did not request this, please ignore this email.`,
  });
};

export const resetPasswordService = async (email, token, newPassword) => {
  if (!email || !token || !newPassword) {
    throw new AppError("All fields are required", 400);
  }

  const normalisedEmail = email.trim().toLowerCase();
  const key = `pwreset:${normalisedEmail}`;

  const storedHash = await redis.get(key);
  if (!storedHash) {
    throw new AppError("Invalid or expired reset token", 400);
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  if (storedHash !== tokenHash) {
    throw new AppError("Invalid or expired reset token", 400);
  }

  const user = await prisma.user.findUnique({ where: { email: normalisedEmail } });
  if (!user) {
    throw new AppError("Invalid or expired reset token", 400);
  }

  const hashedPassword = await hashPassword(newPassword);
  await prisma.user.update({
    where: { email: normalisedEmail },
    data: { password: hashedPassword },
  });

  // Delete the reset token
  await redis.del(key);

  // Delete all refresh tokens for this user (force re-login)
  await prisma.token.deleteMany({ where: { userId: user.id } });
};