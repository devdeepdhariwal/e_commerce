import product from "../models/product.model.js";
import AppError from "../utils/AppError.js";

const generateSlug = (name) =>{
    return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g,"-")
    .replace(/-+/g, "-");
}

export const createProduct = async(productData) =>{
    const slug = generateSlug(productData.name);
    const findslug = await product.findOne({slug : slug});
    if(findslug){
        throw new AppError("Slug Already Exists",409)
    }
    const createdproduct = await product.create({
        name : productData.name,
        slug : slug,
        description : productData.description,
        price : productData.price,
        category : productData.category,
        images : productData.images,
        variants : productData.variants,
        createdBy : productData.createdBy
    })

    return createdproduct;
}