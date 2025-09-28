import { Router, Request, Response } from "express";
import { MongoClient } from "mongodb";
import { callAgent } from "../agent/agent";
import { z } from "zod";

const router = Router();

// Input validation schemas
const chatRequestSchema = z.object({
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(1000, "Message too long"),
});

const threadIdSchema = z
  .string()
  .min(1, "Thread ID cannot be empty")
  .max(100, "Thread ID too long");

// Middleware to attach MongoDB client to request
// This will be set when mounting the router
let mongoClient: MongoClient;

// Function to set the MongoDB client
export const setMongoClient = (client: MongoClient) => {
  mongoClient = client;
};

// API endpoint to start a new conversation
// curl -X POST -H "Content-Type: application/json" -d '{"message": "Build a team to make an iOS app, and tell me the talent gaps."}' http://localhost:3000/chat
router.post("/", async (req: Request, res: Response) => {
  try {
    const { message } = chatRequestSchema.parse(req.body);
    const threadId = Date.now().toString(); // Simple thread ID generation
    const response = await callAgent(mongoClient, message, threadId);
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
router.post("/:threadId", async (req: Request, res: Response) => {
  try {
    const threadId = threadIdSchema.parse(req.params.threadId);
    const { message } = chatRequestSchema.parse(req.body);
    const response = await callAgent(mongoClient, message, threadId);
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

export default router;
