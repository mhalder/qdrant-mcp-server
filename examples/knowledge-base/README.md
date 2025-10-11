# Knowledge Base

Build a searchable documentation system with rich metadata for filtering and organization.

**Time:** 15-20 minutes | **Difficulty:** Intermediate

## Use Case

Company knowledge base with:

- Documentation from multiple teams
- Content with varying topics and difficulty levels
- Searchable and filterable articles

## Setup

```
# Create collection
Create a collection named "company-kb"

# Add structured documents
Add these documents to company-kb:
- id: "eng-001", text: "Our API uses REST principles with JSON payloads. Authentication is handled via JWT tokens in the Authorization header.", metadata: {"team": "engineering", "topic": "api", "difficulty": "intermediate", "category": "technical"}
- id: "eng-002", text: "To deploy to production, merge your PR to main. The CI/CD pipeline automatically runs tests and deploys if all checks pass.", metadata: {"team": "engineering", "topic": "deployment", "difficulty": "beginner", "category": "process"}
- id: "hr-001", text: "New employees receive benefits information during onboarding. Health insurance enrollment must be completed within 30 days.", metadata: {"team": "hr", "topic": "benefits", "difficulty": "beginner", "category": "policy"}
- id: "hr-002", text: "Performance reviews occur quarterly. Managers should prepare feedback and schedule 1-on-1 meetings two weeks in advance.", metadata: {"team": "hr", "topic": "performance", "difficulty": "beginner", "category": "process"}
- id: "sales-001", text: "Our enterprise pricing model includes volume discounts for contracts over $100k annually. Custom SLAs are available.", metadata: {"team": "sales", "topic": "pricing", "difficulty": "advanced", "category": "business"}
- id: "sales-002", text: "The sales pipeline has four stages: Lead, Qualified, Proposal, and Closed. Update Salesforce after each customer interaction.", metadata: {"team": "sales", "topic": "pipeline", "difficulty": "beginner", "category": "process"}
```

## Search Examples

```
# Basic search
Search company-kb for "how do I deploy code"

# Filter by team
Search company-kb for "process documentation" with filter {"must": [{"key": "team", "match": {"value": "engineering"}}]}

# Filter by difficulty
Search company-kb for "getting started" with filter {"must": [{"key": "difficulty", "match": {"value": "beginner"}}]}

# Multiple filters (AND)
Search company-kb for "company procedures" with filter {"must": [{"key": "category", "match": {"value": "process"}}, {"key": "difficulty", "match": {"value": "beginner"}}]}

# Filter by topic
Search company-kb for "pricing information" with filter {"must": [{"key": "team", "match": {"value": "sales"}}]}
```

## Metadata Design

### Schema Pattern

```json
{
  "team": "string",
  "topic": "string",
  "difficulty": "beginner|intermediate|advanced",
  "category": "technical|process|policy|business"
}
```

### Advanced Patterns

**Hierarchical:**

```json
{
  "team": "engineering",
  "subteam": "backend",
  "topic": "api",
  "subtopic": "authentication"
}
```

**Multi-category:**

```json
{
  "tags": ["api", "security", "authentication"],
  "relevant_teams": ["engineering", "security"]
}
```

**Versioned:**

```json
{
  "created_at": "2024-01-15",
  "updated_at": "2024-03-20",
  "version": "2.1",
  "status": "published"
}
```

**Access Control:**

```json
{
  "visibility": "public|internal|confidential",
  "authorized_teams": ["engineering", "leadership"]
}
```

## Scaling

### Content Types

- Code examples with language tags
- Video transcripts with duration
- Meeting notes with attendees/dates
- Product specs with versions

### Maintenance

**Update documents:**

```
Delete documents ["eng-001"] from company-kb
Add these documents to company-kb:
- id: "eng-001", text: "Updated content...", metadata: {...}
```

**Archive old content:**

```json
{ "status": "archived", "archived_date": "2024-12-01" }
```

Then filter searches:

```
Search company-kb for "deployment" with filter {"must_not": [{"key": "status", "match": {"value": "archived"}}]}
```

## Cleanup

```
Delete collection "company-kb"
```

## Next Steps

- Explore [Advanced Filtering](../filters/) for complex filter patterns
- Review [main README](../../README.md) for batch operations and advanced features
