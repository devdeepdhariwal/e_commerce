// const express = require("express"); -> can't be used as type:module in package.json
import express from "express";
import router from "./routes/auth.routes.js";
import errorHandler from "./middlewares/errorHandler.js";
import cookieParser from "cookie-parser";


const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/auth",router);
app.use(errorHandler);
export default app; //es modules(esm)