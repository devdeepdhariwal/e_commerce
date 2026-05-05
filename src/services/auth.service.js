import prisma from "../config/db.js";
import { hashPassword } from "../utils/hash.js";
import { compareHash } from "../utils/hash.js";
import AppError from "../utils/AppError.js";
import redis from "../config/redis.js";
import jwt from "jsonwebtoken";
import crypto from "crypto"


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
      await redis.set("blacklist:" + accessToken, 1, { ex: ttl })
   }
   const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
   await prisma.token.delete({
      where: { tokenHash }
   })


}