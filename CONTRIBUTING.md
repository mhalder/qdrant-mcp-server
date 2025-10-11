# Contributing to qdrant-mcp-server

Thank you for your interest in contributing to qdrant-mcp-server! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

Please be respectful and constructive in your interactions with other contributors.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/qdrant-mcp-server.git`
3. Install dependencies: `npm install`
4. Create a branch for your changes: `git checkout -b feat/your-feature-name`

## Development Workflow

### Running the Project

```bash
# Build the project
npm run build

# Run in development mode
npm run dev

# Run tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Run provider verification tests
npm run test:providers

# Type check
npm run type-check
```

### Making Changes

1. Make your changes in your feature branch
2. Add tests for your changes
3. Ensure all tests pass: `npm test -- --run`
4. Ensure type checking passes: `npm run type-check`
5. Build the project: `npm run build`
6. Commit your changes using conventional commits (see below)

## Commit Message Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/) for commit messages. This enables automated versioning and changelog generation.

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Commit Types

- **feat**: A new feature (triggers minor version bump)
- **fix**: A bug fix (triggers patch version bump)
- **docs**: Documentation changes (triggers patch version bump)
- **style**: Code style changes (formatting, missing semicolons, etc.)
- **refactor**: Code refactoring without changing functionality (triggers patch version bump)
- **perf**: Performance improvements (triggers patch version bump)
- **test**: Adding or updating tests
- **chore**: Changes to build process, dependencies, etc.
- **ci**: Changes to CI/CD configuration
- **build**: Changes to build system

### Breaking Changes

For breaking changes, add `BREAKING CHANGE:` in the commit body or footer, or append `!` after the type:

```
feat!: remove support for Node 16

BREAKING CHANGE: Node 16 is no longer supported
```

### Examples

```bash
# Feature
feat(embeddings): add support for new embedding provider

# Bug fix
fix(search): correct similarity score calculation

# Documentation
docs: update installation instructions

# Breaking change
feat!: change collection schema format

BREAKING CHANGE: collection schema now requires version field
```

### Commit Message Validation

Commit messages are validated using commitlint. Invalid commit messages will be rejected. The validation enforces:

- Commit message must follow conventional commits format
- Type must be one of: feat, fix, docs, style, refactor, perf, test, chore, ci, build
- Subject must not be empty
- Subject must not end with a period
- Header must not exceed 100 characters
- Subject must not start with uppercase

## Pull Request Process

1. Update the README.md with details of changes if needed
2. Update tests to cover your changes
3. Ensure all CI checks pass
4. Request review from maintainers
5. Once approved, your PR will be merged

### PR Title

PR titles should also follow conventional commit format:

```
feat: add new search feature
fix: resolve connection timeout issue
docs: improve setup documentation
```

## Release Process

This project uses [semantic-release](https://semantic-release.gitbook.io/) for automated releases.

- Releases are automatically created when changes are merged to the `main` branch
- Version numbers follow [Semantic Versioning](https://semver.org/)
- Changelog is automatically generated from commit messages
- Packages are automatically published to npm

### Version Bumping

- `feat` commits → minor version bump (1.x.0)
- `fix`, `perf`, `docs`, `refactor` commits → patch version bump (1.0.x)
- Commits with `BREAKING CHANGE` → major version bump (x.0.0)

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

## Testing

- Write tests for all new features and bug fixes
- Maintain or improve code coverage
- Run the full test suite before submitting PRs
- Include both unit tests and integration tests where appropriate

## Questions?

If you have questions about contributing, please open an issue for discussion.

## License

By contributing to qdrant-mcp-server, you agree that your contributions will be licensed under the project's MIT License.
