import "dotenv/config";
import express, { Express } from "express";
import { MongoClient } from "mongodb";
import { logger } from "./utils/logger";
import { requestLogger, corsMiddleware, responseFormatter, errorHandler } from "./middleware";
import indexRoutes from "./routes/index";
import healthRoutes from "./routes/health";
import chatRoutes, { setMongoClient } from "./routes/chat";

const app: Express = express();

// Middleware
app.use(express.json({ limit: '10mb' })); // Add payload size limit
app.use(requestLogger);
app.use(corsMiddleware);
app.use(responseFormatter);

// Environment variable validation
function validateEnvironmentVariables() {
  const requiredVars = [
    "MONGODB_ATLAS_URI",
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
  ];

  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(", ")}`
    );
  }

  console.log("Environment variables validated successfully");
}

// Initialize MongoDB client with connection pooling
const client = new MongoClient(process.env.MONGODB_ATLAS_URI as string, {
  maxPoolSize: 10, // Maximum number of connections in the connection pool
  minPoolSize: 5, // Minimum number of connections in the connection pool
  maxIdleTimeMS: 30000, // Maximum time a connection can remain idle before being closed
  serverSelectionTimeoutMS: 5000, // How long to wait for server selection
  socketTimeoutMS: 45000, // How long to wait for socket operations
  connectTimeoutMS: 10000, // How long to wait for initial connection
});

async function startServer() {
  try {
    // Validate environment variables first
    validateEnvironmentVariables();

    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    // Set MongoDB client for chat routes
    setMongoClient(client);

    // Mount routes
    app.use("/", indexRoutes);
    app.use("/health", healthRoutes);
    app.use("/chat", chatRoutes);

    // Error handling middleware (must be last)
    app.use(errorHandler);

    const PORT = process.env.PORT || 3000;
    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    // Graceful shutdown handling
    const gracefulShutdown = async () => {
      console.log(
        "Received shutdown signal, closing server and database connections..."
      );
      server.close(async () => {
        console.log("HTTP server closed");
        await client.close();
        console.log("MongoDB connection closed");
        process.exit(0);
      });
    };

    // Handle shutdown signals
    process.on("SIGTERM", gracefulShutdown);
    process.on("SIGINT", gracefulShutdown);
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
}

startServer();
