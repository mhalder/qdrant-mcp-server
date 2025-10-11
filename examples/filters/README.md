# Advanced Filtering

Master complex metadata filtering with boolean logic for powerful search refinement.

**Time:** 20-30 minutes | **Difficulty:** Intermediate to Advanced

## Setup

```
Create a collection named "products"

Add these documents to products:
- id: "p1", text: "Wireless Bluetooth headphones with noise cancellation and 30-hour battery life", metadata: {"category": "electronics", "price": 199.99, "rating": 4.5, "in_stock": true, "brand": "AudioTech"}
- id: "p2", text: "Organic cotton t-shirt, comfortable fit, available in multiple colors", metadata: {"category": "clothing", "price": 29.99, "rating": 4.2, "in_stock": true, "brand": "EcoWear"}
- id: "p3", text: "Stainless steel water bottle, insulated, keeps drinks cold for 24 hours", metadata: {"category": "accessories", "price": 34.99, "rating": 4.8, "in_stock": false, "brand": "HydroFlow"}
- id: "p4", text: "Mechanical keyboard with RGB lighting and customizable switches", metadata: {"category": "electronics", "price": 149.99, "rating": 4.6, "in_stock": true, "brand": "KeyMaster"}
- id: "p5", text: "Yoga mat with excellent grip, eco-friendly materials, includes carrying strap", metadata: {"category": "sports", "price": 39.99, "rating": 4.7, "in_stock": true, "brand": "FlexFit"}
- id: "p6", text: "Smart watch with fitness tracking, heart rate monitor, and GPS", metadata: {"category": "electronics", "price": 299.99, "rating": 4.3, "in_stock": true, "brand": "TechTime"}
- id: "p7", text: "Running shoes with responsive cushioning and breathable mesh upper", metadata: {"category": "sports", "price": 89.99, "rating": 4.4, "in_stock": false, "brand": "SpeedFoot"}
- id: "p8", text: "Leather laptop bag with padded compartments and adjustable shoulder strap", metadata: {"category": "accessories", "price": 79.99, "rating": 4.5, "in_stock": true, "brand": "ProCarry"}
```

## Filter Examples

### Basic Filters

```
# Match single category
Search products for "device for music" with filter {"must": [{"key": "category", "match": {"value": "electronics"}}]}
# Returns: p1, p4, p6

# Multiple conditions (AND)
Search products for "gadgets" with filter {"must": [{"key": "category", "match": {"value": "electronics"}}, {"key": "in_stock", "match": {"value": true}}]}
# Returns: p1, p4, p6 (in-stock electronics)

# OR logic
Search products for "gear" with filter {"should": [{"key": "category", "match": {"value": "sports"}}, {"key": "category", "match": {"value": "accessories"}}]}
# Returns: p3, p5, p7, p8

# NOT logic
Search products for "shopping" with filter {"must_not": [{"key": "category", "match": {"value": "clothing"}}]}
# Returns: All except p2
```

### Complex Combinations

```
# In-stock products (electronics OR sports)
Search products for "quality products" with filter {"must": [{"key": "in_stock", "match": {"value": true}}], "should": [{"key": "category", "match": {"value": "electronics"}}, {"key": "category", "match": {"value": "sports"}}]}

# Non-electronic in-stock items
Search products for "shopping" with filter {"must": [{"key": "in_stock", "match": {"value": true}}], "must_not": [{"key": "category", "match": {"value": "electronics"}}]}
# Returns: p2, p5, p8

# Out of stock items
Search products for "items" with filter {"must": [{"key": "in_stock", "match": {"value": false}}]}
# Returns: p3, p7

# Brand filtering
Search products for "audio equipment" with filter {"must": [{"key": "brand", "match": {"value": "AudioTech"}}]}
# Returns: p1 only
```

## Filter Syntax

### Structure

```json
{
  "must": [], // AND - all conditions must be true
  "should": [], // OR - at least one condition must be true
  "must_not": [] // NOT - conditions must be false
}
```

### Match Filter

```json
{
  "key": "field_name",
  "match": {
    "value": "exact_value" // Works with strings, numbers, booleans
  }
}
```

### Range Filters (Native Qdrant)

For numeric comparisons (future enhancement):

```json
{
  "key": "price",
  "range": {
    "gt": 50, // greater than
    "gte": 50, // greater than or equal
    "lt": 200, // less than
    "lte": 200 // less than or equal
  }
}
```

## Real-World Scenarios

```
# E-commerce: affordable fitness equipment
Search products for "fitness equipment" with filter {"must": [{"key": "category", "match": {"value": "sports"}}, {"key": "in_stock", "match": {"value": true}}]}

# Inventory: electronics needing restock
Search products for "electronics" with filter {"must": [{"key": "category", "match": {"value": "electronics"}}, {"key": "in_stock", "match": {"value": false}}]}

# Quality control: highly-rated available products
Search products for "top rated products" with filter {"must": [{"key": "in_stock", "match": {"value": true}}]}
```

## Workarounds

### Price Ranges

Add `price_tier` to metadata:

```json
{"price_tier": "budget", "price": 29.99}    // <$50
{"price_tier": "mid", "price": 149.99}      // $50-$200
{"price_tier": "premium", "price": 299.99}  // >$200
```

### Multiple Categories

Use array-based tags:

```json
{ "tags": ["electronics", "wearable", "fitness"] }
```

### Date Filtering

Use comparable string format:

```json
{ "created_date": "2024-03-15" } // YYYY-MM-DD
```

## Best Practices

1. **Flat metadata** - Avoid deep nesting
2. **Consistent types** - Don't mix strings/numbers for same field
3. **Index common fields** - Design around frequent queries
4. **Test filters first** - Validate syntax before complex queries
5. **Combine with search** - Use filters to narrow, semantic search to rank

## Cleanup

```
Delete collection "products"
```

## Next Steps

- Review [Qdrant filtering documentation](https://qdrant.tech/documentation/concepts/filtering/)
- Explore [Knowledge Base](../knowledge-base/) example for organizational patterns
- See [main README](../../README.md) for complete filter syntax reference
