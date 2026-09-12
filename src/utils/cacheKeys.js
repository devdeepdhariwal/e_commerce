// Only skip cache when actual filter params are present (not just pagination defaults)
const PAGINATION_KEYS = new Set(["page", "limit", "cursor"]);

export const skipProductListCache = (query = {}) => {
  return Object.entries(query).some(([key, value]) => {
    if (PAGINATION_KEYS.has(key)) return false;
    if (Array.isArray(value)) return value.some((item) => String(item).trim());
    return Boolean(value && String(value).trim());
  });
};

export const productsKey = () => "cache:products";

export const categoriesKey = () => "cache:categories";
