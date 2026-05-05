import jwt from "jsonwebtoken";
import crypto from "crypto";

export const generateAccessToken = (user) =>{
    return jwt.sign(
    {userId : user.id,
     role : user.role
    },
    process.env.ACCESS_TOKEN_SECRET,
    {expiresIn : "15m"}
    );
};

export const generateRefreshToken = (userId) =>{
    return jwt.sign(
    {userId, jti: crypto.randomUUID()},
    process.env.REFRESH_TOKEN_SECRET,
    {expiresIn : "7d"}
    );
}