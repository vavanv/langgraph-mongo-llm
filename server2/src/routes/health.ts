import { Router, Request, Response } from "express";
import { MongoClient } from "mongodb";
import { QdrantClient } from "@qdrant/js-client-rest";
import { logger } from "../utils/logger";

const router = Router();

// Health check endpoint
// curl -X GET http://localhost:3000/health
router.get("/", async (_: Request, res: Response) => {
  try {
    const healthStatus: any = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {},
    };

    // Check MongoDB connection
    try {
      // We need to get the client from somewhere - this will be passed when mounting the router
      // For now, we'll create a new client for health checks
      const client = new MongoClient(process.env.MONGODB_ATLAS_URI as string);
      await client.connect();
      await client.db("admin").command({ ping: 1 });
      await client.close();
      healthStatus.services.mongo = { status: "healthy" };
    } catch (error) {
      healthStatus.services.mongo = {
        status: "unhealthy",
        error: (error as Error).message,
      };
      healthStatus.status = "degraded";
    }

    // Check Qdrant connection
    try {
      const qdrantClient = new QdrantClient({
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY,
      });
      await qdrantClient.getCollections();
      healthStatus.services.qdrant = { status: "healthy" };
    } catch (error) {
      healthStatus.services.qdrant = {
        status: "unhealthy",
        error: (error as Error).message,
      };
      healthStatus.status = "degraded";
    }

    // Return appropriate status code
    const statusCode = healthStatus.status === "healthy" ? 200 : 503;
    res.status(statusCode).json(healthStatus);

    logger.info(`Health check completed: ${healthStatus.status}`);
  } catch (error) {
    logger.error("Health check failed:", error);
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: (error as Error).message,
    });
  }
});

export default router;
