# Knowledge Base Example

This example shows how to build a searchable documentation system with rich metadata for organization and filtering.

## Use Case

You're building a company knowledge base with:

- Documentation from multiple teams
- Articles with different topics and difficulty levels
- Content that needs to be searchable and filterable

## What You'll Learn

- Organizing documents with metadata
- Using metadata for categorization
- Filtering searches by metadata fields
- Building a scalable knowledge base structure

## Setup

### 1. Create the Collection

```
Create a collection named "company-kb"
```

### 2. Add Structured Documents

```
Add these documents to company-kb:
- id: "eng-001", text: "Our API uses REST principles with JSON payloads. Authentication is handled via JWT tokens in the Authorization header.", metadata: {"team": "engineering", "topic": "api", "difficulty": "intermediate", "category": "technical"}
- id: "eng-002", text: "To deploy to production, merge your PR to main. The CI/CD pipeline automatically runs tests and deploys if all checks pass.", metadata: {"team": "engineering", "topic": "deployment", "difficulty": "beginner", "category": "process"}
- id: "hr-001", text: "New employees receive benefits information during onboarding. Health insurance enrollment must be completed within 30 days.", metadata: {"team": "hr", "topic": "benefits", "difficulty": "beginner", "category": "policy"}
- id: "hr-002", text: "Performance reviews occur quarterly. Managers should prepare feedback and schedule 1-on-1 meetings two weeks in advance.", metadata: {"team": "hr", "topic": "performance", "difficulty": "beginner", "category": "process"}
- id: "sales-001", text: "Our enterprise pricing model includes volume discounts for contracts over $100k annually. Custom SLAs are available.", metadata: {"team": "sales", "topic": "pricing", "difficulty": "advanced", "category": "business"}
- id: "sales-002", text: "The sales pipeline has four stages: Lead, Qualified, Proposal, and Closed. Update Salesforce after each customer interaction.", metadata: {"team": "sales", "topic": "pipeline", "difficulty": "beginner", "category": "process"}
```

## Search Examples

### Basic Search (No Filters)

```
Search company-kb for "how do I deploy code"
```

Expected: Returns deployment-related docs (eng-002 likely ranks highest)

### Filter by Team

```
Search company-kb for "process documentation" with filter {"must": [{"key": "team", "match": {"value": "engineering"}}]}
```

Returns only engineering team documents.

### Filter by Difficulty

```
Search company-kb for "getting started" with filter {"must": [{"key": "difficulty", "match": {"value": "beginner"}}]}
```

Returns beginner-friendly documentation.

### Multiple Filters (AND)

```
Search company-kb for "company procedures" with filter {"must": [{"key": "category", "match": {"value": "process"}}, {"key": "difficulty", "match": {"value": "beginner"}}]}
```

Returns beginner process documents only.

### Filter by Topic

```
Search company-kb for "pricing information" with filter {"must": [{"key": "team", "match": {"value": "sales"}}]}
```

Restricts search to sales team content.

## Metadata Design Best Practices

### 1. Consistent Schema

Use the same metadata fields across all documents:

```json
{
  "team": "string",
  "topic": "string",
  "difficulty": "beginner|intermediate|advanced",
  "category": "technical|process|policy|business"
}
```

### 2. Hierarchical Organization

Consider nesting metadata for complex taxonomies:

```json
{
  "team": "engineering",
  "subteam": "backend",
  "topic": "api",
  "subtopic": "authentication"
}
```

### 3. Multiple Tags

Use arrays for multi-category documents:

```json
{
  "tags": ["api", "security", "authentication"],
  "relevant_teams": ["engineering", "security"]
}
```

### 4. Timestamps and Versioning

Track freshness and versions:

```json
{
  "created_at": "2024-01-15",
  "updated_at": "2024-03-20",
  "version": "2.1",
  "status": "published"
}
```

## Scaling Your Knowledge Base

### Add More Content Types

- Code examples with language tags
- Video transcripts with duration metadata
- Meeting notes with attendees and dates
- Product specs with version numbers

### Implement Access Control

Use metadata for permissions:

```json
{
  "visibility": "public|internal|confidential",
  "authorized_teams": ["engineering", "leadership"]
}
```

Then filter searches based on user permissions.

### Track Usage

Add metadata for analytics:

```json
{
  "views": 0,
  "last_accessed": null,
  "author": "user@company.com"
}
```

## Maintenance

### Update Documents

To update content, delete and re-add:

```
Delete documents ["eng-001"] from company-kb

Add these documents to company-kb:
- id: "eng-001", text: "Updated API documentation...", metadata: {...}
```

### Archive Old Content

Use status metadata to hide outdated docs:

```json
{
  "status": "archived",
  "archived_date": "2024-12-01"
}
```

Then filter searches to exclude archived content:

```
Search company-kb for "deployment" with filter {"must_not": [{"key": "status", "match": {"value": "archived"}}]}
```

## Clean Up

```
Delete collection "company-kb"
```

## Next Steps

- [Advanced Filtering Examples](../filters/) - Learn complex filter patterns
- See the main README for information on batch document operations
