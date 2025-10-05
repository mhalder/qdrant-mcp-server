# Qdrant MCP Server

A Model Context Protocol (MCP) server that provides semantic search capabilities using a local Qdrant vector database and OpenAI embeddings.

## Features

- **Semantic Search**: Natural language search across your document collections
- **Local Vector Database**: Runs Qdrant locally via Docker for complete data privacy
- **Automatic Embeddings**: Uses OpenAI's embedding models to convert text to vectors
- **MCP Integration**: Works seamlessly with Claude Desktop and other MCP clients
- **Collection Management**: Create, list, and delete vector collections
- **Document Operations**: Add, search, and delete documents with metadata support

## Prerequisites

- Node.js 18+
- Docker and Docker Compose
- OpenAI API key

## Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd qdrant-mcp-server
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add your OpenAI API key:
```bash
OPENAI_API_KEY=sk-your-api-key-here
QDRANT_URL=http://localhost:6333
```

4. Start Qdrant:
```bash
docker compose up -d
```

5. Build the project:
```bash
npm run build
```

## Usage

### Running the Server

For development:
```bash
npm run dev
```

For production:
```bash
node build/index.js
```

### Claude Desktop Configuration

Add this to your Claude Desktop configuration file:

**MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "qdrant": {
      "command": "node",
      "args": ["/absolute/path/to/qdrant-mcp-server/build/index.js"],
      "env": {
        "OPENAI_API_KEY": "sk-your-api-key-here",
        "QDRANT_URL": "http://localhost:6333"
      }
    }
  }
}
```

Restart Claude Desktop after making this change.

## Available Tools

### `create_collection`

Create a new vector collection.

**Parameters:**
- `name` (string, required): Collection name
- `distance` (string, optional): Distance metric - "Cosine", "Euclid", or "Dot" (default: "Cosine")

**Example:**
```
Create a collection named "my-docs"
```

### `add_documents`

Add documents to a collection with automatic embedding generation.

**Parameters:**
- `collection` (string, required): Collection name
- `documents` (array, required): Array of documents with:
  - `id` (string/number, required): Unique identifier
  - `text` (string, required): Document text content
  - `metadata` (object, optional): Additional metadata

**Example:**
```
Add these documents to "my-docs" collection:
- id: 1, text: "Introduction to vector databases"
- id: 2, text: "Semantic search with embeddings"
```

### `semantic_search`

Search for documents using natural language.

**Parameters:**
- `collection` (string, required): Collection to search
- `query` (string, required): Search query
- `limit` (number, optional): Max results (default: 5)
- `filter` (object, optional): Metadata filter

**Example:**
```
Search "my-docs" for information about vector databases
```

### `list_collections`

List all available collections.

### `get_collection_info`

Get detailed information about a collection.

**Parameters:**
- `name` (string, required): Collection name

### `delete_collection`

Delete a collection and all its documents.

**Parameters:**
- `name` (string, required): Collection name

### `delete_documents`

Delete specific documents from a collection.

**Parameters:**
- `collection` (string, required): Collection name
- `ids` (array, required): Array of document IDs to delete

## Available Resources

- `qdrant://collections` - List all collections
- `qdrant://collection/{name}` - Collection details and statistics

## Project Structure

```
qdrant-mcp-server/
├── src/
│   ├── index.ts              # MCP server implementation
│   ├── qdrant/
│   │   └── client.ts         # Qdrant client wrapper
│   └── embeddings/
│       └── openai.ts         # OpenAI embeddings provider
├── docker-compose.yml        # Qdrant Docker setup
├── package.json
├── tsconfig.json
└── README.md
```

## Example Workflow

1. **Create a collection:**
   ```
   Create a collection called "knowledge-base"
   ```

2. **Add documents:**
   ```
   Add these documents to knowledge-base:
   - id: "doc1", text: "MCP is a protocol for AI model context", metadata: {"type": "definition"}
   - id: "doc2", text: "Vector databases store embeddings for semantic search", metadata: {"type": "definition"}
   ```

3. **Search:**
   ```
   Search knowledge-base for "how does semantic search work"
   ```

4. **View collections:**
   ```
   What collections do I have?
   ```

## Configuration Options

### Environment Variables

- `OPENAI_API_KEY` (required): Your OpenAI API key
- `QDRANT_URL` (optional): Qdrant server URL (default: http://localhost:6333)
- `OPENAI_EMBEDDING_MODEL` (optional): Embedding model (default: text-embedding-3-small)
- `OPENAI_EMBEDDING_DIMENSIONS` (optional): Custom embedding dimensions

### Embedding Models

Available OpenAI models:
- `text-embedding-3-small` (1536 dims, faster, cheaper)
- `text-embedding-3-large` (3072 dims, higher quality)

## Troubleshooting

### Qdrant connection errors

Make sure Qdrant is running:
```bash
docker compose ps
```

If not running:
```bash
docker compose up -d
```

### Collection doesn't exist

Create the collection first before adding documents:
```
Create a collection named "my-collection"
```

### OpenAI API errors

- Verify your API key is correct in `.env`
- Check your OpenAI account has available credits
- Ensure you have access to the embedding models

## Development

Run in development mode with auto-reload:
```bash
npm run dev
```

Build for production:
```bash
npm run build
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
