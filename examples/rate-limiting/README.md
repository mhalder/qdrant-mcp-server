# Rate Limiting

Learn how the server handles embedding provider API rate limits automatically with intelligent throttling and retry mechanisms.

**Time:** 10-15 minutes | **Difficulty:** Beginner to Intermediate

## Why It Matters

| Provider             | Rate Limits     | Notes                           |
| -------------------- | --------------- | ------------------------------- |
| **Ollama** (default) | None            | Local processing, no limits!    |
| **OpenAI**           | 500-10,000+/min | Based on tier (Free/Tier 1/2/3) |
| **Cohere**           | ~100/min        | Varies by plan                  |
| **Voyage AI**        | ~300/min        | Varies by plan                  |

Without rate limiting, batch operations with cloud providers can fail. **This is why Ollama is the default** - no rate limits to worry about!

## How It Works

The server automatically:

1. **Throttles** - Queues API calls within limits
2. **Retries** - Exponential backoff (1s, 2s, 4s, 8s...)
3. **Respects Headers** - Follows provider retry guidance
4. **Provides Feedback** - Console shows retry progress

## Configuration

### Provider Defaults

| Provider  | Default Limit     | Retry Attempts | Retry Delay |
| --------- | ----------------- | -------------- | ----------- |
| Ollama    | 1000/min          | 3              | 500ms       |
| OpenAI    | 3500/min (Tier 1) | 3              | 1000ms      |
| Cohere    | 100/min           | 3              | 1000ms      |
| Voyage AI | 300/min           | 3              | 1000ms      |

### Custom Settings

```bash
# Adjust for your provider tier
EMBEDDING_MAX_REQUESTS_PER_MINUTE=500    # Free tier
EMBEDDING_RETRY_ATTEMPTS=5                # More resilient
EMBEDDING_RETRY_DELAY=2000                # Longer initial delay
```

### Provider Examples

**Ollama (Default):**

```bash
EMBEDDING_PROVIDER=ollama
EMBEDDING_BASE_URL=http://localhost:11434
# No rate limit config needed!
```

**OpenAI Free Tier:**

```bash
EMBEDDING_PROVIDER=openai
EMBEDDING_MAX_REQUESTS_PER_MINUTE=500
EMBEDDING_RETRY_ATTEMPTS=5
```

**OpenAI Paid Tier:**

```bash
EMBEDDING_PROVIDER=openai
EMBEDDING_MAX_REQUESTS_PER_MINUTE=3500  # Tier 1
```

## Example: Batch Processing

```
# Create collection
Create a collection named "rate-limit-test"

# Add batch of documents (tests rate limiting)
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

# Search
Search "rate-limit-test" for "neural networks and deep learning"

# Watch console for rate limit messages:
# "Rate limit reached. Retrying in 1.0s (attempt 1/3)..."
# "Rate limit reached. Retrying in 2.0s (attempt 2/3)..."

# Cleanup
Delete collection "rate-limit-test"
```

## Retry Behavior

### Exponential Backoff

With `EMBEDDING_RETRY_DELAY=1000`:

| Attempt | Delay | Total Wait |
| ------- | ----- | ---------- |
| 1st     | 1s    | 1s         |
| 2nd     | 2s    | 3s         |
| 3rd     | 4s    | 7s         |
| 4th     | 8s    | 15s        |

### Retry-After Header

If provider sends `Retry-After` header (OpenAI):

- Server uses exact delay
- Ignores exponential backoff
- Ensures optimal recovery

## Best Practices

1. **Match Your Tier** - Set `EMBEDDING_MAX_REQUESTS_PER_MINUTE` to your provider's limit
2. **Check Dashboards** - Verify limits at provider's dashboard
3. **Start Conservative** - Lower limits, increase if needed
4. **Monitor Console** - Watch for retry messages
5. **Use Ollama** - For unlimited local processing

### Batch Operation Tips

- **OpenAI**: Up to 2048 texts per request
- **Cohere**: Batch support available
- **Voyage AI**: Batch support available
- **Ollama**: Sequential processing (one at a time)

Server automatically uses batch APIs when available.

## Error Messages

```
# Success
Successfully added 10 document(s) to collection "rate-limit-test".

# Retry (Normal)
Rate limit reached. Retrying in 2.0s (attempt 1/3)...
# Action: None needed, automatic retry

# Max Retries Exceeded (Rare)
Error: API rate limit exceeded after 3 retry attempts.
# Action: Wait, reduce EMBEDDING_MAX_REQUESTS_PER_MINUTE, check dashboard
```

## Troubleshooting

| Issue                  | Solution                                           |
| ---------------------- | -------------------------------------------------- |
| Persistent rate limits | Reduce `EMBEDDING_MAX_REQUESTS_PER_MINUTE` by 20%  |
| Slow performance       | Expected with rate limiting - better than failures |
| Need faster processing | Upgrade provider tier or use Ollama                |

## Next

- [Knowledge Base](../knowledge-base/) - Real-world usage
- [Filters](../filters/) - Complex queries
- [Main README](../../README.md) - All configuration options
