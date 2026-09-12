import "dotenv/config";
import env from "./config/env.js";
import prisma from "./config/db.js";
import app from "./app.js";
import { connectMongoDB } from "./config/mongodb.js";
import logger from "./config/logger.js";

const PORT = env.PORT;

async function startServer() {
  try {
    await connectMongoDB();
    await prisma.$connect();
    logger.info("PostgreSQL is connected");
    app.listen(PORT, () => {
      logger.info(`Server is running at http://localhost:${PORT}`);
    });
  } catch (err) {
    logger.error("Failed to start server", err);
    process.exit(1);
  }
}

startServer();