# Contributing

Thank you for your interest in contributing!

## Quick Start

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/qdrant-mcp-server.git
cd qdrant-mcp-server
npm install

# Create feature branch
git checkout -b feat/your-feature-name

# Make changes, then verify
npm test -- --run
npm run type-check
npm run build

# Commit with conventional format
git commit -m "feat: add new feature"
```

## Development Commands

| Command                 | Purpose              |
| ----------------------- | -------------------- |
| `npm run build`         | Build for production |
| `npm run dev`           | Dev with auto-reload |
| `npm test`              | Run test suite       |
| `npm run test:coverage` | Coverage report      |
| `npm run type-check`    | TypeScript check     |

## Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>
```

**Types:** `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`, `ci`

**Examples:**

```bash
feat(embeddings): add new provider
fix(search): correct score calculation
docs: update installation guide
feat!: breaking change (major version bump)
```

## Pull Requests

1. Add tests for changes
2. Update docs if needed
3. Pass CI checks (build, type-check, tests)
4. Use conventional commit format for PR title

## Releases

Automated via [semantic-release](https://semantic-release.gitbook.io/) on merge to `main`:

- `feat` → minor (1.x.0)
- `fix`, `docs`, `refactor`, `perf` → patch (1.0.x)
- `BREAKING CHANGE` or `!` → major (x.0.0)

## Questions?

Open an issue for discussion.

## License

By contributing, you agree your contributions will be licensed under the MIT License.
