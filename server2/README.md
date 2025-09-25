# LangGraph MongoDB Qdrant Example

This is a server implementation that uses MongoDB for employee data storage and Qdrant for vector search, integrated with LangGraph for agent-based interactions.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Set up environment variables in a `.env` file:

   ```
   MONGODB_ATLAS_URI=your_mongodb_connection_string
   QDRANT_URL=http://localhost:6333
   OPENAI_API_KEY=your_openai_api_key
   ANTHROPIC_API_KEY=your_anthropic_api_key
   PORT=3000
   ```

3. Start Qdrant (if running locally):

   ```bash
   docker run -p 6334:6334 qdrant/qdrant
   ```

4. Seed the database:

   ```bash
   npm run seed
   ```

5. Start the server:
   ```bash
   npm run dev
   ```

## API Endpoints

- `GET /`: Health check
- `POST /chat`: Start a new conversation
- `POST /chat/:threadId`: Continue an existing conversation

## Technical Architecture

### Database Schema

The system uses a dual-database approach:

- **MongoDB**: Stores complete employee records with all fields
- **Qdrant**: Stores vector embeddings of employee summaries for semantic search

Employee data structure includes:

- Personal information (name, DOB, address, contact details)
- Job details (title, department, salary, hire date)
- Work location and remote status
- Skills, performance reviews, benefits
- Emergency contact information

### Core Components

#### `seed-database.ts`

**Purpose**: Initializes both MongoDB and Qdrant with synthetic employee data.

**Key Functions**:

- `generateSyntheticData()`: Uses OpenAI GPT-4 to generate 20 realistic employee records
- `createEmployeeSummary()`: Creates searchable text summaries from employee data
- `seedDatabase()`: Orchestrates the seeding process

**Process Flow**:

1. Connect to MongoDB and clear existing data
2. Generate synthetic employee records using LLM
3. Store full records in MongoDB `employees` collection
4. Create text summaries for each employee
5. Generate embeddings using OpenAI Embeddings (1536 dimensions)
6. Create Qdrant collection with cosine similarity
7. Store vectors with employee_id and summary as payload

**Dependencies**: `@langchain/openai`, `@qdrant/js-client-rest`, `mongodb`, `zod`

#### `agent.ts`

**Purpose**: Implements the LangGraph agent with Qdrant-powered employee lookup.

**Key Components**:

- **Graph State**: Manages conversation messages using LangGraph Annotation
- **Employee Lookup Tool**: Performs semantic search over employee data
- **LangGraph Workflow**: Orchestrates agent-tool interactions

**Employee Lookup Process**:

1. Receives natural language query and optional result limit
2. Embeds query using OpenAI Embeddings
3. Searches Qdrant for similar vectors (cosine similarity)
4. Retrieves employee_id from search results
5. Fetches complete employee data from MongoDB
6. Returns enriched results with similarity scores

**Agent Architecture**:

- Uses Claude 3.5 Sonnet via LangChain Anthropic
- Implements tool-calling for database queries
- Maintains conversation state in MongoDB
- Supports multi-turn conversations with thread IDs

**Dependencies**: `@langchain/openai`, `@langchain/anthropic`, `@langchain/langgraph`, `@qdrant/js-client-rest`, `mongodb`

#### `index.ts`

**Purpose**: Express.js server providing REST API for chat interactions.

**API Endpoints**:

- `GET /`: Health check endpoint
- `POST /chat`: Initialize new conversation thread
- `POST /chat/:threadId`: Continue existing conversation

**Request/Response Format**:

- Chat requests: `{"message": "user query"}`
- Responses: `{"threadId": "123", "response": "agent reply"}` or `{"response": "agent reply"}`

**Server Features**:

- JSON middleware for request parsing
- Error handling with 500 status for failures
- Thread ID generation using timestamps
- MongoDB connection management

**Dependencies**: `express`, `mongodb`

## Differences from Original Server

- Uses Qdrant for vector search instead of MongoDB Atlas Vector Search
- Employee data is stored in MongoDB, vectors in Qdrant
- Same LangGraph agent functionality with employee lookup tool
- Direct Qdrant client integration instead of LangChain vector store wrapper
