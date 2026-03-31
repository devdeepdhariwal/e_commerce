import { registeruser } from "../services/auth.service.js";
import { loginUser } from "../services/auth.service.js";
import { generateAccessToken, generateRefreshToken } from "../utils/token.js";

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
       const user = await loginUser({email,password});
       const Accesstoken = generateAccessToken(user);
       const refreshtoken = generateRefreshToken(user);

       res.cookie("refreshToken",refreshtoken,{
         httpOnly : true,
         secure   : true,
         sameSite : "strict",
         maxAge : 7*24*60*60*1000,
       });

       res.status(200).json({
        message : "Login Successful",
        Accesstoken,
       });

    } catch (error) {
       next(error);
    }
}