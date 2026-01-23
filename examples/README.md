# Examples

Practical examples demonstrating Qdrant MCP Server usage.

## Prerequisites

Before running examples:

```bash
# Start services (choose one)
podman compose up -d   # Using Podman
docker compose up -d   # Using Docker

# Pull embedding model
podman exec ollama ollama pull nomic-embed-text  # Podman
docker exec ollama ollama pull nomic-embed-text  # Docker
```

Configure MCP server as described in [main README](../README.md).

## Available Examples

### 🎯 [Basic Usage](./basic/)

**Start here** - fundamental operations

- Creating collections
- Adding documents
- Semantic search
- Resource management

**Time:** 5-10 minutes | **Difficulty:** Beginner

---

### 🔀 [Hybrid Search](./hybrid-search/)

Combine semantic and keyword search for better results

- Understanding hybrid search benefits
- Creating hybrid-enabled collections
- Comparing semantic vs hybrid search
- Best practices for technical content

**Use cases:** Technical docs, product search, legal documents, code search

**Time:** 15-20 minutes | **Difficulty:** Intermediate

---

### ⚡ [Rate Limiting](./rate-limiting/)

Automatic rate limit handling for batch operations

- Configuring provider rate limits
- Batch document processing
- Exponential backoff retry
- Monitoring and troubleshooting

**Use cases:** High-volume ingestion, free tier optimization, production reliability

**Time:** 10-15 minutes | **Difficulty:** Beginner to Intermediate

---

### 📚 [Knowledge Base](./knowledge-base/)

Searchable documentation system with metadata

- Structuring documents with rich metadata
- Organizing by team, topic, difficulty
- Filtering searches by categories
- Scaling and maintenance

**Use cases:** Company docs, help centers, internal wikis, education

**Time:** 15-20 minutes | **Difficulty:** Intermediate

---

### 🔍 [Advanced Filtering](./filters/)

Complex search filters with boolean logic

- Multiple filter conditions (AND, OR, NOT)
- Filtering by categories, ratings, availability
- Range filters for numeric values
- E-commerce search patterns

**Use cases:** Product catalogs, inventory, content filtering, access control

**Time:** 20-30 minutes | **Difficulty:** Intermediate to Advanced

---

### 💻 [Code Search](./code-search/)

Semantic code search with AST-aware chunking

- Indexing codebases with intelligent chunking
- Natural language queries for code
- Filtering by file type and path
- Incremental re-indexing

**Use cases:** Code exploration, onboarding, bug investigation, documentation

**Time:** 15-20 minutes | **Difficulty:** Intermediate

---

### 🚀 [Advanced Search](./advanced-search/)

Combined code + git search and multi-repository search

- **Contextual Search**: Query code and git history together with correlations
- **Federated Search**: Search across multiple repositories with RRF ranking
- Tracing feature evolution through history
- Cross-project pattern discovery

**Use cases:** Code archaeology, security audits, microservices, onboarding

**Time:** 20-30 minutes | **Difficulty:** Advanced

## Learning Path

```
Basic → Hybrid Search → Rate Limiting → Knowledge Base → Advanced Filtering
                                              ↓
                                        Code Search → Advanced Search
```

## Common Patterns

| Pattern              | Metadata Structure                                 | Use Case              |
| -------------------- | -------------------------------------------------- | --------------------- |
| Content Organization | `category`, `topic`, `author`, `date`              | Blogs, docs, articles |
| E-commerce           | `category`, `price`, `rating`, `in_stock`, `brand` | Product catalogs      |
| Access Control       | `visibility`, `department`, `sensitivity`          | Enterprise knowledge  |
| Temporal Data        | `created_at`, `updated_at`, `status`, `version`    | Versioned content     |

## Tips

1. **Start Small** - Test with 5-10 documents before scaling
2. **Design Metadata First** - Plan fields, types, and filters
3. **Use Consistent IDs** - Choose a scheme (sequential, prefixed, semantic, UUIDs)
4. **Test Searches** - Validate semantic matching and filters
5. **Clean Up** - Delete test collections when done

## Troubleshooting

| Issue                  | Solution                                            |
| ---------------------- | --------------------------------------------------- |
| Collection exists      | `Delete collection "name"` then recreate            |
| No search results      | Check collection has documents, try without filters |
| Unexpected results     | Validate metadata and filter syntax                 |
| "Collection not found" | Create collection first                             |
| "Bad Request"          | Check filter JSON syntax                            |
| API errors             | Verify provider API key and credits                 |

## Next Steps

1. Review [main README](../README.md) for full tool documentation
2. Apply patterns to your own use cases
3. Explore advanced features and configurations
4. Share your examples via [CONTRIBUTING.md](../CONTRIBUTING.md)

## Additional Resources

- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings)
- [Cohere Embeddings](https://docs.cohere.com/docs/embeddings)
- [Voyage AI](https://docs.voyageai.com/)
- [Ollama](https://ollama.ai/docs)
- [Model Context Protocol](https://modelcontextprotocol.io/)
