
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
    const findSlug = await product.findOne({slug : slug});
    if(findSlug){
        throw new AppError("Slug Already Exists",409)
    }
    const createdProduct = await product.create({
        name : productData.name,
        slug : slug,
        description : productData.description,
        price : productData.price,
        category : productData.category,
        images : productData.images,
        variants : productData.variants,
        createdBy : productData.createdBy
    })

    return createdProduct;
}

// ============================================================
// METHOD 1: REGEX SEARCH (Simple, but slow for large datasets)
// Use for: small collections, quick prototypes, no Atlas setup
// ============================================================

// export const getProducts = async (filters, options) => {
//   const { name, category, minPrice, maxPrice } = filters;
//   const { page, limit } = options;
//   const query = {};

//   // Fuzzy-ish match using regex (case-insensitive)
//   // Downside: can't use Atlas Search index → full collection scan → slow at scale
//   if (name) {
//     query.name = { $regex: name, $options: "i" };
//   }

//   if (category) {
//     query.category = category;
//   }

//   if (minPrice) {
//     query.price = { ...query.price, $gte: Number(minPrice) };
//   }

//   if (maxPrice) {
//     query.price = { ...query.price, $lte: Number(maxPrice) };
//   }

//   const skip = (page - 1) * limit;

//   const products = await product.find(query).skip(skip).limit(limit);
//   const totalCount = await product.countDocuments(query);

//   return { products, totalCount };
// };

// ============================================================
// METHOD 2: ATLAS SEARCH (Production-grade, fast, fuzzy)
// Use for: large collections, typo tolerance, compound filters
// Requires: Atlas Search index named "product_search" on MongoDB Atlas
// ============================================================

export const getProducts = async (filters, options) => {
  const { name, category, minPrice, maxPrice } = filters;
  const { page, limit } = options;

  const skip = (page - 1) * limit;

  // --- Build compound query clauses ---
  const mustClauses = [];
  const shouldClauses = [];
  const filterClauses = [];

  // Fuzzy text search on product name (tolerates 1 typo)
  if (name) {
    shouldClauses.push({
      text: {
        query: name,
        path: "name",
        fuzzy: { maxEdits: 1 },
      },
    });
  }

  // Exact match on category (filter = no scoring impact)
  if (category) {
    filterClauses.push({
      text: { query: category, path: "category" },
    });
  }

  // Price range filter
  // Spread pattern used to safely handle partial ranges (only min, only max, or both)
  // Avoids passing NaN when one side is undefined
  if (minPrice || maxPrice) {
    filterClauses.push({
      range: {
        path: "price",
        ...(minPrice && { gte: Number(minPrice) }),
        ...(maxPrice && { lte: Number(maxPrice) }),
      },
    });
  }

  // Always filter to only active products
  mustClauses.push({
    equals: { path: "isActive", value: true },
  });

  // --- Aggregation pipeline ---
  const pipeline = [
    {
      $search: {
        index: "product_search",
        compound: {
          must: mustClauses,
          should: shouldClauses,
          filter: filterClauses,
        },
      },
    },
    { $skip: skip },
    { $limit: limit },
  ];

  const products = await product.aggregate(pipeline);

  // When name search is active, we must count via the same Atlas Search pipeline
  // because countDocuments can't replicate fuzzy text matching
  let totalCount;
  if (name) {
    const countPipeline = [
      {
        $search: {
          index: "product_search",
          compound: {
            must: mustClauses,
            should: shouldClauses,
            filter: filterClauses,
          },
        },
      },
      { $count: "total" },
    ];
    const countResult = await product.aggregate(countPipeline);
    totalCount = countResult.length > 0 ? countResult[0].total : 0;
  } else {
    const query = { isActive: true };
    if (category) query.category = category;
    if (minPrice) query.price = { ...query.price, $gte: Number(minPrice) };
    if (maxPrice) query.price = { ...query.price, $lte: Number(maxPrice) };
    totalCount = await product.countDocuments(query);
  }

  return { products, totalCount };
};

export const getProductBySlug = async(slug) =>{
  const foundProduct = await product.findOne({slug : slug})
  if(!foundProduct){
    throw new AppError("Product not Found", 404)
  }
  return foundProduct;
}

export const updateProduct = async(id,updatedData) =>{
if(updatedData.name){
   const newSlug = generateSlug(updatedData.name)
   const existingSlug = await product.findOne({slug : newSlug, _id : {$ne : id}})
   if(existingSlug){
    throw new AppError("slug already exists", 409)
   }
    updatedData.slug = newSlug
}
  

   const updatedProduct = await product.findByIdAndUpdate(
    id,
    updatedData,
    {new : true}
   )
   if(!updatedProduct){
    throw new AppError("Product not found", 404)
   }


return updatedProduct
}


export const deleteProduct = async(id) =>{
    const deletedProduct = await product.findByIdAndDelete(id)
    if(!deletedProduct){
        throw new AppError("Product not found",404)
    }
    return deletedProduct
}