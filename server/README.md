# LangGraph MongoDB LLM

A sophisticated AI-powered HR chatbot built with LangGraph, MongoDB Atlas Vector Search, and modern LLM technologies. This project demonstrates how to create conversational AI agents with persistent memory and semantic search capabilities.

## 🚀 Features

- **Conversational AI Agent**: Multi-turn conversations with Claude 3.5 Sonnet
- **Vector Search**: Semantic search through employee records using MongoDB Atlas Vector Search
- **Persistent Memory**: Conversation state management with MongoDB checkpointing
- **REST API**: Clean HTTP endpoints for chat interactions
- **Synthetic Data Generation**: Automated employee database seeding with realistic data
- **Type Safety**: Full TypeScript implementation with Zod validation

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Express API   │────│  LangGraph      │────│   MongoDB       │
│   (REST)        │    │  Agent          │    │   Atlas         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
    HTTP Requests          Tool Execution         Vector Search
                                │                       │
                         ┌─────────────────┐    ┌─────────────────┐
                         │   Anthropic     │    │   OpenAI        │
                         │   Claude        │    │   Embeddings    │
                         └─────────────────┘    └─────────────────┘
```

## 📋 Prerequisites

- Node.js 18+ and npm
- MongoDB Atlas account with Vector Search enabled
- OpenAI API key
- Anthropic API key

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd langgraph-mongo-llm
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   MONGODB_ATLAS_URI=mongodb+srv://username:password@cluster.mongodb.net/
   OPENAI_API_KEY=sk-...
   ANTHROPIC_API_KEY=sk-ant-...
   PORT=3000
   ```

4. **Database Setup**
   - Create a MongoDB Atlas cluster
   - Enable Vector Search on your cluster
   - Create a search index named `vector_index` on the `hr_database.employees` collection

## 🗄️ Database Seeding

Before using the chatbot, seed the database with synthetic employee data:

```bash
npm run seed
```

This will:
- Generate 20 realistic employee records using GPT-4o-mini
- Create embeddings for each employee using OpenAI
- Store the data in MongoDB with vector search capabilities

## 🚀 Running the Application

### Backend Server Only
Start the development server:

```bash
npm run dev
```

The server will start on `http://localhost:8000` (or your configured PORT).

### Full Application (Frontend + Backend)
Build and start both frontend and backend:

```bash
npm start
```

This will:
1. Build the React frontend using Vite
2. Start the Express server with static file serving
3. Serve the complete application on `http://localhost:8000`

### Development Mode
For frontend development with hot reload:

```bash
# Terminal 1: Start backend server
npm run dev

# Terminal 2: Start frontend development server
npm run dev:frontend
```

- Backend: `http://localhost:8000`
- Frontend: `http://localhost:3000` (with API proxy to backend)

## 🌐 Web Interface

The application now includes a modern React-based chat interface:

- **Modern UI**: Clean, responsive design with dark/light mode support
- **Real-time Chat**: Interactive chat interface with typing indicators
- **Conversation Memory**: Maintains conversation context across messages
- **TypeScript**: Full type safety for better development experience
- **Vite**: Fast build tool with hot module replacement

### Using the Web Interface

1. Start the application: `npm start`
2. Open your browser to `http://localhost:8000`
3. Start chatting with the HR assistant!

Example questions to try:
- "Who works in the Engineering department?"
- "Find employees with Python skills"
- "Tell me about John Smith"
- "Build a team for a mobile app project"

## 📡 API Endpoints

### Web Interface
```http
GET /
```
Serves the React chat application.

### Start New Conversation
```http
POST /api/start
Content-Type: application/json

{
  "message": "Build a team to make an iOS app, and tell me the talent gaps."
}
```

**Response:**
```json
{
  "thread_id": "1234567890",
  "response": "I'll help you build a team for iOS app development..."
}
```

### Continue Conversation
```http
POST /api/continue
Content-Type: application/json

{
  "message": "What team members did you recommend?",
  "thread_id": "1234567890"
}
```

**Response:**
```json
{
  "response": "Based on my previous recommendation...",
  "thread_id": "1234567890"
}
```

### Legacy API Endpoints (Backward Compatibility)

#### Start New Conversation (Legacy)
```http
POST /chat
Content-Type: application/json

{
  "message": "Build a team to make an iOS app, and tell me the talent gaps."
}
```

**Response:**
```json
{
  "threadId": "1234567890",
  "response": "I'll help you build a team for iOS app development..."
}
```

### Continue Conversation (Legacy)
```http
POST /chat/:threadId
Content-Type: application/json

{
  "message": "What team members did you recommend?"
}
```

**Response:**
```json
{
  "response": "Based on our previous discussion, I recommended..."
}
```

## 💡 Usage Examples

### Example 1: Team Building Query
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"message": "Build a team to make an iOS app, and tell me the talent gaps."}' \
  http://localhost:3000/chat
```

### Example 2: Employee Search
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"message": "Find employees with React Native experience"}' \
  http://localhost:3000/chat
```

### Example 3: Skills Analysis
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"message": "What JavaScript developers do we have?"}' \
  http://localhost:3000/chat
```

## 🔧 Configuration

### MongoDB Vector Search Index

Create a search index with the following configuration:

```json
{
  "fields": [
    {
      "numDimensions": 1536,
      "path": "embedding",
      "similarity": "cosine",
      "type": "vector"
    }
  ]
}
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MONGODB_ATLAS_URI` | MongoDB Atlas connection string | ✅ |
| `OPENAI_API_KEY` | OpenAI API key for embeddings | ✅ |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude | ✅ |
| `PORT` | Server port (default: 3000) | ❌ |

## 🏗️ Project Structure

```
├── src/
│   ├── index.ts              # Express server and API routes
│   ├── agent.ts              # LangGraph agent implementation
│   └── tools/
│       └── seed-database.ts  # Database seeding utility
├── frontend/
│   ├── src/
│   │   ├── main.tsx          # React app entry point
│   │   ├── App.tsx           # Main chat component
│   │   ├── App.css           # Chat interface styles
│   │   └── index.css         # Global styles
│   ├── index.html            # HTML template
│   └── tsconfig.json         # TypeScript config for frontend
├── dist/
│   └── frontend/             # Built React app (generated)
├── vite.config.ts            # Vite configuration
├── tsconfig.node.json        # TypeScript config for Node.js tools
└── package.json              # Dependencies and scripts
```

## 🔍 Key Technologies

- **[LangGraph](https://github.com/langchain-ai/langgraph)**: Agent workflow orchestration
- **[LangChain](https://github.com/langchain-ai/langchainjs)**: LLM application framework
- **[MongoDB Atlas Vector Search](https://www.mongodb.com/products/platform/atlas-vector-search)**: Vector database for semantic search
- **[Anthropic Claude](https://www.anthropic.com/)**: Primary LLM for conversations
- **[OpenAI](https://openai.com/)**: Embeddings and data generation
- **[Express.js](https://expressjs.com/)**: Web server framework
- **[React](https://reactjs.org/)**: Frontend user interface
- **[Vite](https://vitejs.dev/)**: Fast build tool and development server
- **[TypeScript](https://www.typescriptlang.org/)**: Type-safe JavaScript
- **[Zod](https://zod.dev/)**: Schema validation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the ISC License.

## 🆘 Troubleshooting

### Common Issues

**MongoDB Connection Error**
- Verify your MongoDB Atlas URI is correct
- Ensure your IP address is whitelisted in MongoDB Atlas
- Check that your cluster is running

**Vector Search Not Working**
- Confirm the vector search index is created and named `vector_index`
- Verify the index configuration matches the embedding dimensions (1536)
- Ensure the collection has been seeded with data

**API Key Errors**
- Double-check your OpenAI and Anthropic API keys
- Ensure the keys have sufficient credits/quota
- Verify the keys are correctly set in your `.env` file

## 📚 Additional Resources

- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [MongoDB Atlas Vector Search Guide](https://www.mongodb.com/docs/atlas/atlas-vector-search/)
- [Anthropic Claude API](https://docs.anthropic.com/)
- [OpenAI API Documentation](https://platform.openai.com/docs/)