import mongoose from "mongoose";
import dotenv from "dotenv"
import product from "./models/product.model.js";
import { connectMongoDB } from "./config/mongodb.js";

dotenv.config();

const ADMIN_ID = "689e908a-6ca2-4e6a-8932-6ceec1fa34d1";

const generateSlug = (name) => {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
};

const categories = ["Shoes", "T-Shirts", "Watches", "Bags", "Caps", "Jackets", "Jeans", "Sunglasses"];

const brands = ["Nike", "Adidas", "Puma", "Reebok", "Levi's", "Zara", "H&M", "Fastrack", "Wildcraft", "Bata"];

const sizes   = ["XS", "S", "M", "L", "XL", "XXL"];
const colors  = ["Red", "Blue", "Black", "White", "Green", "Yellow", "Grey", "Navy"];

const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomPick    = (arr) => arr[Math.floor(Math.random() * arr.length)];

const generateVariants = () => {
    const numVariants = randomBetween(2, 4);
    const variants = [];
    for (let i = 0; i < numVariants; i++) {
        variants.push({
            size  : randomPick(sizes),
            color : randomPick(colors),
            stock : randomBetween(5, 100),
        });
    }
    return variants;
};

const generateProducts = () => {
    const products = [];
    const usedSlugs = new Set();

    for (let i = 1; i <= 100; i++) {
        const brand    = randomPick(brands);
        const category = randomPick(categories);
        const name     = `${brand} ${category} ${i}`;
        let slug       = generateSlug(name);

        // Ensure unique slugs
        if (usedSlugs.has(slug)) {
            slug = `${slug}-${Date.now()}-${i}`;
        }
        usedSlugs.add(slug);

        products.push({
            name,
            slug,
            description : `Premium quality ${category.toLowerCase()} by ${brand}. Designed for comfort and style. Perfect for everyday use.`,
            price       : randomBetween(299, 9999),
            category,
            images      : [
                `https://picsum.photos/seed/${slug}/400/400`,
            ],
            variants    : generateVariants(),
            isActive    : true,
            createdBy   : ADMIN_ID,
        });
    }

    return products;
};

const seedProducts = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URL);
        console.log("✅ Connected to MongoDB");

        // Clear existing products
        await product.deleteMany({});
        console.log("🗑️  Cleared existing products");

        // Insert 100 products
        const products = generateProducts();
        await product.insertMany(products);
        console.log(`🌱 Successfully seeded ${products.length} products`);

        await mongoose.disconnect();
        console.log("🔌 Disconnected from MongoDB");
        process.exit(0);

    } catch (error) {
        console.error("❌ Seeding failed:", error.message);
        process.exit(1);
    }
};

seedProducts();