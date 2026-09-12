import { generateAccessToken, generateRefreshToken } from "../utils/token.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import {
  registerUser,
  loginUser,
  getRefreshToken,
  saveRefreshToken,
  deleteRefreshToken,
  getUserById,
  logoutUser,
  sendOtpService,
  verifyOtpService,
  forgotPasswordService,
  resetPasswordService,
} from "../services/auth.service.js";

import AppError from "../utils/AppError.js";



export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const user = await registerUser({ name, email, password });
    await sendOtpService(email);

    return res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isEmailVerified : user.isEmailVerified,
      },
    });
  } catch (error) {
    next(error);
  }
};


export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await loginUser({ email, password });
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user.id);
    const hash = crypto.createHash("sha256").update(refreshToken).digest("hex");
    await saveRefreshToken(user.id, hash);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      message: "Login successful",
      accessToken,
    });
  } catch (error) {
    next(error);
  }
};


export const logout = async (req, res, next) => {
  try {
    const accessToken = req.headers.authorization?.split(" ")[1];
    const refreshToken = req.cookies.refreshToken;

    if (!accessToken || !refreshToken) {
      throw new AppError("Tokens required", 400); 
    }

    await logoutUser(accessToken, refreshToken);
    res.clearCookie("refreshToken",{
      httpOnly : true,
      secure : process.env.NODE_ENV === "production",
      sameSite : "strict"
    })

    return res.status(200).json({
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};


export const refreshToken = async (req, res, next) => {
  try {
    const rawToken = req.cookies.refreshToken;

    if (!rawToken) {
      throw new AppError("Refresh token missing", 401); 
    }

    try {
      jwt.verify(rawToken, process.env.REFRESH_TOKEN_SECRET);
    } catch {
      throw new AppError("Invalid or expired refresh token", 401); 
    }

    const hash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const record = await getRefreshToken(hash);

    if (!record) {
      throw new AppError("Invalid refresh token", 401); 
    }

    if (record.expiresAt < new Date()) {
      await deleteRefreshToken(hash);
      throw new AppError("Session expired", 401);      
    }

    await deleteRefreshToken(hash);

    const newRefreshToken = generateRefreshToken(record.userId);
    const newHash = crypto.createHash("sha256").update(newRefreshToken).digest("hex");
    await saveRefreshToken(record.userId, newHash);

    const dbUser = await getUserById(record.userId);
    const newAccessToken = generateAccessToken(dbUser);

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      accessToken: newAccessToken,
    });
  } catch (error) {
    next(error); 
  }
};


export async function getMe(req, res, next) {
  try {
    const userId = req.user.userId;
    const user = await getUserById(userId);

    return res.status(200).json({
      user,
    });
  } catch (error) {
    next(error); 
  }
}

export const sendOtp = async(req,res,next) => {
try {
  const email = req.body.email;
  await sendOtpService(email)
  return res.status(200).json({
    success : true,
    message : "If this mail is registered, we sent a code"
  })
} catch (error) {
 next(error) 
}
}

export const verifyOtp = async(req,res,next) => {
try {
  const {email, otp} = req.body;
  await verifyOtpService(email,otp)
  return res.status(200).json({
    success : true,
    message : "Email is Successfully Verified"
  })
} catch (error) {
  next(error)
}
}

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    await forgotPasswordService(email);
    return res.status(200).json({
      success: true,
      message: "If this email is registered, a password reset link has been sent",
    });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { email, token, newPassword } = req.body;
    await resetPasswordService(email, token, newPassword);
    return res.status(200).json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (error) {
    next(error);
  }
};