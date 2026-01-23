# Advanced Search Examples

This example demonstrates how to use the advanced search features: contextual search (combined code + git) and federated search (multi-repository).

## Prerequisites

- Qdrant and Ollama running (see main README)
- Qdrant MCP server configured
- At least one repository indexed for both code AND git history

## Setup: Index a Repository

Before using advanced search, you need to index both code and git history:

```bash
# Step 1: Index the codebase
/mcp__qdrant__index_codebase /path/to/your/repo

# Step 2: Index git history
/mcp__qdrant__index_git_history /path/to/your/repo

# Verify both indexes exist
/mcp__qdrant__get_index_status /path/to/your/repo
/mcp__qdrant__get_git_index_status /path/to/your/repo
```

---

## Contextual Search

Contextual search queries both code and git history simultaneously, then correlates results to show which commits modified which code.

### Example 1: Basic Contextual Search

````bash
# Search for authentication-related code and commits
/mcp__qdrant__contextual_search /path/to/your/repo "user authentication"

# Expected output:
# ## Code Results
#
# ### 1. src/auth/middleware.ts:15-42 (score: 0.891)
# Language: typescript
# ```typescript
# export async function authenticateUser(req: Request) {
#   const token = req.headers.authorization?.split(' ')[1];
#   if (!token) throw new UnauthorizedError();
#   // ...
# }
# ```
#
# ## Git History Results
#
# ### 1. abc123d - feat: add JWT authentication (score: 0.845)
# Author: John Doe | Date: 2024-01-15 | Type: feat
# Files: src/auth/middleware.ts, src/auth/jwt.ts
#
# ## Correlations (Code ↔ Commits)
#
# **src/auth/middleware.ts:15** modified by:
#   - abc123d: feat: add JWT authentication
#   - def456a: fix: handle expired tokens
#
# ---
# Found 5 code result(s), 5 git result(s), 3 correlation(s).
````

### Example 2: Adjust Result Limits

```bash
# Get more code results, fewer git results
/mcp__qdrant__contextual_search /path/to/your/repo "database queries" --codeLimit 10 --gitLimit 3
```

### Example 3: Disable Correlations

For faster results when you don't need file-commit linking:

```bash
# Skip correlation building
/mcp__qdrant__contextual_search /path/to/your/repo "API endpoints" --correlate false

# Output will show code and git results, but no correlations section
```

### Example 4: Bug Investigation Workflow

**Scenario**: A bug was reported in the payment system

```bash
# Step 1: Find related code and commits
/mcp__qdrant__contextual_search /workspace/app "payment processing error"

# Step 2: From the correlations, identify recent changes
# The output shows which commits modified the relevant files

# Step 3: Drill down into specific commits
/mcp__qdrant__search_git_history /workspace/app "payment" --commitTypes fix
```

### Example 5: Code Review Preparation

**Scenario**: Reviewing changes to the authentication system

```bash
# Understand the current state and history together
/mcp__qdrant__contextual_search /workspace/app "authentication middleware"

# The correlations show you:
# - Current code implementation
# - Who changed it and when
# - What the commit messages said about the changes
```

---

## Federated Search

Federated search queries multiple repositories at once, combining and ranking results using Reciprocal Rank Fusion (RRF).

### Setup: Index Multiple Repositories

```bash
# Index repository 1
/mcp__qdrant__index_codebase /projects/api-server
/mcp__qdrant__index_git_history /projects/api-server

# Index repository 2
/mcp__qdrant__index_codebase /projects/web-app
/mcp__qdrant__index_git_history /projects/web-app

# Index repository 3
/mcp__qdrant__index_codebase /projects/shared-lib
/mcp__qdrant__index_git_history /projects/shared-lib
```

### Example 6: Search Across All Repositories

````bash
# Search all repos for authentication code
/mcp__qdrant__federated_search ["/projects/api-server", "/projects/web-app", "/projects/shared-lib"] "authentication"

# Expected output:
# # Federated Search Results
# Query: "authentication" | Type: both | Repositories: 3
#
# ## 1. [CODE] src/auth/jwt.ts:10-35
# Repository: /projects/api-server | Language: typescript | Score: 0.923
# ```typescript
# export function verifyJWT(token: string) { ... }
# ```
#
# ## 2. [GIT] def456a - fix: patch auth bypass vulnerability
# Repository: /projects/web-app | Author: Jane Smith | Date: 2024-02-20 | Score: 0.891
# Type: fix | Files: src/auth.js, src/middleware.js
#
# ## 3. [CODE] lib/session/manager.py:45-78
# Repository: /projects/shared-lib | Language: python | Score: 0.867
# ```python
# class SessionManager: ...
# ```
#
# ---
# Total: 20 result(s) from 3 repository(ies).
````

### Example 7: Code-Only Search

```bash
# Search only code across repositories
/mcp__qdrant__federated_search ["/projects/api-server", "/projects/web-app"] "database connection" --searchType code

# Results will only contain [CODE] entries
```

### Example 8: Git-Only Search

```bash
# Search only git history across repositories
/mcp__qdrant__federated_search ["/projects/api-server", "/projects/web-app"] "security fix" --searchType git

# Results will only contain [GIT] entries
```

### Example 9: Limit Total Results

```bash
# Get top 5 results across all repositories
/mcp__qdrant__federated_search ["/repo1", "/repo2", "/repo3"] "error handling" --limit 5
```

### Example 10: Microservices Investigation

**Scenario**: Finding how a feature is implemented across microservices

```bash
# Search all services for user management code
/mcp__qdrant__federated_search [
  "/services/user-service",
  "/services/auth-service",
  "/services/notification-service"
] "user profile update"

# Results show implementations across all services, ranked by relevance
```

### Example 11: Finding Best Practices

**Scenario**: Looking for error handling patterns across your organization

```bash
# Search across multiple projects
/mcp__qdrant__federated_search [
  "/projects/project-a",
  "/projects/project-b",
  "/projects/project-c"
] "error handling middleware" --searchType code --limit 10

# Review how different teams implement similar patterns
```

---

## Use Cases

### 1. Onboarding New Developers

```bash
# Help new developer understand authentication across the stack
/mcp__qdrant__contextual_search /workspace/main-app "user login flow"

# Then search related microservices
/mcp__qdrant__federated_search ["/services/auth", "/services/user", "/services/session"] "login"
```

### 2. Security Audit

```bash
# Find all security-related code and fixes
/mcp__qdrant__federated_search ["/repo1", "/repo2"] "security vulnerability" --searchType git
/mcp__qdrant__federated_search ["/repo1", "/repo2"] "authentication bypass" --searchType code
```

### 3. Migration Planning

```bash
# Understand what needs to change for a database migration
/mcp__qdrant__contextual_search /workspace/app "database connection"

# Check how other projects handled similar migrations
/mcp__qdrant__federated_search ["/other-projects/migrated-app"] "database migration"
```

### 4. Technical Debt Assessment

```bash
# Find TODO comments and related commit history
/mcp__qdrant__contextual_search /workspace/app "TODO fixme refactor"

# The correlations show when tech debt was introduced
```

### 5. Cross-Repository Refactoring

```bash
# Before refactoring a shared pattern, find all usages
/mcp__qdrant__federated_search ["/app1", "/app2", "/app3"] "deprecated API usage" --searchType code
```

---

## Understanding RRF Ranking

Federated search uses **Reciprocal Rank Fusion (RRF)** to combine results from different repositories and search types:

```
RRF Score = Σ(1 / (k + rank))  where k=60
```

This means:

- Results are ranked by position within each category (code/git per repo)
- The constant k=60 prevents any single high-ranking result from dominating
- Results that appear highly ranked in multiple categories score higher
- Fair comparison across repositories with different sizes

### Why RRF?

1. **Handles score incomparability**: Scores from different indexes may not be directly comparable
2. **Rewards consistency**: Results relevant across multiple sources rank higher
3. **Prevents dominance**: No single repository can dominate results
4. **Simple and effective**: Well-proven algorithm for result fusion

---

## Error Handling

### Index Not Found

```bash
# If you see this error:
# Error: Code index not found for "/path/to/repo". Run index_codebase first.

# Solution: Index the repository
/mcp__qdrant__index_codebase /path/to/repo
/mcp__qdrant__index_git_history /path/to/repo
```

### Partial Indexing

```bash
# Contextual search requires BOTH indexes
# If only code is indexed:
# Error: Git history index not found for "/path/to/repo". Run index_git_history first.

# Solution: Index git history
/mcp__qdrant__index_git_history /path/to/repo
```

### Federated Search Validation

```bash
# Federated search validates ALL repositories before searching
# If ANY repository is missing an index, it fails fast:
# Error: Index validation failed:
# Code index not found for "/repo2"
# Git history index not found for "/repo3"

# Solution: Index all repositories before federated search
```

---

## Performance Tips

1. **Use searchType wisely**: If you only need code, use `--searchType code` to skip git searches
2. **Limit results**: Use `--limit` to reduce the number of results when exploring
3. **Disable correlations**: Use `--correlate false` when you don't need file-commit linking
4. **Index incrementally**: Use `reindex_changes` and `index_new_commits` to keep indexes fresh
5. **Local embeddings**: Use Ollama for fastest multi-repository searches

---

## Next Steps

- Set up [custom prompts](../../prompts.example.json) for advanced search workflows
- Explore [code search](../code-search/) for single-repository deep dives
- Check [hybrid search](../hybrid-search/) for combining semantic and keyword search
