# Qdrant MCP Server

[![CI](https://github.com/mhalder/qdrant-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/mhalder/qdrant-mcp-server/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/mhalder/qdrant-mcp-server/branch/main/graph/badge.svg)](https://codecov.io/gh/mhalder/qdrant-mcp-server)

A Model Context Protocol (MCP) server providing semantic search capabilities using Qdrant vector database with multiple embedding providers.

## Features

- **Zero Setup**: Works out of the box with Ollama - no API keys required
- **Privacy-First**: Local embeddings and vector storage - data never leaves your machine
- **Multiple Providers**: Ollama (default), OpenAI, Cohere, and Voyage AI
- **Hybrid Search**: Combine semantic and keyword search for better results
- **Semantic Search**: Natural language search with metadata filtering
- **Configurable Prompts**: Create custom prompts for guided workflows without code changes
- **Rate Limiting**: Intelligent throttling with exponential backoff
- **Full CRUD**: Create, search, and manage collections and documents
- **Flexible Deployment**: Run locally (stdio) or as a remote HTTP server

## Quick Start

### Prerequisites

- Node.js 20+
- Docker and Docker Compose

### Installation

```bash
# Clone and install
git clone https://github.com/mhalder/qdrant-mcp-server.git
cd qdrant-mcp-server
npm install

# Start services and pull model
docker compose up -d
docker exec ollama ollama pull nomic-embed-text

# Build
npm run build
```

### Configuration

#### Local Setup (stdio transport)

Add to `~/.claude/claude_code_config.json`:

```json
{
  "mcpServers": {
    "qdrant": {
      "command": "node",
      "args": ["/path/to/qdrant-mcp-server/build/index.js"],
      "env": {
        "QDRANT_URL": "http://localhost:6333",
        "EMBEDDING_BASE_URL": "http://localhost:11434"
      }
    }
  }
}
```

#### Remote Setup (HTTP transport)

> **⚠️ Security Warning**: When deploying the HTTP transport in production:
>
> - **Always** run behind a reverse proxy (nginx, Caddy) with HTTPS
> - Implement authentication/authorization at the proxy level
> - Use firewalls to restrict access to trusted networks
> - Never expose directly to the public internet without protection
> - Consider implementing rate limiting at the proxy level
> - Monitor server logs for suspicious activity

**Start the server:**

```bash
TRANSPORT_MODE=http HTTP_PORT=3000 node build/index.js
```

**Configure client:**

```json
{
  "mcpServers": {
    "qdrant": {
      "url": "http://your-server:3000/mcp"
    }
  }
}
```

**Using a different provider:**

```json
"env": {
  "EMBEDDING_PROVIDER": "openai",  // or "cohere", "voyage"
  "OPENAI_API_KEY": "sk-...",      // provider-specific API key
  "QDRANT_URL": "http://localhost:6333"
}
```

Restart after making changes.

See [Advanced Configuration](#advanced-configuration) section below for all options.

## Tools

### Collection Management

| Tool                  | Description                                                          |
| --------------------- | -------------------------------------------------------------------- |
| `create_collection`   | Create collection with specified distance metric (Cosine/Euclid/Dot) |
| `list_collections`    | List all collections                                                 |
| `get_collection_info` | Get collection details and statistics                                |
| `delete_collection`   | Delete collection and all documents                                  |

### Document Operations

| Tool               | Description                                                                   |
| ------------------ | ----------------------------------------------------------------------------- |
| `add_documents`    | Add documents with automatic embedding (supports string/number IDs, metadata) |
| `semantic_search`  | Natural language search with optional metadata filtering                      |
| `hybrid_search`    | Hybrid search combining semantic and keyword (BM25) search with RRF           |
| `delete_documents` | Delete specific documents by ID                                               |

### Resources

- `qdrant://collections` - List all collections
- `qdrant://collection/{name}` - Collection details

## Configurable Prompts

Create custom prompts tailored to your specific use cases without modifying code. Prompts provide guided workflows for common tasks.

**Note**: By default, the server looks for `prompts.json` in the project root directory. If the file exists, prompts are automatically loaded. You can specify a custom path using the `PROMPTS_CONFIG_FILE` environment variable.

### Setup

1. **Create a prompts configuration file** (e.g., `prompts.json` in the project root):

   See [`prompts.example.json`](prompts.example.json) for example configurations you can copy and customize.

2. **Configure the server** (optional - only needed for custom path):

If you place `prompts.json` in the project root, no additional configuration is needed. To use a custom path:

```json
{
  "mcpServers": {
    "qdrant": {
      "command": "node",
      "args": ["/path/to/qdrant-mcp-server/build/index.js"],
      "env": {
        "QDRANT_URL": "http://localhost:6333",
        "PROMPTS_CONFIG_FILE": "/custom/path/to/prompts.json"
      }
    }
  }
}
```

3. **Use prompts** in your AI assistant:

**Claude Code:**

```bash
/mcp__qdrant__find_similar_docs papers "neural networks" 10
```

**VSCode:**

```bash
/mcp.qdrant.find_similar_docs papers "neural networks" 10
```

### Example Prompts

See [`prompts.example.json`](prompts.example.json) for ready-to-use prompts including:

- `find_similar_docs` - Semantic search with result explanation
- `setup_rag_collection` - Create RAG-optimized collections
- `analyze_collection` - Collection insights and recommendations
- `bulk_add_documents` - Guided bulk document insertion
- `search_with_filter` - Metadata filtering assistance
- `compare_search_methods` - Semantic vs hybrid search comparison
- `collection_maintenance` - Maintenance and cleanup workflows
- `migrate_to_hybrid` - Collection migration guide

### Template Syntax

Templates use `{{variable}}` placeholders:

- Required arguments must be provided
- Optional arguments use defaults if not specified
- Unknown variables are left as-is in the output

## Examples

See [examples/](examples/) directory for detailed guides:

- **[Basic Usage](examples/basic/)** - Create collections, add documents, search
- **[Knowledge Base](examples/knowledge-base/)** - Structured documentation with metadata
- **[Advanced Filtering](examples/filters/)** - Complex boolean filters
- **[Rate Limiting](examples/rate-limiting/)** - Batch processing with cloud providers

## Advanced Configuration

### Environment Variables

| Variable                            | Description                            | Default               |
| ----------------------------------- | -------------------------------------- | --------------------- |
| `TRANSPORT_MODE`                    | "stdio" or "http"                      | stdio                 |
| `HTTP_PORT`                         | Port for HTTP transport                | 3000                  |
| `EMBEDDING_PROVIDER`                | "ollama", "openai", "cohere", "voyage" | ollama                |
| `QDRANT_URL`                        | Qdrant server URL                      | http://localhost:6333 |
| `PROMPTS_CONFIG_FILE`               | Path to prompts configuration JSON     | prompts.json          |
| `EMBEDDING_MODEL`                   | Model name                             | Provider-specific     |
| `EMBEDDING_BASE_URL`                | Custom API URL                         | Provider-specific     |
| `EMBEDDING_MAX_REQUESTS_PER_MINUTE` | Rate limit                             | Provider-specific     |
| `EMBEDDING_RETRY_ATTEMPTS`          | Retry count                            | 3                     |
| `EMBEDDING_RETRY_DELAY`             | Initial retry delay (ms)               | 1000                  |
| `OPENAI_API_KEY`                    | OpenAI API key                         | -                     |
| `COHERE_API_KEY`                    | Cohere API key                         | -                     |
| `VOYAGE_API_KEY`                    | Voyage AI API key                      | -                     |

### Provider Comparison

| Provider   | Models                                                          | Dimensions     | Rate Limit | Notes                |
| ---------- | --------------------------------------------------------------- | -------------- | ---------- | -------------------- |
| **Ollama** | `nomic-embed-text` (default), `mxbai-embed-large`, `all-minilm` | 768, 1024, 384 | None       | Local, no API key    |
| **OpenAI** | `text-embedding-3-small` (default), `text-embedding-3-large`    | 1536, 3072     | 3500/min   | Cloud API            |
| **Cohere** | `embed-english-v3.0` (default), `embed-multilingual-v3.0`       | 1024           | 100/min    | Multilingual support |
| **Voyage** | `voyage-2` (default), `voyage-large-2`, `voyage-code-2`         | 1024, 1536     | 300/min    | Code-specialized     |

**Note:** Ollama models require `docker exec ollama ollama pull <model-name>` before use.

## Troubleshooting

| Issue                  | Solution                                                                     |
| ---------------------- | ---------------------------------------------------------------------------- |
| **Qdrant not running** | `docker compose up -d`                                                       |
| **Collection missing** | Create collection first before adding documents                              |
| **Ollama not running** | Verify with `curl http://localhost:11434`, start with `docker compose up -d` |
| **Model missing**      | `docker exec ollama ollama pull nomic-embed-text`                            |
| **Rate limit errors**  | Adjust `EMBEDDING_MAX_REQUESTS_PER_MINUTE` to match your provider tier       |
| **API key errors**     | Verify correct API key in environment configuration                          |
| **Filter errors**      | Ensure Qdrant filter format, check field names match metadata                |

## Development

```bash
npm run dev          # Development with auto-reload
npm run build        # Production build
npm run type-check   # TypeScript validation
npm test             # Run test suite
npm run test:coverage # Coverage report
```

### Testing

**422 tests** (376 unit + 46 functional) with **98%+ coverage**:

- **Unit Tests**: QdrantManager (21), Ollama (31), OpenAI (25), Cohere (29), Voyage (31), Factory (32), MCP Server (19)
- **Functional Tests**: Live API integration, end-to-end workflows (46)

**CI/CD**: GitHub Actions runs build, type-check, and tests on Node.js 20 & 22 for every push/PR.

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for:

- Development workflow
- Conventional commit format (`feat:`, `fix:`, `BREAKING CHANGE:`)
- Testing requirements (run `npm test`, `npm run type-check`, `npm run build`)

**Automated releases**: Semantic versioning via conventional commits - `feat:` → minor, `fix:` → patch, `BREAKING CHANGE:` → major.

## License

MIT - see [LICENSE](LICENSE) file.
