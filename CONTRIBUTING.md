# Contributing

Thank you for your interest in contributing!

## Getting Started

```bash
# 1. Fork and clone
git clone https://github.com/YOUR_USERNAME/qdrant-mcp-server.git
cd qdrant-mcp-server
npm install

# 2. Create feature branch
git checkout -b feat/your-feature-name

# 3. Make changes, add tests

# 4. Verify
npm test -- --run
npm run type-check
npm run build

# 5. Commit with conventional format
git commit -m "feat: add new feature"
```

## Development Commands

| Command | Purpose |
|---------|---------|
| `npm run build` | Build for production |
| `npm run dev` | Development with auto-reload |
| `npm test` | Run test suite |
| `npm run test:ui` | Tests with UI |
| `npm run test:coverage` | Coverage report |
| `npm run test:providers` | Provider verification |
| `npm run type-check` | TypeScript validation |

## Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/) for automated versioning and releases.

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

| Type | Description | Version Bump |
|------|-------------|--------------|
| `feat` | New feature | Minor (1.x.0) |
| `fix` | Bug fix | Patch (1.0.x) |
| `docs` | Documentation | Patch |
| `refactor` | Code refactoring | Patch |
| `perf` | Performance improvement | Patch |
| `test` | Adding/updating tests | None |
| `chore` | Build/dependencies | None |
| `ci` | CI/CD changes | None |
| `style` | Code style/formatting | None |

### Breaking Changes

Add `BREAKING CHANGE:` in body/footer or append `!` after type:

```bash
feat!: remove Node 16 support

BREAKING CHANGE: Node 16 is no longer supported
```

This triggers a major version bump (x.0.0).

### Examples

```bash
# Feature
feat(embeddings): add support for new provider

# Bug fix
fix(search): correct similarity score calculation

# Documentation
docs: update installation instructions

# Breaking change
feat!: change collection schema format
```

### Validation

Commitlint enforces:
- Conventional commits format required
- Valid type required
- Subject must not be empty or end with period
- Header max 100 characters
- Subject must not start with uppercase

## Pull Request Process

1. **Update docs** if needed
2. **Add tests** for changes
3. **Pass CI checks** (build, type-check, tests)
4. **Request review**
5. **Merge** after approval

### PR Title

Use conventional commit format:

```
feat: add new search feature
fix: resolve connection timeout
docs: improve setup documentation
```

## Release Process

Automated via [semantic-release](https://semantic-release.gitbook.io/):

- Releases on merge to `main`
- Version follows [Semantic Versioning](https://semver.org/)
- Changelog auto-generated from commits
- Packages published to npm

### Version Bumps

- `feat` → minor (1.x.0)
- `fix`, `perf`, `docs`, `refactor` → patch (1.0.x)
- `BREAKING CHANGE` → major (x.0.0)

## Testing

- Write tests for all new features and bug fixes
- Maintain or improve code coverage
- Run full test suite before submitting PRs
- Include both unit and integration tests

## Project Structure

```
qdrant-mcp-server/
├── src/              # Source code
├── build/            # Compiled output
├── scripts/          # Utility scripts
├── .github/          # GitHub Actions workflows
├── .husky/           # Git hooks
└── tests/            # Test files
```

## Questions?

Open an issue for discussion.

## License

By contributing, you agree your contributions will be licensed under the MIT License.
