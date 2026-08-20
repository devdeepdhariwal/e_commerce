import AppError from "../utils/AppError.js";
import * as addressService from "../services/address.service.js";

export const createAddress = async(req,res,next) => {
     try {
        const { fullName, phone, line1, line2, city, state, postalCode, country } = req.body;
        if(!fullName || !phone || !line1 || !city || !state || !postalCode || !country){
            throw new AppError("All fields are required",400);
        }
        const userId = req.user.userId;
        const userAddress = await addressService.createAddress(userId,{ fullName, phone, line1, line2, city, state, postalCode, country });
        return res.status(201).json({
            success : true,
            data : userAddress
        })
     } catch (error) {
        next(error)
     }
}

export const getMyAddresses = async(req,res,next) => {
    try {
    const userId = req.user.userId;
    const userAddresses = await addressService.getMyAddresses(userId);
    return res.status(200).json({
        success : true,
        data : userAddresses
    })
    } catch (error) {
        next(error)
    }
}


