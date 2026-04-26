// const express = require("express"); -> can't be used as type:module in package.json
import express from "express";
import authRoutes from "./routes/auth.routes.js";
import productRoutes from "./routes/product.routes.js"
import errorHandler from "./middlewares/errorHandler.js";
import cookieParser from "cookie-parser";


const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/auth",authRoutes);
app.use("/products",productRoutes);
app.use(errorHandler);
export default app; //es modules(esm)