# Basic Usage Example

This example demonstrates the fundamental operations of the Qdrant MCP Server.

## What You'll Learn

- Creating a collection
- Adding documents with metadata
- Performing semantic search
- Cleaning up resources

## Prerequisites

- Qdrant MCP Server running
- Embedding provider configured (OpenAI, Cohere, Voyage AI, or Ollama)
- Claude Code or another MCP client

## Example Workflow

### 1. Create a Collection

```
Create a collection named "basic-example"
```

This creates a new vector collection with default settings (Cosine distance, dimensions based on your embedding provider).

### 2. Add Documents

```
Add these documents to basic-example:
- id: 1, text: "The quick brown fox jumps over the lazy dog"
- id: 2, text: "Machine learning is a subset of artificial intelligence"
- id: 3, text: "Python is a popular programming language"
```

Documents are automatically embedded using your configured embedding provider.

### 3. Search for Similar Documents

```
Search basic-example for "AI and computer programs"
```

Expected results:

- Document 2 (ML/AI) should rank highest
- Document 3 (Python/programming) may appear with lower score

### 4. Get Collection Information

```
Get info about "basic-example" collection
```

Returns:

- Vector dimensions
- Number of documents
- Distance metric used

### 5. View All Collections

```
List all collections
```

Shows all available collections in your Qdrant instance.

### 6. Delete Documents (Optional)

```
Delete documents [1, 3] from basic-example
```

Removes specific documents by ID.

### 7. Clean Up

```
Delete collection "basic-example"
```

Removes the collection and all its data.

## Try It Yourself

Copy these commands into Claude Code:

```
Create a collection named "my-first-collection"

Add these documents to my-first-collection:
- id: "doc1", text: "Coffee is a popular morning beverage"
- id: "doc2", text: "Tea comes in many varieties like green, black, and oolong"
- id: "doc3", text: "Orange juice is rich in vitamin C"

Search my-first-collection for "healthy drinks"

Get info about "my-first-collection" collection

Delete collection "my-first-collection"
```

## Next Steps

- [Knowledge Base Example](../knowledge-base/) - Learn about metadata and organization
- [Advanced Filtering](../filters/) - Discover powerful search filtering
