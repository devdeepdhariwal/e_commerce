import Category from "../models/category.model.js"
import AppError from "../utils/AppError.js";
import mongoose from "mongoose";
import Product from "../models/product.model.js";

const generateSlug = (name) =>{
    return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g,"-")
    .replace(/-+/g, "-");
}

export const createCategory = async(name, parentId) =>{
 const categorySlug = generateSlug(name);
 const findSlug = await Category.findOne({slug : categorySlug});
    if(findSlug){
        throw new AppError("Slug Already Exists",409)
    }
let createdCategory;
if(parentId){
 const parent = await Category.findById(parentId);
 if(!parent){
    throw new AppError("Parent Category not found", 404)
 }
 if(!parent.isActive){
    throw new AppError("Parent category is inactive",409)
 }

 const id = new mongoose.Types.ObjectId()
 const path = [...parent.path, id];
createdCategory = await Category.create({
    _id : id,
    name,
    parentId,
    slug : categorySlug,
    path
 });
}

else{
   const id = new mongoose.Types.ObjectId()
   createdCategory = await Category.create({
        _id : id,
        name : name,
        path : [id],
        slug : categorySlug,
    })
}

return createdCategory;

}

export const getCategories = async() =>{
    const categories = await Category.find({isActive : true});
    const rootCategories = categories.filter(
        category => category.parentId === null
    )
    const childCategories = categories.filter(
        category => category.parentId !==null 
    )
    const result = [];

for (const rootCategory of rootCategories) {

    const children = childCategories.filter(
        child => child.parentId.toString() === rootCategory._id.toString()
    );

    const rootWithChildren = {
        ...rootCategory.toObject(),
        children
    };

    result.push(rootWithChildren);
}

return result;
}



export const deleteCategory = async(id) =>{
  const category = await Category.findById(id)
  if(!category){
    throw new AppError("Category not found",404)
  }
  const productExists = await Product.findOne({categoryPath : category._id})
  if(productExists){
    throw new AppError("Cannot Delete Category Product Exists",409)
  }
  const updatedCategory = await Category.findByIdAndUpdate(category._id,{
    isActive : false
  },
   {
    new: true,
    runValidators: true,
  }
)
return updatedCategory;
}