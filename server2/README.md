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
    QDRANT_API_KEY=your_qdrant_api_key  # Optional, for cloud Qdrant
    ```

    **Required Variables**: `MONGODB_ATLAS_URI`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`
    The server will validate these on startup and fail with clear error messages if missing.

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

### Health Check
- **GET /**: Basic health check endpoint
- **Response**: `{"message": "LangGraph Agent Server with Qdrant"}`

- **GET /health**: Comprehensive health check endpoint
- **Response**: `{"status": "healthy", "timestamp": "ISO_DATE", "services": {"mongo": {"status": "healthy"}, "qdrant": {"status": "healthy"}}}`
- **Status Codes**: 200 (healthy), 503 (unhealthy/degraded)

### Chat Endpoints
- **POST /chat**: Start a new conversation
  - **Request Body**: `{"message": "your query here"}`
  - **Response**: `{"threadId": "timestamp", "response": "agent reply"}`
  - **Validation**: Message must be 1-1000 characters

- **POST /chat/:threadId**: Continue an existing conversation
  - **Request Body**: `{"message": "follow-up query"}`
  - **Response**: `{"response": "agent reply"}`
  - **Validation**: Thread ID (1-100 chars), message (1-1000 chars)

### Error Responses
- **400 Bad Request**: Invalid input validation
  ```json
  {
    "error": "Invalid request",
    "details": [
      {
        "code": "too_small",
        "message": "Message cannot be empty",
        "path": ["message"]
      }
    ]
  }
  ```
- **500 Internal Server Error**: Server-side errors

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

- **Input Validation**: Comprehensive request validation using Zod schemas
- **Environment Validation**: Automatic validation of required environment variables on startup
- **Error Handling**: Detailed error responses with validation details
- **Connection Management**: MongoDB connection pooling with graceful shutdown
- **Thread Management**: Automatic thread ID generation and conversation persistence
- **Type Safety**: Full TypeScript implementation with strict type checking

**Dependencies**: `express`, `mongodb`, `zod`

## Configuration

The application uses a centralized configuration system in `src/agent/config/config.ts`:

- **Database Settings**: Database name, timeouts, retry policies
- **Workflow Limits**: Recursion limits, query length constraints
- **Retry Configuration**: Model and workflow retry settings

All configuration values are defined as `const` assertions for type safety.

## Recent Improvements

### Logging System
- Implemented structured logging with Winston
- Multiple log levels (error, warn, info, http, debug)
- Console output with colors and timestamps
- File logging (combined.log and error.log)
- Configurable log level via LOG_LEVEL environment variable

### Type Safety Enhancements
- Replaced `any` types with proper LangChain and MongoDB types
- Added comprehensive TypeScript interfaces
- Improved IntelliSense and compile-time error detection

### Input Validation & Security
- Implemented Zod-based request validation for all API endpoints
- Added environment variable validation on startup
- Enhanced error responses with detailed validation messages

### Configuration Management
- Moved hardcoded values to centralized config
- Improved maintainability for different environments

## Differences from Original Server

- Uses Qdrant for vector search instead of MongoDB Atlas Vector Search
- Employee data is stored in MongoDB, vectors in Qdrant
- Same LangGraph agent functionality with employee lookup tool
- Direct Qdrant client integration instead of LangChain vector store wrapper
