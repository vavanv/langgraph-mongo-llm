import "dotenv/config";
import express, { Express, Request, Response } from "express";
import { MongoClient } from "mongodb";
import { callAgent } from "./agent/agent";
import { z } from "zod";

const app: Express = express();
app.use(express.json());

// Input validation schemas
const chatRequestSchema = z.object({
  message: z.string().min(1, "Message cannot be empty").max(1000, "Message too long"),
});

const threadIdSchema = z.string().min(1, "Thread ID cannot be empty").max(100, "Thread ID too long");

// Environment variable validation
function validateEnvironmentVariables() {
  const requiredVars = [
    'MONGODB_ATLAS_URI',
    'ANTHROPIC_API_KEY',
    'OPENAI_API_KEY'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  console.log('Environment variables validated successfully');
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

    // Set up basic Express route
    // curl -X GET http://localhost:3000/
    app.get("/", (_: Request, res: Response) => {
      res.send("LangGraph Agent Server with Qdrant");
    });

    // API endpoint to start a new conversation
    // curl -X POST -H "Content-Type: application/json" -d '{"message": "Build a team to make an iOS app, and tell me the talent gaps."}' http://localhost:3000/chat
    app.post("/chat", async (req: Request, res: Response) => {
      try {
        const { message } = chatRequestSchema.parse(req.body);
        const threadId = Date.now().toString(); // Simple thread ID generation
        const response = await callAgent(client, message, threadId);
        res.json({ threadId, response });
      } catch (error) {
        if (error instanceof z.ZodError) {
          res.status(400).json({ error: "Invalid request", details: error.issues });
        } else {
          console.error("Error starting conversation:", error);
          res.status(500).json({ error: "Internal server error" });
        }
      }
    });

    // API endpoint to send a message in an existing conversation
    // curl -X POST -H "Content-Type: application/json" -d '{"message": "What team members did you recommend?"}' http://localhost:3000/chat/123456789
    app.post("/chat/:threadId", async (req: Request, res: Response) => {
      try {
        const threadId = threadIdSchema.parse(req.params.threadId);
        const { message } = chatRequestSchema.parse(req.body);
        const response = await callAgent(client, message, threadId);
        res.json({ response });
      } catch (error) {
        if (error instanceof z.ZodError) {
          res.status(400).json({ error: "Invalid request", details: error.issues });
        } else {
          console.error("Error in chat:", error);
          res.status(500).json({ error: "Internal server error" });
        }
      }
    });

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
