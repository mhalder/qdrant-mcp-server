# Qdrant MCP Server

[![CI](https://github.com/mhalder/qdrant-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/mhalder/qdrant-mcp-server/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/mhalder/qdrant-mcp-server/branch/main/graph/badge.svg)](https://codecov.io/gh/mhalder/qdrant-mcp-server)

A Model Context Protocol (MCP) server providing semantic search capabilities using Qdrant vector database with multiple embedding providers.

## Features

- **Zero Setup**: Works out of the box with Ollama - no API keys required
- **Privacy-First**: Local embeddings and vector storage - data never leaves your machine
- **Multiple Providers**: Ollama (default), OpenAI, Cohere, and Voyage AI
- **Semantic Search**: Natural language search with metadata filtering
- **Rate Limiting**: Intelligent throttling with exponential backoff
- **Full CRUD**: Create, search, and manage collections and documents

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

**Using a different provider:**

```json
"env": {
  "EMBEDDING_PROVIDER": "openai",  // or "cohere", "voyage"
  "OPENAI_API_KEY": "sk-...",      // provider-specific API key
  "QDRANT_URL": "http://localhost:6333"
}
```

Restart after making changes.

## Tools

### Collection Management

| Tool | Description |
|------|-------------|
| `create_collection` | Create collection with specified distance metric (Cosine/Euclid/Dot) |
| `list_collections` | List all collections |
| `get_collection_info` | Get collection details and statistics |
| `delete_collection` | Delete collection and all documents |

### Document Operations

| Tool | Description |
|------|-------------|
| `add_documents` | Add documents with automatic embedding (supports string/number IDs, metadata) |
| `semantic_search` | Natural language search with optional metadata filtering |
| `delete_documents` | Delete specific documents by ID |

### Usage Examples

**Create and populate:**
```
Create a collection named "docs"
Add to "docs": id: 1, text: "Vector databases enable semantic search"
```

**Search with filters:**
```
Search "docs" for "semantic search" with filter {"must": [{"key": "category", "match": {"value": "tech"}}]}
```

**Filter operators:**
- `must` - AND conditions
- `should` - OR conditions
- `must_not` - NOT conditions

### Resources

- `qdrant://collections` - List all collections
- `qdrant://collection/{name}` - Collection details

## Example Workflow

```
# 1. Create collection
Create a collection called "docs"

# 2. Add documents with metadata
Add to "docs":
- id: 1, text: "MCP enables AI context", metadata: {"type": "definition"}
- id: 2, text: "Vector databases enable semantic search", metadata: {"type": "tech"}

# 3. Search
Search "docs" for "AI context protocols"

# 4. Search with filters
Search "docs" for "databases" with filter {"must": [{"key": "type", "match": {"value": "tech"}}]}
```

## Configuration

### Environment Variables

**Common:**
- `EMBEDDING_PROVIDER` - Provider: "ollama" (default), "openai", "cohere", "voyage"
- `QDRANT_URL` - Qdrant URL (default: http://localhost:6333)
- `EMBEDDING_MODEL` - Model name (provider-specific defaults)
- `EMBEDDING_BASE_URL` - Custom API URL (Voyage AI, Ollama)

**Rate Limiting:**
- `EMBEDDING_MAX_REQUESTS_PER_MINUTE` - Rate limit (provider defaults: OpenAI 3500, Cohere 100, Voyage 300, Ollama 1000)
- `EMBEDDING_RETRY_ATTEMPTS` - Retry count (default: 3)
- `EMBEDDING_RETRY_DELAY` - Initial retry delay in ms (default: 1000, exponential backoff)

**API Keys:**
- `OPENAI_API_KEY` - OpenAI API key
- `COHERE_API_KEY` - Cohere API key
- `VOYAGE_API_KEY` - Voyage AI API key

### Embedding Models

| Provider | Models | Dimensions | Notes |
|----------|--------|------------|-------|
| **Ollama** | `nomic-embed-text` (default), `mxbai-embed-large`, `all-minilm` | 768, 1024, 384 | Local, no API key |
| **OpenAI** | `text-embedding-3-small` (default), `text-embedding-3-large` | 1536, 3072 | Cloud API |
| **Cohere** | `embed-english-v3.0` (default), `embed-multilingual-v3.0` | 1024 | Multilingual support |
| **Voyage** | `voyage-2` (default), `voyage-large-2`, `voyage-code-2` | 1024, 1536 | Code-specialized |

**Note:** Ollama models require `ollama pull <model-name>` before use.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **Qdrant not running** | `docker compose up -d` |
| **Collection missing** | Create collection first before adding documents |
| **Ollama not running** | Verify with `curl http://localhost:11434`, start with `docker compose up -d` |
| **Model missing** | `docker exec ollama ollama pull nomic-embed-text` |
| **Rate limit errors** | Adjust `EMBEDDING_MAX_REQUESTS_PER_MINUTE` to match your provider tier |
| **API key errors** | Verify correct API key in environment configuration |
| **Filter errors** | Ensure Qdrant filter format, check field names match metadata |

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

See [`docs/test_report.md`](docs/test_report.md) for detailed coverage.

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Development workflow
- Conventional commit format (`feat:`, `fix:`, `BREAKING CHANGE:`)
- Testing requirements (run `npm test`, `npm run type-check`, `npm run build`)

**Automated releases**: Semantic versioning via conventional commits - `feat:` → minor, `fix:` → patch, `BREAKING CHANGE:` → major.

## License

MIT - see [LICENSE](LICENSE) file.
