import { OpenAIEmbeddings } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { QdrantClient } from "@qdrant/js-client-rest";
import { MongoClient } from "mongodb";
import { z } from "zod";
import "dotenv/config";

export const employeeLookupTool = (collection: any) =>
  tool(
    async (input: unknown) => {
      const { query, n = 100 } = input as { query: string; n?: number };
      console.log("Employee lookup tool called with query:", query);

      try {
        // Initialize embeddings
        const embeddings = new OpenAIEmbeddings();

        // Embed the query
        const queryEmbedding = await embeddings.embedQuery(query);
        console.log(
          "Query embedded successfully, vector length:",
          queryEmbedding.length
        );

        // Initialize Qdrant client
        const qdrantClient = new QdrantClient({
          url: process.env.QDRANT_URL || "http://localhost:6333",
          apiKey: process.env.QDRANT_API_KEY,
        });

        console.log("Searching Qdrant for:", query);
        // Search for similar vectors
        const searchResult = await qdrantClient.search("employees", {
          vector: queryEmbedding,
          limit: n,
          with_payload: true,
        });

        console.log("Qdrant search returned", searchResult.length, "results");

        if (searchResult.length === 0) {
          // Try to get collection info to debug
          try {
            const collectionInfo = await qdrantClient.getCollection(
              "employees"
            );
            console.log("Collection info:", collectionInfo);
          } catch (error) {
            console.log("Error getting collection info:", error);
          }
        }

        // For each result, fetch the full employee data from MongoDB using employee_id
        const enrichedResults = await Promise.all(
          searchResult.map(async (point) => {
            const employeeId = point.payload?.employee_id;
            console.log("Looking up employee:", employeeId);
            const employeeData = await collection.findOne({
              employee_id: employeeId,
            });
            console.log("Found employee data:", !!employeeData);
            return {
              score: point.score,
              summary: point.payload?.summary,
              employee: employeeData,
            };
          })
        );

        console.log("Returning", enrichedResults.length, "enriched results");
        return JSON.stringify(enrichedResults);
      } catch (error) {
        console.error("Error in employee lookup tool:", error);
        return JSON.stringify({ error: (error as Error).message, query });
      }
    },
    {
      name: "employee_lookup",
      description: "Gathers employee details from the HR database",
      schema: z.object({
        query: z.string().describe("The search query"),
        n: z
          .number()
          .optional()
          .default(100)
          .describe("Number of results to return"),
      }),
    }
  );
