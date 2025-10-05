# Qdrant MCP Server

[![CI](https://github.com/mhalder/qdrant-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/mhalder/qdrant-mcp-server/actions/workflows/ci.yml)

A Model Context Protocol (MCP) server that provides semantic search capabilities using a local Qdrant vector database and OpenAI embeddings.

## Features

- **Semantic Search**: Natural language search across your document collections
- **Metadata Filtering**: Filter search results by metadata fields using Qdrant's powerful filter syntax
- **Local Vector Database**: Runs Qdrant locally via Docker for complete data privacy
- **Automatic Embeddings**: Uses OpenAI's embedding models to convert text to vectors
- **MCP Integration**: Works seamlessly with Claude Code and other MCP clients
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

### Claude Code Configuration (Linux)

Add this to your Claude Code configuration file at `~/.claude/claude_code_config.json`:

```json
{
  "mcpServers": {
    "qdrant": {
      "command": "node",
      "args": ["/home/YOUR_USERNAME/projects/active/qdrant-mcp-server/build/index.js"],
      "env": {
        "OPENAI_API_KEY": "sk-your-api-key-here",
        "QDRANT_URL": "http://localhost:6333"
      }
    }
  }
}
```

Replace `YOUR_USERNAME` and the path with your actual username and installation path.

Restart Claude Code after making this change.

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
- `filter` (object, optional): Metadata filter in Qdrant format

**Filter Format:**

The filter parameter accepts Qdrant's native filter format for powerful metadata-based filtering:

```json
{
  "must": [
    { "key": "category", "match": { "value": "database" } }
  ]
}
```

You can also use more complex filters:
- **Multiple conditions (AND)**: Use `must` with multiple conditions
- **Any condition (OR)**: Use `should` with multiple conditions
- **Negation (NOT)**: Use `must_not` with conditions

Example with multiple conditions:
```json
{
  "must": [
    { "key": "category", "match": { "value": "database" } },
    { "key": "level", "match": { "value": "beginner" } }
  ]
}
```

**Examples:**

Basic search:
```
Search "my-docs" for information about vector databases
```

With single filter:
```
Search "my-docs" for "vector databases" with filter {"must": [{"key": "category", "match": {"value": "technical"}}]}
```

With multiple filters (AND):
```
Search "knowledge-base" for "machine learning" with filter {"must": [{"key": "category", "match": {"value": "ml"}}, {"key": "level", "match": {"value": "advanced"}}]}
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
   - id: "doc1", text: "MCP is a protocol for AI model context", metadata: {"type": "definition", "category": "protocol"}
   - id: "doc2", text: "Vector databases store embeddings for semantic search", metadata: {"type": "definition", "category": "database"}
   - id: "doc3", text: "Qdrant provides high-performance vector similarity search", metadata: {"type": "product", "category": "database"}
   ```

3. **Search without filters:**
   ```
   Search knowledge-base for "how does semantic search work"
   ```

4. **Search with filters:**
   ```
   Search knowledge-base for "vector database" with filter {"must": [{"key": "category", "match": {"value": "database"}}]}
   ```

5. **Get collection information:**
   ```
   Get info about "knowledge-base" collection
   ```

6. **View all collections:**
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

## Advanced Features

### Metadata Filtering

The server supports Qdrant's powerful filtering capabilities for refined search results. Filters can be applied to any metadata field stored with your documents.

**Supported filter types:**
- **Match filters**: Exact value matching for strings, numbers, and booleans
- **Logical operators**: `must` (AND), `should` (OR), `must_not` (NOT)
- **Range filters**: Greater than, less than, between (for numeric values)
- **Nested filters**: Complex boolean expressions

See the `semantic_search` tool documentation for filter syntax examples.

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

### Filter errors

If you encounter "Bad Request" errors with filters:
- Ensure you're using Qdrant's native filter format
- Check that field names match your metadata exactly
- Verify the filter structure has proper nesting

## Development

### Development Mode

Run in development mode with auto-reload:
```bash
npm run dev
```

### Build

Build for production:
```bash
npm run build
```

### Type Checking

Run TypeScript type checking without emitting files:
```bash
npm run type-check
```

### Continuous Integration

The project uses GitHub Actions for CI/CD:
- **Build**: Compiles TypeScript to JavaScript
- **Type Check**: Validates TypeScript types
- **Test**: Runs all 114 unit and integration tests
- **Multi-version**: Tests on Node.js 18, 20, and 22

The CI workflow runs on every push and pull request to the main branch.

## Testing

The project includes comprehensive unit and integration tests using Vitest.

### Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### Test Coverage

The test suite includes 114 tests covering:
- **QdrantManager** (`src/qdrant/client.test.ts`): Collection management, point operations, and search functionality
- **OpenAIEmbeddings** (`src/embeddings/openai.test.ts`): Embedding generation, batch processing, and error handling
- **MCP Server** (`src/index.test.ts`): Tool schemas, resource URI patterns, and MCP protocol compliance

All tests are passing with comprehensive coverage of core functionality.

### Writing Tests

Tests are located next to the files they test with a `.test.ts` extension:
- `src/qdrant/client.test.ts` - Qdrant client wrapper tests
- `src/embeddings/openai.test.ts` - OpenAI embeddings provider tests
- `src/index.test.ts` - MCP server integration tests

Run tests before committing:
```bash
npm test -- --run
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Before Submitting a PR

1. **Run tests**: Ensure all tests pass
   ```bash
   npm test -- --run
   ```

2. **Type check**: Verify no TypeScript errors
   ```bash
   npm run type-check
   ```

3. **Build**: Confirm the project builds successfully
   ```bash
   npm run build
   ```

All pull requests will automatically run through CI checks that validate:
- TypeScript compilation
- Type checking
- Test suite (114 tests)
- Compatibility with Node.js 18, 20, and 22

### Note for Repository Owners

After forking or cloning, update the CI badge URL in README.md:
```markdown
[![CI](https://github.com/mhalder/qdrant-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/mhalder/qdrant-mcp-server/actions/workflows/ci.yml)
```
Replace `YOUR_USERNAME` with your GitHub username or organization name.
