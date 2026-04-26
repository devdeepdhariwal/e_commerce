import * as productService from "../services/product.service.js";

export const createProduct = async (req, res, next) => {
  try {
    const { name, description, category, price, images, variants, isActive } =
      req.body;
    const createdBy = req.user.userId;
    if (!name || !description || !category || !price || !images || !variants) {
      return res.status(400).json("All fields are neccessary");
    }
    const product = await productService.createProduct({
      name,
      description,
      category,
      price,
      images,
      variants,
      createdBy,
    });

    return res.status(201).json({
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    next(error);
  }
};
