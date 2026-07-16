import "dotenv/config";
import prisma from "./config/db.js";
import app from "./app.js"; 
import { connectMongoDB } from './config/mongodb.js';
const PORT = process.env.PORT || 3000;

async function startServer(){
try{
await connectMongoDB();
await prisma.$connect();
console.log("PostgreSQL is connected");
app.listen(PORT, ()=>{
    console.log(`Server is running at http://localhost:${PORT}`);
});
}
catch(err){
    console.error(err);
    process.exit(1);
}
}


startServer();