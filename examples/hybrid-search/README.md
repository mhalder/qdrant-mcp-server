# Hybrid Search

Combine semantic vector search with keyword (BM25) search for more accurate and comprehensive results.

**Time:** 15-20 minutes | **Difficulty:** Intermediate

## What is Hybrid Search?

Hybrid search combines two search approaches:

1. **Semantic Search**: Understands meaning and context using vector embeddings
2. **Keyword Search**: Exact term matching using BM25 sparse vectors

The results are merged using **Reciprocal Rank Fusion (RRF)**, which combines rankings from both methods to produce the best overall results.

## When to Use Hybrid Search

Hybrid search is ideal for:

- **Technical documentation**: Users search for exact function names + concepts
- **Product search**: Match SKUs/model numbers + descriptions
- **Legal documents**: Exact citations + semantic context
- **Code search**: Function names + natural language descriptions
- **Mixed queries**: "authentication JWT" (semantic + exact keyword)

## Benefits

- **Best of both worlds**: Precision (keyword) + recall (semantic)
- **Better results for ambiguous queries**
- **Handles typos** (semantic) and **exact matches** (keyword)
- **More control** over result relevance

## Workflow

### 1. Create a Collection with Hybrid Search Enabled

```
Create a collection named "technical_docs" with Cosine distance and enableHybrid set to true
```

**Important**: Set `enableHybrid: true` to enable hybrid search capabilities.

### 2. Add Documents

Documents are automatically indexed for both semantic and keyword search:

```
Add these documents to technical_docs:
- id: 1, text: "The authenticateUser function validates JWT tokens for user sessions",
  metadata: {"category": "authentication", "type": "function"}
- id: 2, text: "JWT (JSON Web Token) is a compact URL-safe means of representing claims",
  metadata: {"category": "authentication", "type": "definition"}
- id: 3, text: "OAuth2 provides authorization framework for third-party applications",
  metadata: {"category": "authentication", "type": "protocol"}
- id: 4, text: "The login endpoint requires username and password credentials",
  metadata: {"category": "authentication", "type": "endpoint"}
```

### 3. Perform Hybrid Search

Search using both semantic understanding and keyword matching:

```
Search technical_docs for "JWT authentication function" with limit 3 using hybrid_search
```

**Result**: Documents are ranked by combining:

- Semantic similarity to "authentication function"
- Exact keyword matches for "JWT"

### 4. Hybrid Search with Filters

Combine hybrid search with metadata filtering:

```
Search technical_docs for "JWT token validation" with limit 2 and filter {"type": "function"} using hybrid_search
```

## Comparison: Semantic vs Hybrid Search

### Semantic Search Only

```
Search technical_docs for "JWT authentication" with limit 3 using semantic_search
```

**Result**: May miss documents with exact "JWT" match if they're not semantically similar.

### Hybrid Search

```
Search technical_docs for "JWT authentication" with limit 3 using hybrid_search
```

**Result**: Finds both:

- Documents semantically related to authentication
- Documents with exact "JWT" keyword match
- Best combination ranked by RRF

## Example Scenarios

### Scenario 1: Exact Term + Context

**Query**: "authenticateUser JWT"

**Hybrid Search finds**:

1. Documents with `authenticateUser` function name (keyword match)
2. Documents about JWT authentication (semantic match)
3. Best combination of both

**Pure semantic search might miss**: Exact function name if using different terminology.

### Scenario 2: Acronym + Description

**Query**: "API rate limiting"

**Hybrid Search finds**:

1. Documents with "API" acronym (keyword match)
2. Documents about rate limiting concepts (semantic match)
3. Documents mentioning "API rate limiting" get highest score

### Scenario 3: Typos + Exact Terms

**Query**: "OAuth2 authentification"

**Hybrid Search finds**:

1. "OAuth2" exact matches (keyword - ignores typo in other term)
2. Authentication concepts (semantic - understands "authentification" ≈ "authentication")

## Technical Details

### How It Works

1. **Dense Vector Generation**: Your query is embedded using the configured embedding provider (Ollama, OpenAI, etc.)
2. **Sparse Vector Generation**: Query is tokenized and BM25 scores are calculated
3. **Parallel Search**: Both vectors are searched simultaneously
4. **Result Fusion**: RRF combines rankings from both searches
5. **Final Ranking**: Merged results with combined relevance scores

### BM25 Sparse Vectors

The server uses a lightweight BM25 implementation for sparse vectors:

- Tokenization: Lowercase + whitespace splitting
- IDF scoring: Inverse document frequency
- Configurable parameters: k1=1.2, b=0.75

### Reciprocal Rank Fusion (RRF)

RRF formula: `score = Σ(1 / (k + rank))` where k=60 (default)

Benefits:

- No score normalization needed
- Robust to differences in score scales
- Works well for combining different ranking methods

## Best Practices

1. **Enable hybrid for technical content**: Use when exact terms matter
2. **Use semantic for general content**: Natural language queries without technical terms
3. **Combine with filters**: Narrow down results by category or type
4. **Test both approaches**: Compare semantic vs hybrid for your use case
5. **Monitor performance**: Hybrid search requires more computation

## Performance Considerations

- **Storage**: Hybrid collections require more space (dense + sparse vectors)
- **Indexing**: Document indexing is slightly slower
- **Query time**: Hybrid search performs two searches and fusion
- **Scalability**: Qdrant optimizes both vector types efficiently

## Try It

Practice hybrid search with your own example:

```
Create a collection named "my-hybrid-docs" with Cosine distance and enableHybrid set to true

Add these documents to my-hybrid-docs:
- id: "doc1", text: "The calculateTax function computes sales tax based on location and product type", metadata: {"category": "finance", "type": "function"}
- id: "doc2", text: "Tax calculation involves applying regional rates and exemptions", metadata: {"category": "finance", "type": "concept"}
- id: "doc3", text: "The generateInvoice method creates PDF invoices with itemized charges", metadata: {"category": "billing", "type": "function"}
- id: "doc4", text: "Invoice generation includes customer details, line items, and payment terms", metadata: {"category": "billing", "type": "concept"}

Search my-hybrid-docs for "calculateTax invoice" with limit 3 using hybrid_search

Search my-hybrid-docs for "tax calculation" with limit 2 using semantic_search

# Compare the results - notice how hybrid search finds both exact function names and concepts

Delete collection "my-hybrid-docs"
```

## Troubleshooting

### "Collection does not have hybrid search enabled"

**Solution**: Create a new collection with `enableHybrid: true`. Existing collections cannot be converted.

### Poor results with hybrid search

**Try**:

1. Adjust query phrasing to include key terms
2. Use metadata filters to narrow scope
3. Increase `limit` to see more results
4. Compare with pure semantic search

### Slow query performance

**Solutions**:

1. Reduce prefetch limit (contact support for tuning)
2. Add filters to narrow search space
3. Use fewer documents or partition data

## Cleanup

```
Delete collection "technical_docs"
```

## Next Steps

Continue learning with these examples:

- **[Knowledge Base](../knowledge-base/)** - Searchable documentation with metadata
- **[Advanced Filtering](../filters/)** - Complex search queries
- **[Rate Limiting](../rate-limiting/)** - Batch processing patterns
- **[Basic Usage](../basic/)** - Fundamental operations
