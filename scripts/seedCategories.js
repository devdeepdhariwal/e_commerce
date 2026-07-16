import mongoose from "mongoose";
import dotenv from "dotenv";
import { createCategory } from "../src/services/categories.service.js";

dotenv.config();

const categoryTree = [
  {
    name: "Electronics",
    children: ["Mobiles", "Laptops", "Headphones", "Smartwatches"],
  },
  {
    name: "Fashion",
    children: ["Men", "Women", "Footwear", "Accessories"],
  },
  {
    name: "Home",
    children: ["Kitchen", "Furniture", "Decor", "Storage"],
  },
  {
    name: "Beauty",
    children: ["Skincare", "Makeup", "Haircare"],
  },
  {
    name: "Sports",
    children: ["Fitness", "Cricket", "Football"],
  },
];

const seedCategories = async () => {
  await mongoose.connect(process.env.MONGODB_URL);

  for (const rootCategory of categoryTree) {
    const createdRoot = await createCategory(rootCategory.name);

    for (const childName of rootCategory.children) {
      await createCategory(childName, createdRoot._id.toString());
    }
  }

  await mongoose.disconnect();
};

seedCategories()
  .then(() => {
    console.log("Categories seeded successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Category seeding failed:", error.message);
    process.exit(1);
  });