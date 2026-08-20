import * as cartService from "../services/cart.service.js"
import AppError from "../utils/AppError.js";

export const addtocart = async(req,res,next) => {
    try {
        const userId = req.user.userId;
        const productId = req.body.productId;
        const quantity = Number(req.body.quantity);
        const sku = req.body.sku;

        if(!productId){
            throw new AppError("Product Id is neccessary",400)
        }
        if(!quantity){
            throw new AppError("Please add at least 1 product",400)
        }
        if(!sku){
            throw new AppError("Sku is neccessary",400)
        }

     const item = await cartService.addtocart(userId,productId,sku,quantity)
     return res.status(200).json({
        message : "Product added sucessfully",
        success : true,
        item
     })
    } catch (error) {
        next(error)
    }
}


export const getCart = async(req,res,next) =>{
    try {
        const userId = req.user.userId;
        const cart = await cartService.getCart(userId);
        return res.status(200).json({
            success : true,
            data : cart
        })
    } catch (error) {
        next(error)
    }
}


export const deleteCartItem = async(req,res,next) =>{
    try {
        const userId = req.user.userId;
        const sku = req.params.sku;
        const productId = req.params.productId;
        if(!productId){
            throw new AppError("Product Id is neccessary",400)
        }
        if(!sku){
            throw new AppError("Sku is neccessary",400)
        }
        const newCart = await cartService.removeCartItem(userId,productId,sku)
        return res.status(200).json({
            success : true,
            data : newCart
        })
    } catch (error) {
        next(error)
    }
}

export const deleteCart = async(req,res,next) =>{
    try {
        const userId = req.user.userId;
        const deletedCart = await cartService.deleteCart(userId);
        return res.status(200).json({
            success : true,
            data : deletedCart
        })
    } catch (error) {
        next(error)
    }
}

export const revalidateCart = async (req, res, next) => {
  try {
    const result = await cartService.revalidateCart(req.user.userId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};