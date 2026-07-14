import * as productService from "../services/product.service.js";
import AppError from "../utils/AppError.js";


export const createProduct = async (req, res, next) => {
  try {
    const { name, description, categoryId, price, images, attributes, isActive } =
      req.body;
    const createdBy = req.user.userId;
    if (!name || !description || !categoryId || !price || !images || !attributes) {
      throw new AppError("All Fields are Necessary",400)
    }
    const product = await productService.createProduct({
      name,
      description,
      categoryId,
      price,
      images,
      attributes,
      createdBy,
      isActive
    });

    return res.status(201).json({
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    next(error);
  }
};


export const getProduct = async(req,res,next) => {
  try {
    let {
      page = 1,
      limit = 10,
      name, 
      category,
      minPrice,
      maxPrice,
    }  = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

    if(page<1)
      page = 1;

    if(limit<1)
      limit = 10;

    if(limit>100)
      limit = 100;

    const filters = {
      name,
      category,
      minPrice,
      maxPrice,
    };

    const options = {
      page,
      limit,
    };

  const {totalCount,products} = await productService.getProducts(filters,options);
  const totalPages = Math.ceil(totalCount/limit)
  res.status(200).json({
    success : true,
    data : products,
    pagination : {
     totalPages : totalPages,
     hasNextPage : page<totalPages,
     hasPrevPage : page>1,

    }
  });

  } catch (error) {
    next(error);
  }
}

export const getProductBySlug = async(req,res,next) =>{
 try {
   const slug = req.params.slug
   const product = await productService.getProductBySlug(slug)
   return res.status(200).json({
    success : true,
    product,
   })
 } catch (error) {
    next(error)
 }
}

export const updateProduct = async(req,res,next) =>{
  try {
    const id = req.params.id
    const {
      name,
      description,
      price,
      categoryId,
      images,
      attributes, 
      isActive,
    } = req.body;

    const updatedData = Object.fromEntries(
      Object.entries({ name, description, price, categoryId, images, attributes, isActive })
        .filter(([_, v]) => v !== undefined)
    );
  const product = await productService.updateProduct(id,updatedData)
  return res.status(200).json({
    success : true,
    message : "Product Updated Successfully",
    product,
  })

  } catch (error) {
    next(error)
  }
}

export const deleteProduct = async(req,res,next) =>{
  try {
  const id = req.params.id
 await productService.deleteProduct(id)
 return res.status(200).json({
  message : "Product deleted Successfully"
 })
  } catch (error) {
    next (error)
  }
 
}