import { OpenAIEmbeddings } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { StateGraph } from "@langchain/langgraph";
import { Annotation } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { QdrantClient } from "@qdrant/js-client-rest";
import { MongoClient } from "mongodb";
import { z } from "zod";
import "dotenv/config";

export async function callAgent(
  client: MongoClient,
  query: string,
  thread_id: string
) {
  // Define the MongoDB database and collection
  const dbName = "hr_database";
  const db = client.db(dbName);
  const collection = db.collection("employees");

  // Define the graph state
  const GraphState = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
      reducer: (x, y) => x.concat(y),
    }),
  });

  // Define the tools for the agent to use
  const employeeLookupTool = tool(
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

  const tools = [employeeLookupTool];

  // We can extract the state typing via `GraphState.State`
  const toolNode = new ToolNode<typeof GraphState.State>(tools);

  const model = new ChatAnthropic({
    model: "claude-3-5-sonnet-20240620",
    temperature: 0,
    apiKey: process.env.ANTHROPIC_API_KEY,
  }).bindTools(tools);

  // Define the function that determines whether to continue or not
  function shouldContinue(state: typeof GraphState.State) {
    const messages = state.messages;
    const lastMessage = messages[messages.length - 1] as AIMessage;

    // If the LLM makes a tool call, then we route to the "tools" node
    if (lastMessage.tool_calls?.length) {
      return "tools";
    }
    // Otherwise, we stop (reply to the user)
    return "__end__";
  }

  // Define the function that calls the model
  async function callModel(state: typeof GraphState.State) {
    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `You are a helpful AI assistant, collaborating with other assistants. Use the provided tools to progress towards answering the question. If you are unable to fully answer, that's OK, another assistant with different tools will help where you left off. Execute what you can to make progress. If you or any of the other assistants have the final answer or deliverable, prefix your response with FINAL ANSWER so the team knows to stop. You have access to the following tools: {tool_names}.\n{system_message}\nCurrent time: {time}.`,
      ],
      new MessagesPlaceholder("messages"),
    ]);

    const formattedPrompt = await prompt.formatMessages({
      system_message: "You are helpful HR Chatbot Agent.",
      time: new Date().toISOString(),
      tool_names: tools.map((tool) => tool.name).join(", "),
      messages: state.messages,
    });

    const result = await model.invoke(formattedPrompt);

    return { messages: [result] };
  }

  // Define a new graph
  const workflow = new StateGraph(GraphState)
    .addNode("agent", callModel)
    .addNode("tools", toolNode)
    .addEdge("__start__", "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("tools", "agent");

  // Initialize the MongoDB memory to persist state between graph runs
  const checkpointer = new MongoDBSaver({ client, dbName });

  // This compiles it into a LangChain Runnable.
  // Note that we're passing the memory when compiling the graph
  const app = workflow.compile({ checkpointer });

  // Use the Runnable
  const finalState = await app.invoke(
    {
      messages: [new HumanMessage(query)],
    },
    { recursionLimit: 15, configurable: { thread_id: thread_id } }
  );

  // console.log(JSON.stringify(finalState.messages, null, 2));
  console.log(finalState.messages[finalState.messages.length - 1].content);

  return finalState.messages[finalState.messages.length - 1].content;
}
