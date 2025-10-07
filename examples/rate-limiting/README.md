# Rate Limiting Example

Learn how the Qdrant MCP Server handles OpenAI API rate limits automatically with intelligent throttling and retry mechanisms.

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

OpenAI enforces rate limits based on your account tier:

| Tier    | Requests/Minute |
| ------- | --------------- |
| Free    | 500             |
| Tier 1  | 3,500           |
| Tier 2  | 5,000           |
| Tier 3+ | 10,000+         |

Without rate limiting, batch operations can exceed these limits and fail.

## How It Works

The server automatically:

1. **Throttles Requests**: Queues API calls to stay within limits
2. **Retries on Failure**: Uses exponential backoff (1s, 2s, 4s, 8s...)
3. **Respects Retry-After**: Follows OpenAI's retry guidance
4. **Provides Feedback**: Shows retry progress in console

## Configuration

### Default Settings (Tier 1 Paid)

```bash
OPENAI_MAX_REQUESTS_PER_MINUTE=3500
OPENAI_RETRY_ATTEMPTS=3
OPENAI_RETRY_DELAY=1000  # milliseconds
```

### Free Tier Configuration

If you're on the free tier, update your `.env`:

```bash
OPENAI_MAX_REQUESTS_PER_MINUTE=500
OPENAI_RETRY_ATTEMPTS=5
OPENAI_RETRY_DELAY=2000
```

### High-Volume Configuration (Tier 3+)

```bash
OPENAI_MAX_REQUESTS_PER_MINUTE=10000
OPENAI_RETRY_ATTEMPTS=3
OPENAI_RETRY_DELAY=500
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

### 1. Configure for Your Tier

Always set `OPENAI_MAX_REQUESTS_PER_MINUTE` to match your OpenAI account:

```bash
# Check your tier at: https://platform.openai.com/account/limits
OPENAI_MAX_REQUESTS_PER_MINUTE=<your-limit>
```

### 2. Adjust Retry Settings for Reliability

For critical operations, increase retry attempts:

```bash
OPENAI_RETRY_ATTEMPTS=5  # More resilient
```

For development/testing, reduce retries:

```bash
OPENAI_RETRY_ATTEMPTS=1  # Fail faster
```

### 3. Batch Operations Wisely

The OpenAI API supports batch embeddings (up to 2048 texts per request):

- Server automatically uses batch API when you add multiple documents
- More efficient than individual requests
- Still respects rate limits

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

If OpenAI provides a `Retry-After` header:

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
Error: OpenAI API rate limit exceeded after 3 retry attempts.
Please try again later or reduce request frequency.
```

**Action:**

- Wait a few minutes
- Reduce `OPENAI_MAX_REQUESTS_PER_MINUTE`
- Check OpenAI dashboard for current usage

## Integration with Claude Code

The rate limiting works seamlessly with Claude Code:

```json
{
  "mcpServers": {
    "qdrant": {
      "command": "node",
      "args": ["/path/to/qdrant-mcp-server/build/index.js"],
      "env": {
        "OPENAI_API_KEY": "sk-your-key",
        "QDRANT_URL": "http://localhost:6333",
        "OPENAI_MAX_REQUESTS_PER_MINUTE": "3500",
        "OPENAI_RETRY_ATTEMPTS": "3",
        "OPENAI_RETRY_DELAY": "1000"
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

1. **Check your OpenAI tier**: Visit https://platform.openai.com/account/limits
2. **Reduce request rate**: Lower `OPENAI_MAX_REQUESTS_PER_MINUTE` by 20%
3. **Increase retry attempts**: Set `OPENAI_RETRY_ATTEMPTS=5`
4. **Wait between batches**: For very large operations, split into multiple sessions

### Slow Performance?

If operations seem slow:

- This is expected with rate limiting
- It's better than failed operations
- Upgrade your OpenAI tier for higher limits
- Current tier limits displayed in OpenAI dashboard
