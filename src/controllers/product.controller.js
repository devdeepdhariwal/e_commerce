import * as productService from "../services/product.service.js";
import AppError from "../utils/AppError.js";


export const createProduct = async (req, res, next) => {
  try {
    const { name, description, categoryId, variants, images, isActive } =
      req.body;
    const createdBy = req.user.userId;
    if (!name || !description || !categoryId || !variants || !images) {
      throw new AppError("All Fields are Necessary",400)
    }
    if (!Array.isArray(variants) || variants.length === 0) {
      throw new AppError("At least one variant is required",400)
    }
    const product = await productService.createProduct({
      name,
      description,
      categoryId,
      variants,
      images,
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
      ...rest
    }  = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

    if(page<1)
      page = 1;

    if(limit<1)
      limit = 10;

    if(limit>100)
      limit = 100;

    // Extract variant attribute filters from attr_ prefixed query params
    // e.g. ?attr_Color=Black&attr_Size=M → { Color: "Black", Size: "M" }
    const variantFilters = {};
    for (const [key, value] of Object.entries(rest)) {
      if (key.startsWith("attr_") && value) {
        const attrName = key.slice(5); // remove "attr_" prefix
        variantFilters[attrName] = value;
      }
    }

    const filters = {
      name,
      category,
      minPrice,
      maxPrice,
      variantFilters: Object.keys(variantFilters).length > 0 ? variantFilters : undefined,
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
      categoryId,
      variants,
      images,
      isActive,
    } = req.body;

    const updatedData = Object.fromEntries(
      Object.entries({ name, description, categoryId, variants, images, isActive })
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