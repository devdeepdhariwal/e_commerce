import AppError from "../utils/AppError.js";
import * as categoriesService from "../services/categories.service.js"
export const createCategory = async(req,res,next) =>{
  try {
    const {name, parentId} = req.body;
    if(!name){
    throw new AppError("Name is required", 400)
  }
   const createdCategory = await categoriesService.createCategory(name,parentId);
   return res.status(201).json({message : "Category Created Successfully", category : createdCategory })
    
  } catch (error) {
    next(error)
  }
}

export const deleteCategory = async(req, res, next) =>{
  try {
     const id = req.params.id
     await categoriesService.deleteCategory(id)
    return res.status(200).json({success : true})
  } catch (error) {
    next(error);
  }
}

export const getCategories = async(req,res,next)=>{
 try {
   const categories = await categoriesService.getCategories()
   return res.status(200).json({
    "success" : true,
     "data" : categories
   })
 } catch (error) {
  next(error)
 }
}