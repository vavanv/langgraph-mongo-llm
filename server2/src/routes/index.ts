import { Router, Request, Response } from "express";

const router = Router();

// Basic health check endpoint
// curl -X GET http://localhost:3000/
router.get("/", (_: Request, res: Response) => {
  res.send("LangGraph Agent Server with Qdrant");
});

export default router;
