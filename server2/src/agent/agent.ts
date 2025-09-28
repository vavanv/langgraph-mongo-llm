import { ChatAnthropic } from "@langchain/anthropic";
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { StateGraph, Annotation } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { Runnable } from "@langchain/core/runnables";
import { MongoClient } from "mongodb";
import { employeeLookupTool } from "./tools/employee-lookup";
import { StructuredToolInterface } from "@langchain/core/tools";
import retry from "async-retry";
import "dotenv/config";
import { CONFIG } from "./config/config";
import {
  AgentError,
  ValidationError,
  ModelTimeoutError,
  WorkflowError,
} from "./config/errors";

// Database configuration
const DB_NAME = "hr_database";

// Node names for the workflow graph
enum NodeNames {
  START = "__start__",
  AGENT = "agent",
  TOOLS = "tools",
  END = "__end__",
}

// System prompt template
const SYSTEM_PROMPT = `You are a helpful AI assistant, collaborating with other assistants.
Use the provided tools to progress towards answering the question.
If you are unable to fully answer, that's OK, another assistant with different tools will help where you left off.
Execute what you can to make progress.
If you or any of the other assistants have the final answer or deliverable,
prefix your response with FINAL ANSWER so the team knows to stop.
You have access to the following tools: {tool_names}.
{system_message}
Current time: {time}.`;

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
  model: Runnable
) {
  try {
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", SYSTEM_PROMPT],
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
          setTimeout(
            () => reject(new Error("Model timeout")),
            CONFIG.MODEL_TIMEOUT
          )
        );
        return Promise.race([model.invoke(formattedPrompt), timeoutPromise]);
      },
      {
        retries: CONFIG.MAX_MODEL_RETRIES,
        factor: CONFIG.RETRY_FACTOR,
        minTimeout: CONFIG.RETRY_MIN_TIMEOUT,
        maxTimeout: CONFIG.RETRY_MAX_TIMEOUT,
      }
    );
    console.log(`API response tokens: ${result.content.length}`);

    return { messages: [result] };
  } catch (error) {
    console.error("Error in callModel:", error);
    if (error instanceof Error && error.message.includes("timeout")) {
      throw new ModelTimeoutError();
    }
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
 * @param model - The language model
 * @param client - MongoDB client for checkpointing
 * @returns Compiled workflow application
 */
function createWorkflow(
  tools: StructuredToolInterface[],
  model: BaseChatModel,
  client: MongoClient
) {
  // Define the graph state
  const GraphState = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
      reducer: (x, y) => x.concat(y),
    }),
  });

  // Bind tools to the model
  const boundModel = model.bindTools!(tools);

  // Create the workflow graph
  const workflow = new StateGraph(GraphState)
    .addNode(NodeNames.AGENT, (state) => callModel(state, tools, boundModel))
    .addNode(NodeNames.TOOLS, new ToolNode<typeof GraphState.State>(tools))
    .addEdge(NodeNames.START, NodeNames.AGENT)
    .addConditionalEdges(NodeNames.AGENT, shouldContinue)
    .addEdge(NodeNames.TOOLS, NodeNames.AGENT);

  // Initialize the MongoDB memory to persist state between graph runs
  const checkpointer = new MongoDBSaver({ client, dbName: DB_NAME });

  // Compile and return the workflow
  return workflow.compile({ checkpointer });
}

/**
 * Validates input parameters for the agent
 * @param query - The user query string
 * @param thread_id - The thread identifier
 * @throws ValidationError if validation fails
 */
function validateInputs(query: string, thread_id: string): void {
  if (!query || typeof query !== "string") {
    throw new ValidationError("Query must be a non-empty string");
  }
  if (query.length > CONFIG.MAX_QUERY_LENGTH) {
    throw new ValidationError(
      `Query too long. Maximum length is ${CONFIG.MAX_QUERY_LENGTH} characters`
    );
  }
  if (!thread_id || typeof thread_id !== "string") {
    throw new ValidationError("Thread ID must be a non-empty string");
  }
  if (thread_id.length > CONFIG.MAX_THREAD_ID_LENGTH) {
    throw new ValidationError(
      `Thread ID too long. Maximum length is ${CONFIG.MAX_THREAD_ID_LENGTH} characters`
    );
  }
}

export async function callAgent(
  client: MongoClient,
  query: string,
  thread_id: string
) {
  try {
    // Validate inputs
    validateInputs(query, thread_id);

    const collection = getEmployeeCollection(client);
    const employeeLookup = employeeLookupTool(collection);
    const tools: StructuredToolInterface[] = [employeeLookup];

    // Create the workflow using the extracted function
    const app = createWorkflow(tools, model, client);

    const finalState = await retry(
      async () => {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Workflow timeout")),
            CONFIG.WORKFLOW_TIMEOUT
          )
        );
        return Promise.race([
          app.invoke(
            { messages: [new HumanMessage(query)] },
            {
              recursionLimit: CONFIG.RECURSION_LIMIT,
              configurable: { thread_id: thread_id },
            }
          ),
          timeoutPromise,
        ]);
      },
      {
        retries: CONFIG.MAX_WORKFLOW_RETRIES,
        factor: CONFIG.RETRY_FACTOR,
        minTimeout: CONFIG.RETRY_MIN_TIMEOUT,
        maxTimeout: CONFIG.RETRY_MAX_TIMEOUT,
      }
    );

    const finalStateTyped = finalState as { messages: BaseMessage[] };
    const finalMessage =
      finalStateTyped.messages[finalStateTyped.messages.length - 1].content;
    console.log(`Final response: ${finalMessage}`);
    return finalMessage;
  } catch (error) {
    console.error("Error in callAgent:", error);

    if (error instanceof ValidationError) {
      return `Validation Error: ${error.message}`;
    }

    if (error instanceof ModelTimeoutError) {
      return "The request timed out. Please try again with a simpler query.";
    }

    if (error instanceof WorkflowError) {
      return "There was an issue processing your request. Please try again.";
    }

    // For any other unexpected errors
    return "Sorry, something went wrong while processing your request. Please try again later.";
  }
}
