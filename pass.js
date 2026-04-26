import { hashpassword } from "./src/utils/hash.js";
const hashedpassword = await hashpassword("#1@Devdeep");
console.log(hashedpassword);