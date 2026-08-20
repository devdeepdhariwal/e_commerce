export const skipProductListCache = (query = {}) => {
  return Object.values(query).some((value) => {
    if (Array.isArray(value)) return value.some((item) => String(item).trim());
    return Boolean(value && String(value).trim());
  });
};

export const productsKey = () => "cache:products";

export const categoriesKey = () => "cache:categories";
