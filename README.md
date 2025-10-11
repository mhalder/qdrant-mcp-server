# Qdrant MCP Server

[![CI](https://github.com/mhalder/qdrant-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/mhalder/qdrant-mcp-server/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/mhalder/qdrant-mcp-server/branch/main/graph/badge.svg)](https://codecov.io/gh/mhalder/qdrant-mcp-server)

A Model Context Protocol (MCP) server that provides semantic search capabilities using a local Qdrant vector database with support for multiple embedding providers (Ollama, OpenAI, Cohere, and Voyage AI).

## Features

- **Zero Setup Required**: Works out of the box with Ollama (no API keys needed)
- **Semantic Search**: Natural language search across your document collections
- **Multiple Embedding Providers**: Support for Ollama (local, default), OpenAI, Cohere, and Voyage AI
- **Privacy-First**: Default local embeddings with Ollama - your data never leaves your machine
- **Metadata Filtering**: Filter search results by metadata fields using Qdrant's powerful filter syntax
- **Local Vector Database**: Runs Qdrant locally via Docker for complete data privacy
- **Automatic Embeddings**: Converts text to vectors using your choice of embedding provider
- **Rate Limiting**: Intelligent request throttling with exponential backoff to prevent API rate limit errors
- **MCP Integration**: Works seamlessly with Claude Code and other MCP clients
- **Collection Management**: Create, list, and delete vector collections
- **Document Operations**: Add, search, and delete documents with metadata support
- **Flexible Configuration**: Easy provider switching via environment variables

## Prerequisites

- Node.js 20+ (tested on Node.js 20 and 22)
- Docker and Docker Compose

**Optional** (for alternative embedding providers):

- OpenAI API key
- Cohere API key
- Voyage AI API key

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

3. Start Qdrant and Ollama:

```bash
docker compose up -d
```

4. Pull the Ollama embedding model:

```bash
docker exec ollama ollama pull nomic-embed-text
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

**Default (Ollama - No API Key Required):**

```json
{
  "mcpServers": {
    "qdrant": {
      "command": "node",
      "args": [
        "/home/YOUR_USERNAME/projects/active/qdrant-mcp-server/build/index.js"
      ],
      "env": {
        "QDRANT_URL": "http://localhost:6333",
        "EMBEDDING_BASE_URL": "http://localhost:11434"
      }
    }
  }
}
```

**With OpenAI (Alternative):**

```json
{
  "mcpServers": {
    "qdrant": {
      "command": "node",
      "args": [
        "/home/YOUR_USERNAME/projects/active/qdrant-mcp-server/build/index.js"
      ],
      "env": {
        "EMBEDDING_PROVIDER": "openai",
        "OPENAI_API_KEY": "sk-your-api-key-here",
        "QDRANT_URL": "http://localhost:6333"
      }
    }
  }
}
```

**With Cohere (Alternative):**

```json
{
  "mcpServers": {
    "qdrant": {
      "command": "node",
      "args": [
        "/home/YOUR_USERNAME/projects/active/qdrant-mcp-server/build/index.js"
      ],
      "env": {
        "EMBEDDING_PROVIDER": "cohere",
        "COHERE_API_KEY": "your-cohere-api-key-here",
        "QDRANT_URL": "http://localhost:6333"
      }
    }
  }
}
```

**With Voyage AI (Alternative):**

```json
{
  "mcpServers": {
    "qdrant": {
      "command": "node",
      "args": [
        "/home/YOUR_USERNAME/projects/active/qdrant-mcp-server/build/index.js"
      ],
      "env": {
        "EMBEDDING_PROVIDER": "voyage",
        "VOYAGE_API_KEY": "your-voyage-api-key-here",
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
│       ├── base.ts           # Provider interface and types
│       ├── factory.ts        # Provider factory
│       ├── openai.ts         # OpenAI embeddings provider
│       ├── cohere.ts         # Cohere embeddings provider
│       ├── voyage.ts         # Voyage AI embeddings provider
│       └── ollama.ts         # Ollama embeddings provider
├── docker-compose.yml        # Qdrant Docker setup
├── .env.example              # Environment configuration template
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

#### Common Configuration

- `EMBEDDING_PROVIDER` (optional): Embedding provider to use - "openai", "cohere", "voyage", or "ollama" (default: "ollama")
- `QDRANT_URL` (optional): Qdrant server URL (default: http://localhost:6333)
- `EMBEDDING_MODEL` (optional): Model name for the selected provider (provider-specific defaults apply)
- `EMBEDDING_DIMENSIONS` (optional): Custom embedding dimensions (overrides model defaults)
- `EMBEDDING_BASE_URL` (optional): Custom API base URL (for Voyage AI and Ollama)
- `EMBEDDING_MAX_REQUESTS_PER_MINUTE` (optional): Rate limit (provider-specific defaults)
- `EMBEDDING_RETRY_ATTEMPTS` (optional): Retry attempts for rate limit errors (default: 3)
- `EMBEDDING_RETRY_DELAY` (optional): Initial retry delay in ms with exponential backoff (default: 1000)

#### Provider-Specific API Keys

- `OPENAI_API_KEY`: Required for OpenAI provider
- `COHERE_API_KEY`: Required for Cohere provider
- `VOYAGE_API_KEY`: Required for Voyage AI provider
- Ollama: No API key required

### Embedding Models

#### OpenAI Models

- `text-embedding-3-small` (1536 dims, default) - Faster, more cost-effective
- `text-embedding-3-large` (3072 dims) - Higher quality
- `text-embedding-ada-002` (1536 dims) - Legacy model

Default rate limit: 3500 requests/minute (paid tier)

#### Cohere Models

- `embed-english-v3.0` (1024 dims, default) - English-optimized
- `embed-multilingual-v3.0` (1024 dims) - Multi-language support
- `embed-english-light-v3.0` (384 dims) - Lightweight English model
- `embed-multilingual-light-v3.0` (384 dims) - Lightweight multilingual model

Default rate limit: 100 requests/minute

#### Voyage AI Models

- `voyage-2` (1024 dims, default) - General purpose
- `voyage-large-2` (1536 dims) - Enhanced quality
- `voyage-code-2` (1536 dims) - Code-specialized
- `voyage-lite-02-instruct` (1024 dims) - Instruction-tuned

Default rate limit: 300 requests/minute

#### Ollama Models (Local)

- `nomic-embed-text` (768 dims, default) - High-quality local embeddings
- `mxbai-embed-large` (1024 dims) - Larger context window
- `all-minilm` (384 dims) - Lightweight option

Default rate limit: 1000 requests/minute (local, can be adjusted)

**Note:** Ollama models must be downloaded first using `ollama pull <model-name>`

## Advanced Features

### Rate Limiting and Error Handling

The server implements robust rate limiting for all embedding providers:

**Features:**

- **Request Throttling**: Queues requests to stay within provider rate limits (provider-specific defaults)
- **Exponential Backoff**: Automatically retries failed requests with increasing delays (1s, 2s, 4s, 8s...)
- **Retry-After Header Support**: Respects provider retry guidance (OpenAI) with validation fallback
- **Typed Error Handling**: Provider-specific error interfaces for type-safe error detection
- **Smart Error Detection**: Identifies rate limit errors (429 status) vs other failures
- **User Feedback**: Clear console messages during retry attempts with estimated wait times

**Configuration:**

```bash
# Common settings (apply to all providers)
EMBEDDING_MAX_REQUESTS_PER_MINUTE=3500  # Adjust based on your provider tier
EMBEDDING_RETRY_ATTEMPTS=3              # Number of retries before failing
EMBEDDING_RETRY_DELAY=1000              # Initial delay (doubles each retry)
```

**Provider-Specific Defaults:**

- OpenAI: 3500 requests/minute (paid tier)
- Cohere: 100 requests/minute
- Voyage AI: 300 requests/minute
- Ollama: 1000 requests/minute (local, configurable)

**Benefits:**

- Prevents failed operations during high-volume usage
- Automatic recovery from temporary API issues
- Optimized for batch document processing
- Works seamlessly with both single and batch embedding operations
- Consistent behavior across all providers

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

### Embedding Provider Errors

**OpenAI:**

- Verify your API key is correct in `.env`
- Check your OpenAI account has available credits
- Ensure you have access to the embedding models

**Cohere:**

- Verify your Cohere API key is correct
- Check your Cohere account status and credits
- Ensure you're using a valid model name

**Voyage AI:**

- Verify your Voyage API key is correct
- Check your Voyage AI account status
- Ensure the base URL is correct (default: https://api.voyageai.com/v1)

**Ollama:**

- Ensure Ollama is running: `curl http://localhost:11434`
- Pull the required model: `ollama pull nomic-embed-text`
- Check the base URL matches your Ollama installation

### Rate limit errors

The server automatically handles rate limits, but if you see persistent rate limit errors:

- Reduce `EMBEDDING_MAX_REQUESTS_PER_MINUTE` to match your provider's tier
  - OpenAI free: 500/min, paid: 3500+/min
  - Cohere: 100/min (adjust based on your plan)
  - Voyage AI: 300/min (adjust based on your plan)
  - Ollama: No limits (local), but adjust based on system capacity
- Increase `EMBEDDING_RETRY_ATTEMPTS` for more resilient retries
- Check your provider's dashboard for current usage and limits

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
- **Test**: Runs all 376 unit tests with 98.27% coverage
- **Multi-version**: Tests on Node.js 20 and 22

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

# Run provider verification tests
npm run test:providers
```

### Test Coverage

The test suite includes **422 tests** (376 unit + 46 functional/interactive) covering:

**Unit Tests:**

- **QdrantManager** (21 tests): Collection management, point operations, and search functionality
- **OllamaEmbeddings** (31 tests): Local embedding generation, batch processing, rate limiting - DEFAULT PROVIDER
- **OpenAIEmbeddings** (25 tests): Cloud embedding generation, batch processing, rate limiting with Retry-After header
- **CohereEmbeddings** (29 tests): Cohere API integration, batch processing, rate limiting
- **VoyageEmbeddings** (31 tests): Voyage AI integration, batch processing, rate limiting
- **Factory Pattern** (32 tests): Provider instantiation, configuration, error handling
- **MCP Server** (19 tests): Tool schemas, resource URI patterns, and MCP protocol compliance

**Functional/Interactive Tests:**

- **Live API Integration** (46 tests): Real embedding APIs, production MCP server validation, rate limiting behavior, and end-to-end workflows with real documents

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

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) for detailed information about:

- Code of conduct
- Development workflow
- Commit message conventions (Conventional Commits)
- Pull request process
- Testing requirements

### Quick Start for Contributors

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

4. **Commit**: Use conventional commit format
   ```bash
   git commit -m "feat: add new feature"
   git commit -m "fix: resolve bug"
   ```

All pull requests will automatically run through CI checks that validate:

- TypeScript compilation
- Type checking
- Test suite (376 tests, 98.27% coverage)
- Compatibility with Node.js 20 and 22
- Conventional commit format

### Automated Releases

This project uses semantic-release for automated versioning and releases based on conventional commits. Version numbers follow Semantic Versioning based on your commit types:

- `feat:` commits trigger minor version bumps (1.x.0)
- `fix:` commits trigger patch version bumps (1.0.x)
- Commits with `BREAKING CHANGE:` trigger major version bumps (x.0.0)

### Note for Repository Owners

After forking or cloning, update the CI badge URL in README.md:

```markdown
[![CI](https://github.com/mhalder/qdrant-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/mhalder/qdrant-mcp-server/actions/workflows/ci.yml)
```

Replace `YOUR_USERNAME` with your GitHub username or organization name.
