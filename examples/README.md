# Qdrant MCP Server Examples

Practical examples demonstrating how to use the Qdrant MCP Server for various use cases.

## Quick Start

Before running these examples, ensure you have:

1. **Qdrant and Ollama running**: `docker compose up -d`
2. **Ollama model pulled**: `docker exec ollama ollama pull nomic-embed-text`
3. **MCP Server configured**: See main [README](../README.md) for setup
4. **Optional - Alternative providers**: Configure API key for OpenAI, Cohere, or Voyage AI if not using Ollama

## Available Examples

### 🎯 [Basic Usage](./basic/)

**Start here if you're new to the MCP server.**

Learn fundamental operations:

- Creating collections
- Adding documents
- Performing semantic searches
- Managing resources

**Time:** 5-10 minutes
**Difficulty:** Beginner

---

### ⚡ [Rate Limiting](./rate-limiting/)

**Understand automatic rate limit handling for batch operations.**

Topics covered:

- Configuring rate limits for your embedding provider
- Batch document processing
- Exponential backoff retry behavior
- Monitoring and troubleshooting

**Use cases:**

- High-volume document ingestion
- Free tier optimization
- Production reliability
- Batch operations

**Time:** 10-15 minutes
**Difficulty:** Beginner to Intermediate

---

### 📚 [Knowledge Base](./knowledge-base/)

**Build a searchable documentation system with metadata.**

Topics covered:

- Structuring documents with rich metadata
- Organizing content by team, topic, and difficulty
- Filtering searches by categories
- Scaling and maintenance strategies

**Use cases:**

- Company documentation
- Help centers
- Internal wikis
- Educational content

**Time:** 15-20 minutes
**Difficulty:** Intermediate

---

### 🔍 [Advanced Filtering](./filters/)

**Master complex search filters with boolean logic.**

Learn to:

- Combine multiple filter conditions (AND, OR, NOT)
- Filter by categories, prices, ratings, and availability
- Use range filters for numeric values
- Build sophisticated e-commerce searches

**Use cases:**

- Product catalogs
- Inventory management
- Content filtering
- Access control

**Time:** 20-30 minutes
**Difficulty:** Intermediate to Advanced

---

## Example Structure

Each example includes:

- **README.md** - Step-by-step tutorial with commands
- **Sample data** - Documents with metadata to copy/paste
- **Search examples** - Real queries you can try
- **Best practices** - Tips and recommendations

## How to Use These Examples

### Option 1: Interactive with Claude Code

Copy commands directly into Claude Code:

```
Create a collection named "test"
Add documents...
Search for...
```

### Option 2: Understand the Concepts

Read through examples to understand:

- Metadata design patterns
- Filter syntax and structure
- Search result ranking
- Collection organization

### Option 3: Adapt for Your Use Case

Use examples as templates:

1. Start with the closest matching example
2. Modify metadata structure for your data
3. Adjust search queries for your needs
4. Scale up with your own documents

## Learning Path

```
┌─────────────┐
│   Basic     │  Start here - core operations
└──────┬──────┘
       │
       ├──────────┐
       │          ▼
       │     ┌─────────────┐
       │     │    Rate     │  Learn automatic rate limit handling
       │     │  Limiting   │  (especially for batch operations)
       │     └─────────────┘
       │
       ▼
┌─────────────┐
│ Knowledge   │  Add structure with metadata
│    Base     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Advanced   │  Master complex filtering
│  Filtering  │
└─────────────┘
```

## Common Patterns

### Pattern 1: Content Organization

```
metadata: {
  "category": "type",
  "topic": "subject",
  "author": "creator",
  "date": "2024-01-15"
}
```

Good for: Blogs, documentation, articles

### Pattern 2: E-commerce

```
metadata: {
  "category": "electronics",
  "price": 99.99,
  "rating": 4.5,
  "in_stock": true,
  "brand": "BrandName"
}
```

Good for: Product catalogs, inventory systems

### Pattern 3: Access Control

```
metadata: {
  "visibility": "internal",
  "department": "engineering",
  "sensitivity": "confidential"
}
```

Good for: Enterprise knowledge bases, secure documents

### Pattern 4: Temporal Data

```
metadata: {
  "created_at": "2024-01-15",
  "updated_at": "2024-03-20",
  "status": "published",
  "version": "2.1"
}
```

Good for: Versioned content, time-series data

## Tips for All Examples

### 1. Start Small

Test with 5-10 documents before scaling to thousands.

### 2. Design Metadata First

Plan your metadata structure before adding documents:

- What fields do you need?
- What will you filter by?
- What types (string, number, boolean)?

### 3. Use Consistent IDs

Choose an ID scheme:

- Sequential: `1`, `2`, `3`
- Prefixed: `doc-001`, `doc-002`
- Semantic: `eng-api-auth`, `sales-pricing`
- UUIDs: Generated automatically

### 4. Test Searches

Try various queries to validate:

- Semantic matching works correctly
- Filters return expected results
- Result ranking makes sense

### 5. Clean Up

Delete test collections when done:

```
Delete collection "collection-name"
```

## Troubleshooting

### Collection Already Exists

```
Delete collection "name"
Create a collection named "name"
```

### No Search Results

- Check collection has documents: `Get info about "collection-name"`
- Verify filter syntax matches metadata exactly
- Try search without filters first

### Unexpected Results

- Check document metadata structure
- Validate filter conditions
- Review semantic similarity scores

### Error Messages

- **"Collection not found"**: Create the collection first
- **"Bad Request"**: Check filter JSON syntax
- **"API error"**: Verify your embedding provider API key and credits

## Next Steps

After completing these examples:

1. **Read the main [README](../README.md)** - Full tool documentation
2. **Explore your own data** - Apply concepts to real use cases
3. **Check out advanced features** - Quantization, hybrid search (future)
4. **Join the community** - Contribute examples and improvements

## Contributing

Have a great example to share? Please open a PR!

We're especially interested in:

- Domain-specific use cases (legal, medical, finance)
- Integration examples (RAG pipelines, chatbots)
- Performance optimization patterns
- Novel metadata structures

## Additional Resources

- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- [Cohere Embeddings Guide](https://docs.cohere.com/docs/embeddings)
- [Voyage AI Documentation](https://docs.voyageai.com/)
- [Ollama Documentation](https://ollama.ai/docs)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Main Project README](../README.md)
