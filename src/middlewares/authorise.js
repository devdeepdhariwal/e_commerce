//middlewares/authorise.js
import AppError from "../utils/AppError.js";
const authorise = (requiredRole) =>{
    return function authMiddle(req,res,next){
        const user = req.user;
        if(!user){
       return  next (new AppError("Not authenticated",401))
        }

        if(req.user.role !== requiredRole){
       return  next(new AppError("Not authorised",403))
        }

        next();
    }
}

export default authorise;