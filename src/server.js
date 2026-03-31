import 'module-alias/register';
import authroutes from "./routes/auth.routes.js"
import prisma from "./config/db.js";
import app from "./app.js"; 
const PORT = 3000;

async function startserver(){
try{
await prisma.$connect();
console.log("DB is connected");

app.use("/auth",authroutes);

app.listen(PORT, ()=>{
    console.log(`Server is running at http://localhost:${PORT}`);
});
}

catch(err){
    console.error(err);
}
}
startserver();