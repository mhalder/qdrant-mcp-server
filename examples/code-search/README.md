# Code Search Example

This example demonstrates how to use the code vectorization features to index and search codebases semantically.

## Prerequisites

- Qdrant and Ollama running (see main README)
- Qdrant MCP server configured

## Example 1: Index a TypeScript Project

```bash
# Index your project
/mcp__qdrant__index_codebase /path/to/your/typescript/project

# Expected output:
# Scanning files...
# Found 247 files
# Chunking code...
# Generating embeddings...
# Storing chunks...
# ✓ Indexed 247 files (1,823 chunks) in 45.2s
```

## Example 2: Search for Authentication Code

```bash
# Natural language search
/mcp__qdrant__search_code /path/to/your/project "how does user authentication work?"

# Results will include:
# - File path and line numbers (e.g., src/auth/middleware.ts:15-42)
# - Code snippets
# - Relevance scores
# - Language information
```

## Example 3: Search with Filters

### Filter by File Type

```bash
# Only search TypeScript files
/mcp__qdrant__search_code /path/to/your/project "error handling" --fileTypes .ts,.tsx
```

### Filter by Path Pattern

```bash
# Only search in API routes
/mcp__qdrant__search_code /path/to/your/project "request validation" --pathPattern src/api/**
```

## Example 4: Incremental Updates

After making changes to your codebase:

```bash
# Re-index only changed files
/mcp__qdrant__reindex_changes /path/to/your/project

# Expected output:
# Detecting changes...
# Found: +3 added, ~5 modified, -1 deleted
# Updating index...
# ✓ Updated in 8.3s
# Chunks: +47 added, -23 deleted
```

## Example 5: Check Index Status

The index status tracks three states: `not_indexed`, `indexing`, and `indexed`.

```bash
# Check status before indexing
/mcp__qdrant__get_index_status /path/to/your/project
# Output: Codebase at "/path/to/your/project" is not indexed. Use index_codebase to index it first.

# Check status during indexing (in another terminal/session)
/mcp__qdrant__get_index_status /path/to/your/project
# Output: Codebase at "/path/to/your/project" is currently being indexed. 523 chunks processed so far.

# Check status after indexing completes
/mcp__qdrant__get_index_status /path/to/your/project
# Output:
# {
#   "isIndexed": true,
#   "status": "indexed",
#   "collectionName": "code_a3f8d2e1",
#   "chunksCount": 1823,
#   "lastUpdated": "2025-01-30T10:15:00Z"
# }
```

This is useful for monitoring long-running indexing operations on large codebases.

## Example 6: Multi-Language Project

For projects with multiple languages:

```bash
# Index a full-stack project
/mcp__qdrant__index_codebase /path/to/fullstack/project

# The indexer automatically detects:
# - Frontend: TypeScript, React, Vue
# - Backend: Python, Go, Java
# - Config: JSON, YAML, TOML
# - Scripts: Bash, Shell

# Search across all languages
/mcp__qdrant__search_code /path/to/fullstack/project "database connection pooling"
```

## Example 7: Custom Ignore Patterns

Create a `.contextignore` file in your project root:

```gitignore
# .contextignore
**/test/**
**/*.test.ts
**/*.spec.ts
**/fixtures/**
**/mocks/**
**/__tests__/**
**/coverage/**
*.generated.ts
```

Then index normally - these patterns will be automatically applied.

## Example 8: Force Re-index

If you need to completely re-index (e.g., after changing chunking settings):

```bash
# Force full re-index
/mcp__qdrant__index_codebase /path/to/your/project --forceReindex true
```

## Example 9: Custom File Extensions

Index non-standard file types:

```bash
# Add custom extensions
/mcp__qdrant__index_codebase /path/to/your/project --extensions .proto,.graphql,.prisma
```

## Use Cases

### 1. New Developer Onboarding

**Scenario**: New developer needs to understand authentication flow

```bash
# Index the codebase once
/mcp__qdrant__index_codebase /workspace/company-app

# Then ask questions:
/mcp__qdrant__search_code /workspace/company-app "authentication middleware"
/mcp__qdrant__search_code /workspace/company-app "JWT token validation"
/mcp__qdrant__search_code /workspace/company-app "password hashing"
```

### 2. Bug Investigation

**Scenario**: Production bug in payment processing

```bash
# Search for payment-related code
/mcp__qdrant__search_code /workspace/app "payment processing error handling"

# Narrow down to specific service
/mcp__qdrant__search_code /workspace/app "stripe payment" --pathPattern src/services/payment/**

# Find related tests
/mcp__qdrant__search_code /workspace/app "payment processing tests" --fileTypes .test.ts
```

### 3. Code Review

**Scenario**: Understanding changes in a PR

```bash
# Index the feature branch
git checkout feature/new-api
/mcp__qdrant__index_codebase /workspace/app

# Search for specific implementations
/mcp__qdrant__search_code /workspace/app "new API endpoints"
/mcp__qdrant__search_code /workspace/app "validation logic"
```

### 4. Documentation Writing

**Scenario**: Writing API documentation

```bash
# Find all API endpoints
/mcp__qdrant__search_code /workspace/app "REST API endpoints"
/mcp__qdrant__search_code /workspace/app "GraphQL resolvers"

# Find request/response schemas
/mcp__qdrant__search_code /workspace/app "API schema definitions"
```

## Performance Tips

1. **Use incremental updates**: After initial indexing, always use `reindex_changes` instead of full re-index
2. **Filter aggressively**: Use `fileTypes` and `pathPattern` to narrow search scope
3. **Batch indexing**: For very large codebases, consider indexing subdirectories separately
4. **Local embeddings**: Use Ollama for fastest indexing and complete privacy
5. **Monitor progress**: Check `get_index_status` to see indexing statistics

## Troubleshooting

### Slow Indexing

```bash
# Check current settings
echo $CODE_BATCH_SIZE  # Default: 100

# Increase batch size (if you have good internet/API limits)
export CODE_BATCH_SIZE=200

# Or use local Ollama (fastest)
export EMBEDDING_PROVIDER=ollama
```

### Search Returns No Results

```bash
# Check if codebase is indexed
/mcp__qdrant__get_index_status /path/to/your/project

# Possible status responses:
# - "not indexed" → Run index_codebase first
# - "currently being indexed" → Wait for indexing to complete
# - JSON with status: "indexed" → Codebase is ready for search

# If not indexed:
/mcp__qdrant__index_codebase /path/to/your/project

# Try broader queries
# Instead of: "getUserById"
# Try: "user retrieval functions"
```

### Files Not Being Indexed

Check ignore patterns:

```bash
# View .gitignore
cat /path/to/your/project/.gitignore

# Create .contextignore to override
echo "!tests/**" > /path/to/your/project/.contextignore
```

## Advanced Configuration

Set environment variables for customization:

```bash
# Larger chunks for more context
export CODE_CHUNK_SIZE=5000
export CODE_CHUNK_OVERLAP=500

# More results by default
export CODE_DEFAULT_LIMIT=10

# Custom file types
export CODE_CUSTOM_EXTENSIONS=".prisma,.proto,.graphql"

# Additional ignore patterns
export CODE_CUSTOM_IGNORE="**/*.generated.ts,**/dist/**"
```

## Next Steps

- Explore [hybrid search](../filters/) for better accuracy
- Set up [custom prompts](../../prompts.example.json) for code search workflows
- Integrate with your AI assistant for interactive code exploration
