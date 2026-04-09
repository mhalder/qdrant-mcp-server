---
name: qdrant-mcp
description: >
  Use this skill when working with the Qdrant MCP server to perform semantic search,
  manage vector collections, index codebases, search git history, or run advanced
  cross-repo searches. Trigger whenever the user asks to: store or retrieve documents
  semantically, search a codebase with natural language, find relevant commits, index
  files for vector search, or use any Qdrant collection management operation. Also
  trigger when the user says things like "search my code for X", "find commits related
  to X", "add this to my knowledge base", or "semantic search".
---

# Qdrant MCP Server — Tool Reference

The Qdrant MCP server exposes tools for vector-based semantic search, document storage,
codebase indexing, and git history search. All tools are available via MCP tool calls.

---

## Tool Groups

### 1. Collection Management

Use these first — documents must live in a named collection.

| Tool | When to Use |
|------|-------------|
| `create_collection` | Before adding any documents. Specify distance metric: `Cosine` (default, best for text), `Euclid`, or `Dot` |
| `list_collections` | Discover what collections exist |
| `get_collection_info` | Check collection stats, point count, vector dimensions |
| `delete_collection` | Remove a collection and all its documents |

**Workflow**: Always `list_collections` first to check if a collection exists before creating.

---

### 2. Document Operations

| Tool | When to Use |
|------|-------------|
| `add_documents` | Add text documents with optional metadata. Supports string or numeric IDs |
| `semantic_search` | Natural language search over a collection. Supports metadata filters |
| `hybrid_search` | Combines semantic (vector) + keyword (BM25) search via RRF. Better for exact-term queries |
| `delete_documents` | Remove specific documents by ID |

**Choosing search type:**
- `semantic_search` — best for conceptual/meaning-based queries ("how does auth work?")
- `hybrid_search` — best when the query contains specific terms/names that matter exactly

**Metadata filtering** is supported in both search tools. Filter by any field stored in document metadata (e.g., `{ "must": [{ "key": "language", "match": { "value": "typescript" } }] }`).

---

### 3. Code Vectorization

Index a codebase for semantic code search. Uses AST-aware chunking (tree-sitter) to split at function/class boundaries. Supports 35+ file types.

| Tool | When to Use |
|------|-------------|
| `index_codebase` | Initial indexing of a project directory. Pass `forceReindex: true` to re-index from scratch |
| `search_code` | Natural language search over indexed code. Supports `fileTypes` and `pathPattern` filters |
| `reindex_changes` | Incremental update — only re-indexes added/modified/deleted files |
| `get_index_status` | Check if a codebase is indexed, how many files/chunks, last updated |
| `clear_index` | Delete all indexed data for a codebase path |

**Standard workflow:**
1. `get_index_status` — check if already indexed
2. `index_codebase` — if not indexed (or `forceReindex` needed)
3. `search_code` — query with natural language
4. `reindex_changes` — after making code edits

**Search filters:**
```
fileTypes: [".ts", ".tsx"]         // restrict by extension
pathPattern: "src/api/**"          // restrict by glob path
limit: 10                          // default is 5
```

**Respects**: `.gitignore`, `.dockerignore`, and `.contextignore` (custom ignore file in project root).

---

### 4. Git History Search

Index and semantically search a repo's commit history.

| Tool | When to Use |
|------|-------------|
| `index_git_history` | Initial indexing of commit history for a repo |
| `search_git_history` | Natural language search over commits. Filter by `commitTypes`, `authors`, date range |
| `index_new_commits` | Incremental — index only commits since last run |
| `get_git_index_status` | Check indexing status and stats |
| `clear_git_index` | Delete all git history index data for a repo |

**Filter options for `search_git_history`:**
```
commitTypes: ["fix", "feat", "perf"]   // conventional commit types
authors: ["user@example.com"]
dateFrom / dateTo
limit: 10
```

**Good query patterns:**
- "fix authentication bug" → finds commits that fixed auth issues
- "database optimization refactor" → finds perf/refactor commits touching DB
- "how was X implemented" → finds feat commits for a feature

---

### 5. Advanced Search

Requires both `index_codebase` AND `index_git_history` to be run first.

| Tool | When to Use |
|------|-------------|
| `contextual_search` | Combined code + git history search with automatic file-commit correlation. Best for "how/why was X built?" questions |
| `federated_search` | Search across multiple repos simultaneously using Reciprocal Rank Fusion (RRF) ranking |

**When to use contextual vs federated:**
- `contextual_search` — deep dive into one repo (code + history together)
- `federated_search` — "find this pattern across all my projects"

---

## Resources

Two MCP resources are available (read-only, no parameters):

| Resource URI | Returns |
|---|---|
| `qdrant://collections` | List of all collections |
| `qdrant://collection/{name}` | Details for a specific collection |

---

## Common Patterns

### Build a knowledge base
```
1. create_collection("knowledge", "Cosine")
2. add_documents("knowledge", [...docs with metadata])
3. semantic_search("knowledge", "query here")
```

### Index and search a codebase
```
1. get_index_status("/path/to/project")
2. index_codebase("/path/to/project")          // if not indexed
3. search_code("/path/to/project", "auth middleware")
4. reindex_changes("/path/to/project")         // after edits
```

### Investigate a bug fix via git
```
1. index_git_history("/path/to/repo")
2. search_git_history("/path/to/repo", "null pointer crash in payment")
```

### Deep codebase investigation
```
1. index_codebase + index_git_history (both required)
2. contextual_search("/path/to/repo", "how was rate limiting implemented?")
```

---

## Notes

- Always check `get_index_status` or `list_collections` before assuming data exists
- Incremental tools (`reindex_changes`, `index_new_commits`) are fast — prefer them over full re-index
- `hybrid_search` generally outperforms `semantic_search` when queries contain specific identifiers or technical terms
- Collection names are arbitrary strings — use descriptive names (`code_myproject`, `notes`, `git_myrepo`)