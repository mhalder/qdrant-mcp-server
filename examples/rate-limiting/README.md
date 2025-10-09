# Rate Limiting Example

Learn how the Qdrant MCP Server handles embedding provider API rate limits automatically with intelligent throttling and retry mechanisms.

## Overview

This example demonstrates:

- How rate limiting prevents API failures
- Configuring rate limits for your OpenAI tier
- Batch operations with automatic throttling
- Exponential backoff retry behavior
- Monitoring rate limit events

**Time:** 10-15 minutes
**Difficulty:** Beginner to Intermediate

## Why Rate Limiting Matters

Embedding providers enforce rate limits based on your account tier:

**OpenAI:**
| Tier | Requests/Minute |
| ------- | --------------- |
| Free | 500 |
| Tier 1 | 3,500 |
| Tier 2 | 5,000 |
| Tier 3+ | 10,000+ |

**Other Providers:**

- **Cohere**: ~100 requests/minute (varies by plan)
- **Voyage AI**: ~300 requests/minute (varies by plan)
- **Ollama**: No API limits (local), limited by system resources

Without rate limiting, batch operations can exceed these limits and fail.

## How It Works

The server automatically:

1. **Throttles Requests**: Queues API calls to stay within limits
2. **Retries on Failure**: Uses exponential backoff (1s, 2s, 4s, 8s...)
3. **Respects Retry-After**: Follows provider retry guidance (when available)
4. **Provides Feedback**: Shows retry progress in console

## Configuration

### OpenAI Settings

**Default (Tier 1 Paid):**

```bash
EMBEDDING_PROVIDER=openai
EMBEDDING_MAX_REQUESTS_PER_MINUTE=3500
EMBEDDING_RETRY_ATTEMPTS=3
EMBEDDING_RETRY_DELAY=1000
```

**Free Tier:**

```bash
EMBEDDING_PROVIDER=openai
EMBEDDING_MAX_REQUESTS_PER_MINUTE=500
EMBEDDING_RETRY_ATTEMPTS=5
EMBEDDING_RETRY_DELAY=2000
```

### Cohere Settings

```bash
EMBEDDING_PROVIDER=cohere
EMBEDDING_MAX_REQUESTS_PER_MINUTE=100
EMBEDDING_RETRY_ATTEMPTS=3
EMBEDDING_RETRY_DELAY=1000
```

### Voyage AI Settings

```bash
EMBEDDING_PROVIDER=voyage
EMBEDDING_MAX_REQUESTS_PER_MINUTE=300
EMBEDDING_RETRY_ATTEMPTS=3
EMBEDDING_RETRY_DELAY=1000
```

### Ollama Settings (Local)

```bash
EMBEDDING_PROVIDER=ollama
EMBEDDING_MAX_REQUESTS_PER_MINUTE=1000
EMBEDDING_RETRY_ATTEMPTS=3
EMBEDDING_RETRY_DELAY=500
```

## Example: Batch Document Processing

Let's test rate limiting by adding many documents at once.

### Step 1: Create Collection

```
Create a collection named "rate-limit-test"
```

### Step 2: Add Batch of Documents

Try adding multiple documents in a single operation:

```
Add these documents to "rate-limit-test":
- id: 1, text: "Introduction to machine learning algorithms", metadata: {"topic": "ml"}
- id: 2, text: "Deep learning neural networks explained", metadata: {"topic": "dl"}
- id: 3, text: "Natural language processing fundamentals", metadata: {"topic": "nlp"}
- id: 4, text: "Computer vision and image recognition", metadata: {"topic": "cv"}
- id: 5, text: "Reinforcement learning strategies", metadata: {"topic": "rl"}
- id: 6, text: "Data preprocessing and feature engineering", metadata: {"topic": "data"}
- id: 7, text: "Model evaluation and validation techniques", metadata: {"topic": "eval"}
- id: 8, text: "Hyperparameter optimization methods", metadata: {"topic": "tuning"}
- id: 9, text: "Transfer learning and fine-tuning", metadata: {"topic": "transfer"}
- id: 10, text: "Ensemble methods and boosting", metadata: {"topic": "ensemble"}
```

**What happens:**

- The server generates embeddings for all 10 documents
- Requests are automatically queued and throttled
- If rate limits are hit, automatic retry with backoff occurs
- Console shows retry messages with wait times

### Step 3: Test Search

```
Search "rate-limit-test" for "neural networks and deep learning"
```

### Step 4: Monitor Console Output

Watch for rate limiting messages:

```
Rate limit reached. Retrying in 1.0s (attempt 1/3)...
Rate limit reached. Retrying in 2.0s (attempt 2/3)...
```

These messages indicate:

- Rate limit was detected (429 error)
- Automatic retry is in progress
- Current attempt number and delay

## Simulating Rate Limit Scenarios

### Scenario 1: Free Tier User

**Configuration:**

```bash
OPENAI_MAX_REQUESTS_PER_MINUTE=500
```

**Test:** Add 50 documents in batches of 10

- Server automatically spaces requests
- No manual rate limit handling needed
- Operations complete successfully

### Scenario 2: High-Volume Batch

**Test:** Add 100+ documents

- Create collection: `batch-test-collection`
- Add documents in chunks
- Server queues requests automatically
- Monitor console for throttling behavior

### Scenario 3: Concurrent Operations

**Test:** Multiple searches simultaneously

- Perform several searches in quick succession
- Rate limiter queues them appropriately
- All complete without errors

## Best Practices

### 1. Configure for Your Provider

Always set `EMBEDDING_MAX_REQUESTS_PER_MINUTE` to match your provider's limits:

**OpenAI:**

```bash
# Check your tier at: https://platform.openai.com/account/limits
EMBEDDING_MAX_REQUESTS_PER_MINUTE=<your-limit>
```

**Other Providers:**

- Check your provider's dashboard for rate limits
- Start conservative and increase if needed

### 2. Adjust Retry Settings for Reliability

For critical operations, increase retry attempts:

```bash
EMBEDDING_RETRY_ATTEMPTS=5  # More resilient
```

For development/testing, reduce retries:

```bash
EMBEDDING_RETRY_ATTEMPTS=1  # Fail faster
```

### 3. Batch Operations Wisely

Most embedding providers support batch operations:

- **OpenAI**: Up to 2048 texts per request
- **Cohere**: Batch support available
- **Voyage AI**: Batch support available
- **Ollama**: Sequential processing (one at a time)

The server automatically uses batch APIs when available for efficiency.

### 4. Monitor Your Usage

Watch console output during operations:

- No messages = smooth operation
- Retry messages = hitting limits (consider reducing rate)
- Error after max retries = need to reduce request volume

## Understanding Retry Behavior

### Exponential Backoff Example

With `OPENAI_RETRY_DELAY=1000`:

| Attempt | Delay | Total Wait |
| ------- | ----- | ---------- |
| 1st     | 1s    | 1s         |
| 2nd     | 2s    | 3s         |
| 3rd     | 4s    | 7s         |
| 4th     | 8s    | 15s        |

### Retry-After Header

If the provider provides a `Retry-After` header (OpenAI, some others):

- Server uses that exact delay
- Ignores exponential backoff
- Ensures optimal recovery

## Error Messages

### Success Messages

```
Successfully added 10 document(s) to collection "rate-limit-test".
```

### Retry Messages (Normal)

```
Rate limit reached. Retrying in 2.0s (attempt 1/3)...
```

**Action:** None needed, automatic retry in progress

### Max Retries Exceeded (Rare)

```
Error: [Provider] API rate limit exceeded after 3 retry attempts.
Please try again later or reduce request frequency.
```

**Action:**

- Wait a few minutes
- Reduce `EMBEDDING_MAX_REQUESTS_PER_MINUTE`
- Check your provider's dashboard for current usage

## Integration with Claude Code

The rate limiting works seamlessly with Claude Code. Example with OpenAI:

```json
{
  "mcpServers": {
    "qdrant": {
      "command": "node",
      "args": ["/path/to/qdrant-mcp-server/build/index.js"],
      "env": {
        "EMBEDDING_PROVIDER": "openai",
        "OPENAI_API_KEY": "sk-your-key",
        "QDRANT_URL": "http://localhost:6333",
        "EMBEDDING_MAX_REQUESTS_PER_MINUTE": "3500",
        "EMBEDDING_RETRY_ATTEMPTS": "3",
        "EMBEDDING_RETRY_DELAY": "1000"
      }
    }
  }
}
```

## Cleanup

```
Delete collection "rate-limit-test"
```

## Key Takeaways

1. ✅ **Automatic**: Rate limiting works out-of-the-box
2. ✅ **Configurable**: Adjust for your OpenAI tier
3. ✅ **Resilient**: Exponential backoff handles temporary issues
4. ✅ **Transparent**: Console feedback shows what's happening
5. ✅ **Efficient**: Batch operations optimize API usage

## Next Steps

- Explore [Knowledge Base example](../knowledge-base/) for real-world usage
- Learn [Advanced Filtering](../filters/) for complex queries
- Read [main README](../../README.md) for all configuration options

## Troubleshooting

### Still Getting Rate Limit Errors?

1. **Check your provider's limits**: Visit your provider's dashboard
2. **Reduce request rate**: Lower `EMBEDDING_MAX_REQUESTS_PER_MINUTE` by 20%
3. **Increase retry attempts**: Set `EMBEDDING_RETRY_ATTEMPTS=5`
4. **Wait between batches**: For very large operations, split into multiple sessions

### Slow Performance?

If operations seem slow:

- This is expected with rate limiting
- It's better than failed operations
- Upgrade your provider's tier for higher limits
- Consider using Ollama for unlimited local processing
