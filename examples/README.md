# Examples

Practical examples demonstrating Qdrant MCP Server usage.

## Quick Start

```bash
docker compose up -d
docker exec ollama ollama pull nomic-embed-text
```

See main [README](../README.md) for MCP server configuration.

## Available Examples

### 🎯 [Basic Usage](./basic/)
**Start here** - fundamental operations

- Creating collections
- Adding documents
- Semantic search
- Resource management

**Time:** 5-10 minutes | **Difficulty:** Beginner

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

## Learning Path

```
Basic → Rate Limiting → Knowledge Base → Advanced Filtering
```

## Common Patterns

| Pattern | Metadata Structure | Use Case |
|---------|-------------------|----------|
| Content Organization | `category`, `topic`, `author`, `date` | Blogs, docs, articles |
| E-commerce | `category`, `price`, `rating`, `in_stock`, `brand` | Product catalogs |
| Access Control | `visibility`, `department`, `sensitivity` | Enterprise knowledge |
| Temporal Data | `created_at`, `updated_at`, `status`, `version` | Versioned content |

## Tips

1. **Start Small** - Test with 5-10 documents before scaling
2. **Design Metadata First** - Plan fields, types, and filters
3. **Use Consistent IDs** - Choose a scheme (sequential, prefixed, semantic, UUIDs)
4. **Test Searches** - Validate semantic matching and filters
5. **Clean Up** - Delete test collections when done

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Collection exists | `Delete collection "name"` then recreate |
| No search results | Check collection has documents, try without filters |
| Unexpected results | Validate metadata and filter syntax |
| "Collection not found" | Create collection first |
| "Bad Request" | Check filter JSON syntax |
| API errors | Verify provider API key and credits |

## Next Steps

1. Read [main README](../README.md) - Full tool documentation
2. Apply concepts to your data
3. Explore advanced features
4. [Contribute](../CONTRIBUTING.md) examples

## Additional Resources

- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings)
- [Cohere Embeddings](https://docs.cohere.com/docs/embeddings)
- [Voyage AI](https://docs.voyageai.com/)
- [Ollama](https://ollama.ai/docs)
- [Model Context Protocol](https://modelcontextprotocol.io/)
