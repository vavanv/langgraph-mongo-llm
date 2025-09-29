import { OpenAIEmbeddings } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { QdrantClient } from "@qdrant/js-client-rest";
import { Collection } from "mongodb";
import { z } from "zod";
import "dotenv/config";
import { logger } from "../../utils/logger";

export const employeeLookupTool = (collection: Collection) =>
  tool(
    async (input: unknown) => {
      logger.debug(`Employee lookup tool input: ${JSON.stringify(input)}`);
      const { query, n = 100 } = input as { query: string; n?: number };
      logger.info(`Employee lookup tool called with query: "${query}"`);

      try {
        // Initialize embeddings
        const embeddings = new OpenAIEmbeddings();

        // Embed the query
        const queryEmbedding = await embeddings.embedQuery(query);
        logger.debug(
          `Query embedded successfully, vector length: ${queryEmbedding.length}`
        );

        // Initialize Qdrant client
        const qdrantClient = new QdrantClient({
          url: process.env.QDRANT_URL || "http://localhost:6333",
          apiKey: process.env.QDRANT_API_KEY,
        });

        logger.debug(`Searching Qdrant for: ${query}`);
        // Search for similar vectors
        const searchResult = await qdrantClient.search("employees", {
          vector: queryEmbedding,
          limit: n,
          with_payload: true,
        });

        logger.debug(`Qdrant search returned ${searchResult.length} results`);

        if (searchResult.length === 0) {
          // Try to get collection info to debug
          try {
            const collectionInfo = await qdrantClient.getCollection(
              "employees"
            );
            logger.debug("Collection info:", collectionInfo);
          } catch (error) {
            logger.warn("Error getting collection info:", error);
          }
        }

        // Define projection to fetch only necessary fields for performance
        const employeeProjection = {
          employee_id: 1,
          first_name: 1,
          last_name: 1,
          job_details: 1,
          work_location: 1,
          contact_details: 1,
          skills: 1,
          department: 1, // Add computed field for easier access
          _id: 0, // Exclude MongoDB _id field
        };

        // For each result, fetch the employee data from MongoDB using employee_id with projection
        const enrichedResults = await Promise.all(
          searchResult.map(async (point) => {
            const employeeId = point.payload?.employee_id;
            logger.debug(`Looking up employee: ${employeeId}`);
            const employeeData = await collection.findOne(
              { employee_id: employeeId },
              { projection: employeeProjection }
            );

            // Add computed department field for easier access
            if (employeeData) {
              (employeeData as any).department =
                employeeData.job_details?.department;
            }

            logger.debug(`Found employee data: ${!!employeeData}`);
            return {
              score: point.score,
              summary: point.payload?.summary,
              employee: employeeData,
            };
          })
        );

        logger.info(`Returning ${enrichedResults.length} enriched results`);
        return JSON.stringify(enrichedResults);
      } catch (error) {
        logger.error("Error in employee lookup tool:", error);
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
