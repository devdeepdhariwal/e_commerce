import AppError from "../utils/AppError.js";
import Product from "../models/product.model.js";
import Redis from "../config/redis.js"



if (!process.env.CART_EXPIRES) {
  throw new Error("CART_EXPIRES is not defined")
}


const CART_EXPIRES = Number(process.env.CART_EXPIRES);

if (!Number.isInteger(CART_EXPIRES) || CART_EXPIRES <= 0) {
  throw new Error("Cart Expires is not Valid")
}

export const addtocart = async (userId, productId, sku, requestedQty) => {
  if (requestedQty <= 0) {
    throw new AppError("Quantity must be greater than 0.", 400);
  }
  const product = await Product.findById(
    productId,
    {
      name: 1,
      images: 1,
      isActive: 1,
      variants: 1
    }
  );

  if (!product) {
    throw new AppError("Product does not exits", 404)
  }
  if (!product.isActive) {
    throw new AppError("Product not Available", 404)
  }

  const variant = product.variants.find(v => v.sku === sku);

  if (!variant) {
    throw new AppError("Variant does not exist", 404);
  }

  const key = `cart:${userId}`;
  const field = `${productId}:${sku}`;
  const item = await Redis.hget(key, field)

  if (item) {

    const cartItem = JSON.parse(item);

    if (variant.stock < (requestedQty + cartItem.quantity)) {
      const remaining = variant.stock - cartItem.quantity;
      throw new AppError(`you can add only ${remaining} more`, 400)
    }


    cartItem.quantity += requestedQty;
    await Redis.hset(key, field, JSON.stringify(cartItem))
    await Redis.expire(key, CART_EXPIRES)
    return cartItem;

  }


  else {

    if (variant.stock < requestedQty) {
      throw new AppError(`only ${variant.stock} left in stock`, 400)
    }

    const cartItem = {
      productId,
      sku,
      quantity: requestedQty,
      price: variant.price,
      name: product.name,
      image: product.images?.[0] || null,

    }
    await Redis.hset(key, field, JSON.stringify(cartItem));
    await Redis.expire(key, CART_EXPIRES)
    return cartItem;
  }

}


export const getCart = async (userId) => {
  const key = `cart:${userId}`;
  const hashdata = await Redis.hgetall(key);
  if (!hashdata) {
    return {
      items: [],
      itemCount: 0,
      subtotal: 0
    }
  }

  let items = []
  let itemCount = 0;
  let subtotal = 0;

  for (const [field, value] of Object.entries(hashdata)) {
    const item = JSON.parse(value);
    items.push(item);
    itemCount += item.quantity;
    subtotal += item.price * item.quantity
  }
  return { items, itemCount, subtotal }
}

export const removeCartItem = async (userId, productId, sku) => {

  if (!productId) {
    throw new AppError("Product id can't be empty", 400)
  }
  if (!sku) {
    throw new AppError("Sku can't be empty", 400
    )
  }
  const key = `cart:${userId}`;
  const field = `${productId}:${sku}`;
  const removed = await Redis.hdel(key,field);
  if(!removed){
    throw new AppError("Item is not in cart", 404)
  }
  if( await Redis.hlen(key)==0){
    await Redis.del(key)
  }
  else{
     await Redis.expire(key, CART_EXPIRES)
  }

return getCart(userId);

}

export const deleteCart = async(userId) =>{
 const key = `cart:${userId}`;
await Redis.del(key);
 return getCart(userId)
}