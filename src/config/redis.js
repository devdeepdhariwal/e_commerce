
import Redis from "ioredis"
if(!process.env.REDIS_URL){
    throw new Error("Redis_url is not defined")
}
const redis = new Redis(process.env.REDIS_URL);
redis.on("error",(err) =>{
 console.error("redis error:",err)
});

redis.on("connect",()=>{
    console.log("redis connected successfully ");
});

export default redis;