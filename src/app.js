// const express = require("express"); -> can't be used as type:module in package.json
import express from "express";
const app = express();
app.use(express.json());

app.get("/health",(req,res)=>{
    res.send("ok");
})

export default app; //es modules(esm)