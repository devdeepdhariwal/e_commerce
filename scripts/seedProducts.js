import mongoose from "mongoose";
import dotenv from "dotenv";
import { faker } from "@faker-js/faker";
import Category from "../src/models/category.model.js";
import Product from "../src/models/product.model.js";
import { createProduct } from "../src/services/product.service.js";

dotenv.config();

const ADMIN_ID = "689e908a-6ca2-4e6a-8932-6ceec1fa34d1";
const PRODUCTS_PER_CATEGORY = 5;

const categoryProfiles = {
  electronics: {
    brands: ["Sony", "Samsung", "LG", "Panasonic", "Philips"],
    productTypes: ["Gadget", "Device", "Electronics Item", "Tech Product"],
    priceRange: { min: 2000, max: 80000 },
    variantAxes: () => ({
      Color: faker.helpers.arrayElements(["Black", "Silver", "White", "Blue"], { min: 2, max: 3 }),
    }),
    extraAttributes: () => ({
      Warranty: faker.helpers.arrayElement(["1 Year", "2 Years", "3 Years"]),
      Power: faker.helpers.arrayElement(["20W", "45W", "65W", "100W"]),
    }),
  },

  mobiles: {
    brands: ["Apple", "Samsung", "OnePlus", "Xiaomi", "Google", "Realme"],
    productTypes: ["Phone", "Smartphone", "Mobile", "Pro", "Ultra"],
    priceRange: { min: 10000, max: 120000 },
    variantAxes: () => ({
      Storage: faker.helpers.arrayElements(["64GB", "128GB", "256GB", "512GB"], { min: 2, max: 3 }),
      Color: faker.helpers.arrayElements(["Black", "Blue", "White", "Green", "Silver"], { min: 2, max: 3 }),
    }),
    extraAttributes: () => ({
      Battery: faker.helpers.arrayElement(["4000mAh", "4500mAh", "5000mAh"]),
    }),
  },

  laptops: {
    brands: ["Dell", "HP", "Lenovo", "Apple", "Asus", "Acer"],
    productTypes: ["Laptop", "Notebook", "Ultrabook", "ProBook"],
    priceRange: { min: 30000, max: 180000 },
    variantAxes: () => ({
      RAM: faker.helpers.arrayElements(["8GB", "16GB", "32GB"], { min: 2, max: 3 }),
      Storage: faker.helpers.arrayElements(["256GB SSD", "512GB SSD", "1TB SSD"], { min: 2, max: 3 }),
    }),
    extraAttributes: () => ({
      Color: faker.helpers.arrayElement(["Silver", "Gray", "Black"]),
    }),
  },

  headphones: {
    brands: ["Sony", "JBL", "Boat", "Bose", "Sennheiser"],
    productTypes: ["Headphones", "Earbuds", "Wireless Earbuds", "Neckband"],
    priceRange: { min: 1200, max: 25000 },
    variantAxes: () => ({
      Color: faker.helpers.arrayElements(["Black", "White", "Blue", "Red"], { min: 2, max: 3 }),
    }),
    extraAttributes: () => ({
      Connectivity: faker.helpers.arrayElement(["Wired", "Wireless", "Bluetooth 5.3"]),
      "Noise Cancellation": faker.helpers.arrayElement(["Yes", "No"]),
    }),
  },

  smartwatches: {
    brands: ["Apple", "Samsung", "Noise", "Boat", "Amazfit"],
    productTypes: ["Smartwatch", "Watch", "Fitness Watch"],
    priceRange: { min: 2500, max: 60000 },
    variantAxes: () => ({
      Strap: faker.helpers.arrayElements(["Silicone", "Metal", "Leather"], { min: 2, max: 3 }),
      Color: faker.helpers.arrayElements(["Black", "Blue", "Pink", "Silver"], { min: 2, max: 3 }),
    }),
    extraAttributes: () => ({
      Display: faker.helpers.arrayElement(["AMOLED", "LCD", "Retina"]),
    }),
  },

  fashion: {
    brands: ["Zara", "H&M", "Levis", "Puma", "Nike"],
    productTypes: ["Fashion Item", "Wear", "Style Product"],
    priceRange: { min: 500, max: 10000 },
    variantAxes: () => ({
      Size: ["S", "M", "L", "XL"],
      Color: faker.helpers.arrayElements(["Black", "White", "Blue", "Pink", "Beige"], { min: 2, max: 3 }),
    }),
    extraAttributes: () => ({
      Material: faker.helpers.arrayElement(["Cotton", "Denim", "Polyester"]),
    }),
  },

  men: {
    brands: ["Nike", "Adidas", "Levis", "Puma", "H&M"],
    productTypes: ["Shirt", "T-Shirt", "Jeans", "Jacket", "Hoodie"],
    priceRange: { min: 600, max: 7000 },
    variantAxes: () => ({
      Size: ["S", "M", "L", "XL"],
      Color: faker.helpers.arrayElements(["Black", "Blue", "White", "Gray", "Olive"], { min: 2, max: 3 }),
    }),
    extraAttributes: () => ({
      Fit: faker.helpers.arrayElement(["Regular", "Slim", "Relaxed"]),
    }),
  },

  women: {
    brands: ["Zara", "Only", "Biba", "H&M", "Forever 21"],
    productTypes: ["Dress", "Top", "Kurti", "Jeans", "Jacket"],
    priceRange: { min: 700, max: 9000 },
    variantAxes: () => ({
      Size: ["S", "M", "L", "XL"],
      Color: faker.helpers.arrayElements(["Pink", "Black", "White", "Maroon", "Blue"], { min: 2, max: 3 }),
    }),
    extraAttributes: () => ({
      Material: faker.helpers.arrayElement(["Cotton", "Rayon", "Silk"]),
    }),
  },

  footwear: {
    brands: ["Nike", "Adidas", "Puma", "Bata", "Woodland"],
    productTypes: ["Shoes", "Sneakers", "Sandals", "Boots"],
    priceRange: { min: 800, max: 12000 },
    variantAxes: () => ({
      Size: faker.helpers.arrayElements(["6", "7", "8", "9", "10"], { min: 3, max: 5 }),
      Color: faker.helpers.arrayElements(["Black", "White", "Brown", "Blue"], { min: 2, max: 3 }),
    }),
    extraAttributes: () => ({
      Material: faker.helpers.arrayElement(["Leather", "Mesh", "Synthetic"]),
    }),
  },

  accessories: {
    brands: ["Fastrack", "Titan", "Wildcraft", "Hidesign"],
    productTypes: ["Wallet", "Belt", "Bag", "Cap", "Sunglasses"],
    priceRange: { min: 400, max: 8000 },
    variantAxes: () => ({
      Color: faker.helpers.arrayElements(["Black", "Brown", "Blue", "Gray"], { min: 2, max: 3 }),
    }),
    extraAttributes: () => ({
      Material: faker.helpers.arrayElement(["Leather", "Canvas", "Metal", "Plastic"]),
      Style: faker.helpers.arrayElement(["Casual", "Formal", "Travel"]),
    }),
  },

  home: {
    brands: ["Home Centre", "Ikea", "Cello", "Milton"],
    productTypes: ["Home Product", "Utility Item", "Decor Item"],
    priceRange: { min: 400, max: 30000 },
    variantAxes: () => ({
      Color: faker.helpers.arrayElements(["White", "Brown", "Black", "Beige"], { min: 2, max: 3 }),
    }),
    extraAttributes: () => ({
      Material: faker.helpers.arrayElement(["Wood", "Plastic", "Steel", "Glass"]),
      Usage: faker.helpers.arrayElement(["Indoor", "Kitchen", "Bedroom", "Living Room"]),
    }),
  },

  kitchen: {
    brands: ["Prestige", "Pigeon", "Hawkins", "Milton"],
    productTypes: ["Cookware Set", "Pan", "Bottle", "Mixer", "Knife Set"],
    priceRange: { min: 400, max: 15000 },
    variantAxes: () => ({
      Color: faker.helpers.arrayElements(["Silver", "Black", "Red"], { min: 2, max: 3 }),
    }),
    extraAttributes: () => ({
      Material: faker.helpers.arrayElement(["Steel", "Aluminium", "Non-stick"]),
      Capacity: faker.helpers.arrayElement(["500ml", "1L", "2L", "5L"]),
    }),
  },

  furniture: {
    brands: ["Ikea", "Durian", "Urban Ladder", "HomeTown"],
    productTypes: ["Sofa", "Chair", "Table", "Bed", "Wardrobe"],
    priceRange: { min: 3000, max: 90000 },
    variantAxes: () => ({
      Color: faker.helpers.arrayElements(["Brown", "Black", "White", "Beige"], { min: 2, max: 3 }),
    }),
    extraAttributes: () => ({
      Material: faker.helpers.arrayElement(["Wood", "Metal", "Engineered Wood"]),
      Finish: faker.helpers.arrayElement(["Matte", "Glossy", "Natural"]),
    }),
  },

  decor: {
    brands: ["Home Centre", "Ikea", "Urban Ladder", "Dekor"],
    productTypes: ["Lamp", "Wall Art", "Vase", "Mirror", "Clock"],
    priceRange: { min: 500, max: 12000 },
    variantAxes: () => ({
      Color: faker.helpers.arrayElements(["Gold", "White", "Black", "Brown", "Beige"], { min: 2, max: 3 }),
    }),
    extraAttributes: () => ({
      Material: faker.helpers.arrayElement(["Glass", "Wood", "Metal", "Ceramic"]),
      Placement: faker.helpers.arrayElement(["Wall", "Table", "Floor"]),
    }),
  },

  storage: {
    brands: ["Cello", "Milton", "Ikea", "HomeTown"],
    productTypes: ["Storage Box", "Organizer", "Rack", "Shelf", "Basket"],
    priceRange: { min: 300, max: 10000 },
    variantAxes: () => ({
      Size: faker.helpers.arrayElements(["Small", "Medium", "Large"], { min: 2, max: 3 }),
      Color: faker.helpers.arrayElements(["White", "Brown", "Gray", "Blue"], { min: 2, max: 2 }),
    }),
    extraAttributes: () => ({
      Material: faker.helpers.arrayElement(["Plastic", "Wood", "Metal", "Fabric"]),
    }),
  },

  beauty: {
    brands: ["Mamaearth", "Minimalist", "Cetaphil", "Neutrogena"],
    productTypes: ["Beauty Product", "Care Item", "Cosmetic"],
    priceRange: { min: 250, max: 5000 },
    variantAxes: () => ({
      Volume: faker.helpers.arrayElements(["30ml", "50ml", "100ml", "200ml"], { min: 2, max: 3 }),
    }),
    extraAttributes: () => ({
      "Skin Type": faker.helpers.arrayElement(["Oily", "Dry", "Sensitive", "Combination"]),
    }),
  },

  skincare: {
    brands: ["Cetaphil", "Minimalist", "The Ordinary", "Neutrogena"],
    productTypes: ["Face Wash", "Serum", "Moisturizer", "Sunscreen"],
    priceRange: { min: 300, max: 2500 },
    variantAxes: () => ({
      Volume: faker.helpers.arrayElements(["30ml", "50ml", "100ml"], { min: 2, max: 3 }),
    }),
    extraAttributes: () => ({
      "Skin Type": faker.helpers.arrayElement(["Oily", "Dry", "Sensitive", "Combination"]),
    }),
  },

  makeup: {
    brands: ["Maybelline", "Lakme", "MAC", "Nykaa", "L'Oreal"],
    productTypes: ["Lipstick", "Foundation", "Compact", "Eyeliner", "Blush"],
    priceRange: { min: 250, max: 4000 },
    variantAxes: () => ({
      Shade: faker.helpers.arrayElements(["Natural", "Warm", "Cool", "Rose", "Nude"], { min: 2, max: 4 }),
    }),
    extraAttributes: () => ({
      Finish: faker.helpers.arrayElement(["Matte", "Glossy", "Satin"]),
    }),
  },

  haircare: {
    brands: ["Loreal", "Tresemme", "Dove", "Mamaearth", "Pantene"],
    productTypes: ["Shampoo", "Conditioner", "Hair Oil", "Hair Serum", "Hair Mask"],
    priceRange: { min: 200, max: 3000 },
    variantAxes: () => ({
      Volume: faker.helpers.arrayElements(["100ml", "200ml", "500ml"], { min: 2, max: 3 }),
    }),
    extraAttributes: () => ({
      "Hair Type": faker.helpers.arrayElement(["Dry", "Oily", "Curly", "Straight"]),
    }),
  },

  sports: {
    brands: ["Nike", "Adidas", "Puma", "Nivia"],
    productTypes: ["Sports Item", "Training Gear", "Fitness Product"],
    priceRange: { min: 500, max: 20000 },
    variantAxes: () => ({
      Size: faker.helpers.arrayElements(["S", "M", "L", "XL"], { min: 2, max: 4 }),
      Color: faker.helpers.arrayElements(["Black", "Blue", "Red", "White"], { min: 2, max: 3 }),
    }),
    extraAttributes: () => ({
      Usage: faker.helpers.arrayElement(["Gym", "Outdoor", "Training", "Match"]),
    }),
  },

  fitness: {
    brands: ["Nike", "Adidas", "Puma", "Decathlon", "Nivia"],
    productTypes: ["Dumbbell", "Yoga Mat", "Resistance Band", "Kettlebell", "Treadmill Accessory"],
    priceRange: { min: 500, max: 25000 },
    variantAxes: () => ({
      Weight: faker.helpers.arrayElements(["2kg", "5kg", "10kg", "20kg"], { min: 2, max: 4 }),
      Color: faker.helpers.arrayElements(["Black", "Blue", "Red", "Gray"], { min: 2, max: 2 }),
    }),
    extraAttributes: () => ({
      Usage: faker.helpers.arrayElement(["Home Workout", "Gym", "Strength Training"]),
    }),
  },

  cricket: {
    brands: ["SG", "SS", "MRF", "Kookaburra", "Adidas"],
    productTypes: ["Bat", "Ball", "Pads", "Gloves", "Helmet"],
    priceRange: { min: 300, max: 30000 },
    variantAxes: () => ({
      Size: faker.helpers.arrayElements(["Youth", "Adult", "Full"], { min: 2, max: 3 }),
    }),
    extraAttributes: () => ({
      Level: faker.helpers.arrayElement(["Beginner", "Intermediate", "Professional"]),
      Material: faker.helpers.arrayElement(["Leather", "Willow", "PVC", "Foam"]),
    }),
  },

  football: {
    brands: ["Nike", "Adidas", "Puma", "Nivia", "Kipsta"],
    productTypes: ["Football", "Studs", "Jersey", "Shin Guard", "Goalkeeper Gloves"],
    priceRange: { min: 400, max: 15000 },
    variantAxes: () => ({
      Size: faker.helpers.arrayElements(["3", "4", "5"], { min: 2, max: 3 }),
      Color: faker.helpers.arrayElements(["Black", "White", "Red", "Blue", "Green"], { min: 2, max: 3 }),
    }),
    extraAttributes: () => ({
      Surface: faker.helpers.arrayElement(["Grass", "Turf", "Indoor"]),
    }),
  },

  default: {
    brands: ["Nova", "Prime", "Elite", "Urban"],
    productTypes: ["Product", "Item", "Collection"],
    priceRange: { min: 500, max: 15000 },
    variantAxes: () => ({
      Color: faker.helpers.arrayElements(["Black", "White", "Blue"], { min: 2, max: 3 }),
    }),
    extraAttributes: () => ({
      Quality: faker.helpers.arrayElement(["Basic", "Standard", "Premium"]),
    }),
  },
};

const detectProfile = (category) => {
  const text = `${category.name} ${category.slug}`.toLowerCase();

  if (text.includes("electronics")) return categoryProfiles.electronics;
  if (text.includes("mobile")) return categoryProfiles.mobiles;
  if (text.includes("laptop")) return categoryProfiles.laptops;
  if (text.includes("headphone")) return categoryProfiles.headphones;
  if (text.includes("watch")) return categoryProfiles.smartwatches;
  if (text.includes("fashion")) return categoryProfiles.fashion;
  if (text.includes("men")) return categoryProfiles.men;
  if (text.includes("women")) return categoryProfiles.women;
  if (text.includes("footwear") || text.includes("shoe")) return categoryProfiles.footwear;
  if (text.includes("accessor")) return categoryProfiles.accessories;
  if (text.includes("home")) return categoryProfiles.home;
  if (text.includes("kitchen")) return categoryProfiles.kitchen;
  if (text.includes("furniture")) return categoryProfiles.furniture;
  if (text.includes("decor")) return categoryProfiles.decor;
  if (text.includes("storage")) return categoryProfiles.storage;
  if (text.includes("beauty")) return categoryProfiles.beauty;
  if (text.includes("skin")) return categoryProfiles.skincare;
  if (text.includes("makeup")) return categoryProfiles.makeup;
  if (text.includes("hair")) return categoryProfiles.haircare;
  if (text.includes("sports")) return categoryProfiles.sports;
  if (text.includes("fitness")) return categoryProfiles.fitness;
  if (text.includes("cricket")) return categoryProfiles.cricket;
  if (text.includes("football")) return categoryProfiles.football;

  return categoryProfiles.default;
};

const buildName = (profile, categoryName, index) => {
  const brand = faker.helpers.arrayElement(profile.brands);
  const type = faker.helpers.arrayElement(profile.productTypes);
  const suffix = faker.helpers.arrayElement(["Pro", "Max", "Plus", "Lite", "2026"]);
  return `${brand} ${type} ${suffix} ${categoryName} ${index}`;
};

/**
 * Generate a SKU string from the product name and variant attributes.
 * e.g. "Nike Shoes Pro Footwear 1" + {Color: "Black", Size: "9"} → "NIK-SHO-BLK-9"
 */
const generateSku = (productName, attributes) => {
  const namePart = productName
    .split(" ")
    .slice(0, 2)
    .map((w) => w.substring(0, 3).toUpperCase())
    .join("-");
  // attributes is now an EAV array: [{ name, value }]
  const attrPart = attributes
    .map((a) => a.value.substring(0, 3).toUpperCase())
    .join("-");
  return `${namePart}-${attrPart}`;
};

/**
 * Build variants by creating a cartesian product of all variant axes,
 * with shared extra attributes merged into each variant's attributes.
 */
const buildVariants = (profile, productName) => {
  const axes = profile.variantAxes();
  const extra = profile.extraAttributes();
  const basePrice = Number(
    faker.commerce.price({
      min: profile.priceRange.min,
      max: profile.priceRange.max,
      dec: 0,
    })
  );

  // Build cartesian product of all axes
  const axisKeys = Object.keys(axes);
  let combos = [{}];

  for (const key of axisKeys) {
    const values = axes[key];
    const newCombos = [];
    for (const combo of combos) {
      for (const val of values) {
        newCombos.push({ ...combo, [key]: val });
      }
    }
    combos = newCombos;
  }

  // Cap at 6 variants max per product to keep DB reasonable
  if (combos.length > 6) {
    combos = faker.helpers.arrayElements(combos, { min: 3, max: 6 });
  }

  return combos.map((combo) => {
    const merged = { ...extra, ...combo };
    // Convert to EAV array: [{ name, value }]
    const attributes = Object.entries(merged).map(([name, value]) => ({ name, value }));
    // Slight price variation per variant (±10%)
    const priceVariation = Math.round(basePrice * (1 + (Math.random() * 0.2 - 0.1)));
    return {
      attributes,
      price: priceVariation,
      stock: faker.number.int({ min: 0, max: 100 }),
      sku: generateSku(productName, attributes),
    };
  });
};

const seedProducts = async () => {
  await mongoose.connect(process.env.MONGODB_URL);

  // Delete all existing products first
  const deleteResult = await Product.deleteMany({});
  console.log(`Deleted ${deleteResult.deletedCount} existing products.`);

  // Only seed products into leaf categories (those with a parentId)
  // Root categories are parent containers, not product destinations
  const categories = await Category.find({ isActive: true, parentId: { $ne: null } });

  if (!categories.length) {
    throw new Error("No active leaf categories found. Seed categories first.");
  }

  console.log(`Found ${categories.length} leaf categories to seed products into.`);

  let totalCreated = 0;

  for (const category of categories) {
    const profile = detectProfile(category);

    for (let i = 1; i <= PRODUCTS_PER_CATEGORY; i++) {
      const name = buildName(profile, category.name, i);
      const variants = buildVariants(profile, name);

      const productData = {
        name,
        description: faker.commerce.productDescription(),
        categoryId: category._id.toString(),
        images: [faker.image.urlPicsumPhotos()],
        variants,
        createdBy: ADMIN_ID,
        isActive: true,
      };

      await createProduct(productData);
      totalCreated++;
    }
  }

  console.log(`Created ${totalCreated} products with variants.`);
  await mongoose.disconnect();
};

seedProducts()
  .then(() => {
    console.log("Products seeded successfully in all categories");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Product seeding failed:", error.message);
    process.exit(1);
  });