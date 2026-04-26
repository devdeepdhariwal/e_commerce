import "dotenv/config";
import 'module-alias/register';
import prisma from "./config/db.js";
import app from "./app.js"; 
import { connectMongoDB } from './config/mongodb.js';
const PORT = 3000;

async function startserver(){
try{
await connectMongoDB();
await prisma.$connect();
console.log("PostreSql is connected");
app.listen(PORT, ()=>{
    console.log(`Server is running at http://localhost:${PORT}`);
});
}
catch(err){
    console.error(err);
    process.exit(1);
}
}


startserver();