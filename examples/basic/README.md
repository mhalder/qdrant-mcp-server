# Basic Usage

Learn fundamental operations: create collections, add documents, search, and manage resources.

**Time:** 5-10 minutes | **Difficulty:** Beginner

## Prerequisites

- Qdrant and Ollama running: `docker compose up -d`
- Model pulled: `docker exec ollama ollama pull nomic-embed-text`
- MCP Server configured (see main README)

## Workflow

```
# 1. Create collection
Create a collection named "basic-example"

# 2. Add documents (auto-embedded with Ollama)
Add these documents to basic-example:
- id: 1, text: "The quick brown fox jumps over the lazy dog"
- id: 2, text: "Machine learning is a subset of artificial intelligence"
- id: 3, text: "Python is a popular programming language"

# 3. Search
Search basic-example for "AI and computer programs"
# Expected: Doc 2 ranks highest (ML/AI), Doc 3 lower (programming)

# 4. Get info
Get info about "basic-example" collection

# 5. List all
List all collections

# 6. Delete documents (optional)
Delete documents [1, 3] from basic-example

# 7. Clean up
Delete collection "basic-example"
```

## Try It

```
Create a collection named "my-first-collection"

Add these documents to my-first-collection:
- id: "doc1", text: "Coffee is a popular morning beverage"
- id: "doc2", text: "Tea comes in many varieties like green, black, and oolong"
- id: "doc3", text: "Orange juice is rich in vitamin C"

Search my-first-collection for "healthy drinks"

Delete collection "my-first-collection"
```

## Next

- [Knowledge Base](../knowledge-base/) - Metadata and organization
- [Filters](../filters/) - Advanced search filtering
- [Rate Limiting](../rate-limiting/) - Batch operations
