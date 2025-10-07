# Advanced Filtering Examples

This example demonstrates powerful metadata filtering capabilities using Qdrant's filter syntax.

## What You'll Learn

- Complex boolean logic (AND, OR, NOT)
- Range filters for numeric values
- Combining multiple filter conditions
- Real-world filtering scenarios

## Setup

Create a collection with sample e-commerce data:

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

### 1. Simple Match Filter (AND)

Find electronics products:

```
Search products for "device for music" with filter {"must": [{"key": "category", "match": {"value": "electronics"}}]}
```

Expected: Returns p1, p4, p6 (all electronics)

### 2. Multiple Conditions (AND)

Find in-stock electronics:

```
Search products for "gadgets" with filter {"must": [{"key": "category", "match": {"value": "electronics"}}, {"key": "in_stock", "match": {"value": true}}]}
```

Expected: Returns p1, p4, p6 (in-stock electronics only)

### 3. OR Logic with Should

Find either sports or accessories:

```
Search products for "gear" with filter {"should": [{"key": "category", "match": {"value": "sports"}}, {"key": "category", "match": {"value": "accessories"}}]}
```

Expected: Returns p3, p5, p7, p8 (sports OR accessories)

### 4. Negation with Must Not

Find everything except clothing:

```
Search products for "shopping" with filter {"must_not": [{"key": "category", "match": {"value": "clothing"}}]}
```

Expected: Returns all products except p2

### 5. Range Filter - Greater Than

**Note:** Range filters require Qdrant's range condition syntax. The current implementation supports match filters. For range queries, you would need to use Qdrant's native range syntax:

Conceptual example (not yet implemented in MCP server):

```json
{
  "must": [
    {
      "key": "price",
      "range": {
        "gt": 100.0
      }
    }
  ]
}
```

### 6. Complex Boolean Logic

Find in-stock products that are either:

- Electronics with rating > 4.5, OR
- Sports items under $50

```
Search products for "quality products" with filter {"must": [{"key": "in_stock", "match": {"value": true}}], "should": [{"key": "category", "match": {"value": "electronics"}}, {"key": "category", "match": {"value": "sports"}}]}
```

### 7. Combining Multiple Must Conditions

Find highly-rated in-stock electronics:

```
Search products for "best gadgets" with filter {"must": [{"key": "category", "match": {"value": "electronics"}}, {"key": "in_stock", "match": {"value": true}}, {"key": "rating", "match": {"value": 4.5}}]}
```

Note: Exact match on rating. For range queries, use Qdrant's range filter syntax.

### 8. Brand Filtering

Find AudioTech products:

```
Search products for "audio equipment" with filter {"must": [{"key": "brand", "match": {"value": "AudioTech"}}]}
```

Expected: Returns p1 only

### 9. Out of Stock Products

Find what needs restocking:

```
Search products for "items" with filter {"must": [{"key": "in_stock", "match": {"value": false}}]}
```

Expected: Returns p3, p7 (out of stock items)

### 10. Category Exclusion with Multiple Conditions

Find non-electronic in-stock items:

```
Search products for "shopping" with filter {"must": [{"key": "in_stock", "match": {"value": true}}], "must_not": [{"key": "category", "match": {"value": "electronics"}}]}
```

Expected: Returns p2, p5, p8 (in-stock, non-electronics)

## Filter Syntax Reference

### Structure

```json
{
  "must": [], // AND - all conditions must be true
  "should": [], // OR - at least one condition must be true
  "must_not": [] // NOT - conditions must be false
}
```

### Match Filter

Exact value matching:

```json
{
  "key": "field_name",
  "match": {
    "value": "exact_value"
  }
}
```

Works with:

- Strings: `"value": "electronics"`
- Numbers: `"value": 4.5`
- Booleans: `"value": true`

### Range Filter (Qdrant Native)

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

### E-commerce Product Search

"Show me affordable fitness equipment"

```
Search products for "fitness equipment" with filter {"must": [{"key": "category", "match": {"value": "sports"}}, {"key": "in_stock", "match": {"value": true}}]}
```

### Inventory Management

"Which electronics need restocking?"

```
Search products for "electronics" with filter {"must": [{"key": "category", "match": {"value": "electronics"}}, {"key": "in_stock", "match": {"value": false}}]}
```

### Quality Control

"Show me all highly-rated available products"

```
Search products for "top rated products" with filter {"must": [{"key": "in_stock", "match": {"value": true}}]}
```

## Limitations and Workarounds

### Current Limitations

1. **No native range filters**: Can't directly filter by price ranges like "between $50-$100"
2. **No text search on metadata**: Metadata matching is exact, not fuzzy
3. **No nested object queries**: Flat metadata structure only

### Workarounds

1. **Price ranges**: Add price_tier to metadata:

   ```json
   {"price_tier": "budget", "price": 29.99}  // budget: <$50
   {"price_tier": "mid", "price": 149.99}    // mid: $50-$200
   {"price_tier": "premium", "price": 299.99} // premium: >$200
   ```

2. **Multiple categories**: Use array-based tags:

   ```json
   { "tags": ["electronics", "wearable", "fitness"] }
   ```

3. **Date filtering**: Store dates as strings in comparable format:
   ```json
   { "created_date": "2024-03-15" } // YYYY-MM-DD for lexicographic comparison
   ```

## Best Practices

1. **Keep metadata flat**: Avoid deep nesting for better filter performance
2. **Use consistent types**: Don't mix strings and numbers for the same field
3. **Index commonly filtered fields**: Design metadata around common queries
4. **Test filters first**: Validate filter syntax before complex queries
5. **Combine with semantic search**: Use filters to narrow, then semantic search to rank

## Clean Up

```
Delete collection "products"
```

## Next Steps

- Review [Qdrant filtering documentation](https://qdrant.tech/documentation/concepts/filtering/)
- Explore the [Knowledge Base Example](../knowledge-base/) for organizational patterns
- Check the main README for full filter syntax support
