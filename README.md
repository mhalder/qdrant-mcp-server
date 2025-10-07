# Qdrant MCP Server

[![CI](https://github.com/mhalder/qdrant-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/mhalder/qdrant-mcp-server/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/mhalder/qdrant-mcp-server/branch/main/graph/badge.svg)](https://codecov.io/gh/mhalder/qdrant-mcp-server)

A Model Context Protocol (MCP) server that provides semantic search capabilities using a local Qdrant vector database and OpenAI embeddings.

## Features

- **Semantic Search**: Natural language search across your document collections
- **Metadata Filtering**: Filter search results by metadata fields using Qdrant's powerful filter syntax
- **Local Vector Database**: Runs Qdrant locally via Docker for complete data privacy
- **Automatic Embeddings**: Uses OpenAI's embedding models to convert text to vectors
- **Rate Limiting**: Intelligent request throttling with exponential backoff to prevent API rate limit errors
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

# Optional: OpenAI Rate Limiting (defaults shown)
OPENAI_MAX_REQUESTS_PER_MINUTE=3500
OPENAI_RETRY_ATTEMPTS=3
OPENAI_RETRY_DELAY=1000
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
      "args": [
        "/home/YOUR_USERNAME/projects/active/qdrant-mcp-server/build/index.js"
      ],
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
  - `id` (string/number, required): Unique identifier (string IDs are automatically normalized to UUID format)
  - `text` (string, required): Document text content
  - `metadata` (object, optional): Additional metadata

**Note:** String IDs are automatically normalized to UUID format for Qdrant compatibility. The normalization is deterministic, so the same string ID will always produce the same UUID.

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
  "must": [{ "key": "category", "match": { "value": "database" } }]
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
- `ids` (array, required): Array of document IDs to delete (string IDs are automatically normalized to UUID format)

**Note:** String IDs will be normalized to the same UUID format used when adding documents.

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
- `OPENAI_MAX_REQUESTS_PER_MINUTE` (optional): Maximum OpenAI API requests per minute (default: 3500)
- `OPENAI_RETRY_ATTEMPTS` (optional): Number of retry attempts for rate limit errors (default: 3)
- `OPENAI_RETRY_DELAY` (optional): Initial retry delay in milliseconds with exponential backoff (default: 1000)

### Embedding Models

Available OpenAI models:

- `text-embedding-3-small` (1536 dims, faster, cheaper)
- `text-embedding-3-large` (3072 dims, higher quality)

## Advanced Features

### Rate Limiting and Error Handling

The server implements robust rate limiting to handle OpenAI API limits gracefully:

**Features:**

- **Request Throttling**: Queues requests to stay within OpenAI's rate limits (configurable, default: 3500 requests/minute)
- **Exponential Backoff**: Automatically retries failed requests with increasing delays (1s, 2s, 4s, 8s...)
- **Retry-After Header Support**: Respects OpenAI's retry guidance with validation fallback for invalid headers
- **Typed Error Handling**: Uses OpenAIError interface for type-safe error detection and handling
- **Smart Error Detection**: Identifies rate limit errors (429 status) vs other failures
- **User Feedback**: Clear console messages during retry attempts with estimated wait times

**Configuration:**

```bash
# Adjust for your OpenAI tier (free tier: 500/min, paid tiers: 3500+/min)
OPENAI_MAX_REQUESTS_PER_MINUTE=3500

# Retry behavior
OPENAI_RETRY_ATTEMPTS=3      # Number of retries before failing
OPENAI_RETRY_DELAY=1000      # Initial delay (doubles each retry)
```

**Benefits:**

- Prevents failed operations during high-volume usage
- Automatic recovery from temporary API issues
- Optimized for batch document processing
- Works seamlessly with both single and batch embedding operations

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

### Rate limit errors

The server automatically handles rate limits, but if you see persistent rate limit errors:

- Reduce `OPENAI_MAX_REQUESTS_PER_MINUTE` to match your OpenAI tier (free: 500, paid: 3500+)
- Increase `OPENAI_RETRY_ATTEMPTS` for more resilient retries
- Check your OpenAI dashboard for current usage and limits

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
- **Type Check**: Validates TypeScript types with strict mode
- **Test**: Runs all 140 unit and functional tests (129 unit + 11 functional)
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

The test suite includes **140 tests** (129 unit + 11 functional) covering:

**Unit Tests:**

- **QdrantManager** (21 tests): Collection management, point operations, and search functionality
- **OpenAIEmbeddings** (25 tests): Embedding generation, batch processing, rate limiting with exponential backoff, Retry-After header validation, and typed error handling
- **MCP Server** (19 tests): Tool schemas, resource URI patterns, and MCP protocol compliance

**Functional Tests:**

- **Live API Integration** (11 tests): Real OpenAI embeddings, production MCP server validation, rate limiting behavior, and end-to-end workflows with 30+ real documents

**Coverage Highlights:**

- ✅ 100% function coverage across all modules
- ✅ Comprehensive rate limiting tests with timing validation
- ✅ Typed error handling with OpenAIError interface
- ✅ Invalid Retry-After header fallback to exponential backoff
- ✅ Real-world validation with live OpenAI API
- ✅ Both source and compiled code tested

See [`docs/test_report.md`](docs/test_report.md) for detailed test results and coverage analysis.

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

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

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
