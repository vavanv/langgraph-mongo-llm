import { ChatAnthropic } from "@langchain/anthropic";
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { StateGraph, Annotation } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { MongoClient } from "mongodb";
import { employeeLookupTool } from "./tools/employee-lookup";
import { StructuredToolInterface } from "@langchain/core/tools";
import retry from "async-retry";
import "dotenv/config";

// Database configuration
const DB_NAME = "hr_database";

// Node names for the workflow graph
enum NodeNames {
  START = "__start__",
  AGENT = "agent",
  TOOLS = "tools",
  END = "__end__",
}

// Type definitions for better type safety
interface AgentState {
  messages: BaseMessage[];
}

// Initialize static components
const model = new ChatAnthropic({
  model: "claude-3-5-sonnet-20240620",
  temperature: 0,
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function getEmployeeCollection(client: MongoClient) {
  const db = client.db(DB_NAME);
  return db.collection("employees");
}

async function callModel(
  state: AgentState,
  tools: StructuredToolInterface[],
  model: any
) {
  try {
    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `You are a helpful AI assistant, collaborating with other assistants.
Use the provided tools to progress towards answering the question.
If you are unable to fully answer, that's OK, another assistant with different tools will help where you left off.
Execute what you can to make progress.
If you or any of the other assistants have the final answer or deliverable,
prefix your response with FINAL ANSWER so the team knows to stop.
You have access to the following tools: {tool_names}.\n{system_message}\nCurrent time: {time}.`,
      ],
      new MessagesPlaceholder("messages"),
    ]);

    const formattedPrompt = await prompt.formatMessages({
      system_message: "You are helpful HR Chatbot Agent.",
      time: new Date().toISOString(),
      tool_names: tools.map((tool) => tool.name).join(", "),
      messages: state.messages,
    });
    console.log(`API call: ${formattedPrompt.length} messages`);

    const result = await retry(
      async () => {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Model timeout")), 10000)
        );
        return Promise.race([model.invoke(formattedPrompt), timeoutPromise]);
      },
      {
        retries: 3,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 5000,
      }
    );
    console.log(`API response tokens: ${result.content.length}`);

    return { messages: [result] };
  } catch (error) {
    console.error("Error in callModel:", error);
    return { messages: [new AIMessage("Error: Unable to process request.")] };
  }
}

function shouldContinue(state: AgentState): string {
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
  return lastMessage.tool_calls?.length ? NodeNames.TOOLS : NodeNames.END;
}

/**
 * Creates and compiles the LangGraph workflow
 * @param tools - Array of tools to be used by the agent
 * @param model - The bound language model
 * @param client - MongoDB client for checkpointing
 * @returns Compiled workflow application
 */
function createWorkflow(
  tools: StructuredToolInterface[],
  model: any,
  client: MongoClient
) {
  // Define the graph state
  const GraphState = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
      reducer: (x, y) => x.concat(y),
    }),
  });

  // Create the workflow graph
  const workflow = new StateGraph(GraphState)
    .addNode(NodeNames.AGENT, (state) => callModel(state, tools, model))
    .addNode(NodeNames.TOOLS, new ToolNode<typeof GraphState.State>(tools))
    .addEdge(NodeNames.START, NodeNames.AGENT)
    .addConditionalEdges(NodeNames.AGENT, shouldContinue)
    .addEdge(NodeNames.TOOLS, NodeNames.AGENT);

  // Initialize the MongoDB memory to persist state between graph runs
  const checkpointer = new MongoDBSaver({ client, dbName: DB_NAME });

  // Compile and return the workflow
  return workflow.compile({ checkpointer });
}

export async function callAgent(
  client: MongoClient,
  query: string,
  thread_id: string
) {
  try {
    const collection = getEmployeeCollection(client);
    const employeeLookup = employeeLookupTool(collection);
    const tools: StructuredToolInterface[] = [employeeLookup];
    const boundModel = model.bindTools(tools);

    // Create the workflow using the extracted function
    const app = createWorkflow(tools, boundModel, client);

    const finalState = await retry(
      async () => {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Workflow timeout")), 30000)
        );
        return Promise.race([
          app.invoke(
            { messages: [new HumanMessage(query)] },
            { recursionLimit: 5, configurable: { thread_id: thread_id } }
          ),
          timeoutPromise,
        ]);
      },
      { retries: 2, factor: 2, minTimeout: 1000, maxTimeout: 5000 }
    );

    const finalStateTyped = finalState as { messages: BaseMessage[] };
    const finalMessage =
      finalStateTyped.messages[finalStateTyped.messages.length - 1].content;
    console.log(`Final response: ${finalMessage}`);
    return finalMessage;
  } catch (error) {
    console.error("Error in callAgent:", error);
    return "Sorry, something went wrong while processing your request.";
  }
}
