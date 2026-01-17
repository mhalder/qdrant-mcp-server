## <small>2.1.1 (2026-01-17)</small>

* Merge pull request #43 from mhalder/feat/mcpserver-migration ([48ac95b](https://github.com/mhalder/qdrant-mcp-server/commit/48ac95b)), closes [#43](https://github.com/mhalder/qdrant-mcp-server/issues/43)
* fix: address PR review feedback for type safety and docs ([608100d](https://github.com/mhalder/qdrant-mcp-server/commit/608100d))
* refactor: migrate from Server to McpServer API ([1315104](https://github.com/mhalder/qdrant-mcp-server/commit/1315104))

## 2.1.0 (2026-01-17)

* Merge pull request #42 from mhalder/feat/configurable-http-timeout ([15a5a5a](https://github.com/mhalder/qdrant-mcp-server/commit/15a5a5a)), closes [#42](https://github.com/mhalder/qdrant-mcp-server/issues/42)
* fix: add validation for HTTP_REQUEST_TIMEOUT_MS environment variable ([fdc169f](https://github.com/mhalder/qdrant-mcp-server/commit/fdc169f))
* feat: make HTTP request timeout configurable via environment variable ([09528e3](https://github.com/mhalder/qdrant-mcp-server/commit/09528e3))

## 2.0.0 (2026-01-17)

* build!: update dependencies and migrate to Podman ([bef9119](https://github.com/mhalder/qdrant-mcp-server/commit/bef9119))
* Merge pull request #41 from mhalder/chore/full-update-2026 ([ccfbd97](https://github.com/mhalder/qdrant-mcp-server/commit/ccfbd97)), closes [#41](https://github.com/mhalder/qdrant-mcp-server/issues/41)
* fix: add SELinux context labels to Podman volume mounts ([a9a0fb9](https://github.com/mhalder/qdrant-mcp-server/commit/a9a0fb9))


### BREAKING CHANGE

* Node.js minimum version changed from 20 to 22.

- Update all dependencies to latest versions:
  - @modelcontextprotocol/sdk 1.0.4 → 1.25.2
  - @qdrant/js-client-rest 1.12.0 → 1.16.2
  - vitest 2.1.8 → 4.0.17
  - semantic-release 24.2.9 → 25.0.2
  - openai, cohere-ai, zod, and others
- Set Node.js minimum to 22.x (engines field + .nvmrc)
- Migrate docker-compose.yml to compose.yaml with Podman support
- Update tsconfig to ES2023/NodeNext
- Simplify CI workflow to Node 22 only
- Fix test mocking patterns for Vitest 4 compatibility
- Update documentation with Podman commands and correct test counts

## 1.6.0 (2026-01-17)

* Merge pull request #34 from No-Smoke/feature/add-qdrant-api-key-support ([c6af3ae](https://github.com/mhalder/qdrant-mcp-server/commit/c6af3ae)), closes [#34](https://github.com/mhalder/qdrant-mcp-server/issues/34)
* Merge pull request #37 from mhalder/fix/trusted-publishing-and-workflows ([e6a464d](https://github.com/mhalder/qdrant-mcp-server/commit/e6a464d)), closes [#37](https://github.com/mhalder/qdrant-mcp-server/issues/37)
* Merge pull request #38 from mhalder/fix/npm-provenance-publishing ([53dce5f](https://github.com/mhalder/qdrant-mcp-server/commit/53dce5f)), closes [#38](https://github.com/mhalder/qdrant-mcp-server/issues/38)
* Merge pull request #39 from mhalder/fix/add-npm-token-for-verification ([aaa32c1](https://github.com/mhalder/qdrant-mcp-server/commit/aaa32c1)), closes [#39](https://github.com/mhalder/qdrant-mcp-server/issues/39)
* Merge pull request #40 from mhalder/fix/remove-registry-url-from-setup-node ([f507b1b](https://github.com/mhalder/qdrant-mcp-server/commit/f507b1b)), closes [#40](https://github.com/mhalder/qdrant-mcp-server/issues/40)
* ci: add NPM_TOKEN for semantic-release verification ([19f746d](https://github.com/mhalder/qdrant-mcp-server/commit/19f746d))
* ci: enable npm provenance for OIDC trusted publishing ([2e18bea](https://github.com/mhalder/qdrant-mcp-server/commit/2e18bea))
* ci: remove registry-url from setup-node ([4e7d496](https://github.com/mhalder/qdrant-mcp-server/commit/4e7d496))
* ci: switch to npm trusted publishing and fix workflow permissions ([93ee2ba](https://github.com/mhalder/qdrant-mcp-server/commit/93ee2ba))
* test: add constructor tests for apiKey parameter ([aa497b0](https://github.com/mhalder/qdrant-mcp-server/commit/aa497b0))
* docs: Add QDRANT_API_KEY documentation ([f5dd238](https://github.com/mhalder/qdrant-mcp-server/commit/f5dd238))
* feat: Add QDRANT_API_KEY support to QdrantManager ([ae7b3b2](https://github.com/mhalder/qdrant-mcp-server/commit/ae7b3b2))
* feat: Read QDRANT_API_KEY from environment and pass to QdrantManager ([1b3a263](https://github.com/mhalder/qdrant-mcp-server/commit/1b3a263))

## 1.5.0 (2025-10-30)

* Merge pull request #32 from mhalder/feature/code-vectorization ([50c6cb0](https://github.com/mhalder/qdrant-mcp-server/commit/50c6cb0)), closes [#32](https://github.com/mhalder/qdrant-mcp-server/issues/32)
* ci: add codecov configuration for coverage thresholds ([153a85e](https://github.com/mhalder/qdrant-mcp-server/commit/153a85e))
* ci: make codecov project check informational ([f8a09c3](https://github.com/mhalder/qdrant-mcp-server/commit/f8a09c3))
* test: add comprehensive test suite for code vectorization (802/840 passing) ([969c000](https://github.com/mhalder/qdrant-mcp-server/commit/969c000))
* test: add path validation tests to improve coverage ([4cbf5ed](https://github.com/mhalder/qdrant-mcp-server/commit/4cbf5ed))
* test: fix test samples and secret detection (809/840 passing) ([963a5c7](https://github.com/mhalder/qdrant-mcp-server/commit/963a5c7))
* test: improve test coverage to 97.72% and fix race conditions ([78a75cd](https://github.com/mhalder/qdrant-mcp-server/commit/78a75cd))
* feat: add code vectorization for semantic code search (#31) ([2a3745e](https://github.com/mhalder/qdrant-mcp-server/commit/2a3745e)), closes [#31](https://github.com/mhalder/qdrant-mcp-server/issues/31) [#31](https://github.com/mhalder/qdrant-mcp-server/issues/31)
* feat: add hybrid search and advanced filtering for code search (#31) ([bfb022e](https://github.com/mhalder/qdrant-mcp-server/commit/bfb022e)), closes [#31](https://github.com/mhalder/qdrant-mcp-server/issues/31) [#31](https://github.com/mhalder/qdrant-mcp-server/issues/31)
* feat: add incremental re-indexing with Merkle tree change detection (#31) ([dcd7c55](https://github.com/mhalder/qdrant-mcp-server/commit/dcd7c55)), closes [#31](https://github.com/mhalder/qdrant-mcp-server/issues/31) [Hi#level](https://github.com/Hi/issues/level) [#31](https://github.com/mhalder/qdrant-mcp-server/issues/31)
* feat: add path traversal validation for security ([0d783cc](https://github.com/mhalder/qdrant-mcp-server/commit/0d783cc)), closes [#2](https://github.com/mhalder/qdrant-mcp-server/issues/2)
* fix: improve test coverage and fix critical bugs (830/840 passing) ([32c13b2](https://github.com/mhalder/qdrant-mcp-server/commit/32c13b2))
* fix: resolve tree-sitter peer dependency conflicts for Node.js 22.x ([61d614f](https://github.com/mhalder/qdrant-mcp-server/commit/61d614f))
* docs: add comprehensive code vectorization examples and documentation ([1e0d48d](https://github.com/mhalder/qdrant-mcp-server/commit/1e0d48d))
* style: format code vectorization module with project formatter ([beb71bb](https://github.com/mhalder/qdrant-mcp-server/commit/beb71bb))

## 1.4.0 (2025-10-13)

* Merge pull request #29 from mhalder/feature/configurable-prompts ([f9652b1](https://github.com/mhalder/qdrant-mcp-server/commit/f9652b1)), closes [#29](https://github.com/mhalder/qdrant-mcp-server/issues/29)
* feat: add support for configurable MCP prompts ([e3cc6c2](https://github.com/mhalder/qdrant-mcp-server/commit/e3cc6c2)), closes [#28](https://github.com/mhalder/qdrant-mcp-server/issues/28)
* feat: set default prompts.json path with auto-loading ([203694a](https://github.com/mhalder/qdrant-mcp-server/commit/203694a))
* test: add comprehensive tests for prompts feature ([bb9ca66](https://github.com/mhalder/qdrant-mcp-server/commit/bb9ca66))

## <small>1.3.1 (2025-10-12)</small>

* Merge pull request #27 from mhalder/fix/empty-responses ([30d33a7](https://github.com/mhalder/qdrant-mcp-server/commit/30d33a7)), closes [#27](https://github.com/mhalder/qdrant-mcp-server/issues/27)
* fix: improve HTTP transport robustness and prevent resource leaks ([cff1248](https://github.com/mhalder/qdrant-mcp-server/commit/cff1248)), closes [#26](https://github.com/mhalder/qdrant-mcp-server/issues/26)

## 1.3.0 (2025-10-11)

* Merge pull request #25 from mhalder/feature/http-transport ([efc90c3](https://github.com/mhalder/qdrant-mcp-server/commit/efc90c3)), closes [#25](https://github.com/mhalder/qdrant-mcp-server/issues/25)
* fix: address PR feedback for HTTP transport implementation ([1aec6d5](https://github.com/mhalder/qdrant-mcp-server/commit/1aec6d5))
* fix: address PR feedback for HTTP transport implementation ([3243d0e](https://github.com/mhalder/qdrant-mcp-server/commit/3243d0e))
* fix: clear cleanup interval on shutdown and improve error messages ([6aa29f3](https://github.com/mhalder/qdrant-mcp-server/commit/6aa29f3))
* fix: implement per-IP rate limiting and consolidate port validation ([c3bfc92](https://github.com/mhalder/qdrant-mcp-server/commit/c3bfc92))
* fix: prevent transport double closure and add rate limiter memory management ([2f92d78](https://github.com/mhalder/qdrant-mcp-server/commit/2f92d78))
* fix: resolve critical issues in HTTP transport implementation ([7951f2b](https://github.com/mhalder/qdrant-mcp-server/commit/7951f2b))
* fix: resolve race condition and resource leak in HTTP timeout handler ([6635ccb](https://github.com/mhalder/qdrant-mcp-server/commit/6635ccb))
* docs: add Try It and Cleanup sections to hybrid-search example ([5e32f16](https://github.com/mhalder/qdrant-mcp-server/commit/5e32f16))
* feat: add HTTP transport support for remote MCP server deployment ([983a9d6](https://github.com/mhalder/qdrant-mcp-server/commit/983a9d6)), closes [#24](https://github.com/mhalder/qdrant-mcp-server/issues/24)

## 1.2.0 (2025-10-11)

* Merge pull request #23 from mhalder/feature/hybrid-search ([5925df7](https://github.com/mhalder/qdrant-mcp-server/commit/5925df7)), closes [#23](https://github.com/mhalder/qdrant-mcp-server/issues/23)
* feat: enable semantic search on hybrid collections ([c99e177](https://github.com/mhalder/qdrant-mcp-server/commit/c99e177))

## <small>1.1.1 (2025-10-11)</small>

* Merge pull request #22 from mhalder/docs/clean-and-condense ([991cb9d](https://github.com/mhalder/qdrant-mcp-server/commit/991cb9d)), closes [#22](https://github.com/mhalder/qdrant-mcp-server/issues/22)
* docs: clean and condense all documentation ([9f54ab8](https://github.com/mhalder/qdrant-mcp-server/commit/9f54ab8))
* docs: improve consistency and remove redundancy across all documentation ([176cb05](https://github.com/mhalder/qdrant-mcp-server/commit/176cb05))
* docs: remove test report and references - redundant with CI ([db0b8b7](https://github.com/mhalder/qdrant-mcp-server/commit/db0b8b7))
* docs: streamline README for clarity and conciseness ([bd34c91](https://github.com/mhalder/qdrant-mcp-server/commit/bd34c91))

## [1.1.0](https://github.com/mhalder/qdrant-mcp-server/compare/v1.0.0...v1.1.0) (2025-10-11)

### Features

- Enable scoped package publishing ([6b1b33f](https://github.com/mhalder/qdrant-mcp-server/commit/6b1b33f))

### Maintenance

- Scope package to @mhalder namespace for npm publishing ([9518827](https://github.com/mhalder/qdrant-mcp-server/commit/9518827))

## 1.0.0 (2025-10-11)

- chore: add docker compose configuration for qdrant ([ad1773f](https://github.com/mhalder/qdrant-mcp-server/commit/ad1773f))
- chore: add environment configuration template ([872be20](https://github.com/mhalder/qdrant-mcp-server/commit/872be20))
- chore: add ollama_storage to .gitignore ([4fb550e](https://github.com/mhalder/qdrant-mcp-server/commit/4fb550e))
- chore: configure semantic-release for automated versioning ([fb1d64a](https://github.com/mhalder/qdrant-mcp-server/commit/fb1d64a))
- chore: initial project setup ([7930b0f](https://github.com/mhalder/qdrant-mcp-server/commit/7930b0f))
- "Claude Code Review workflow" ([8739c72](https://github.com/mhalder/qdrant-mcp-server/commit/8739c72))
- "Claude PR Assistant workflow" ([01ad2e7](https://github.com/mhalder/qdrant-mcp-server/commit/01ad2e7))
- Merge pull request #12 from mhalder/add-claude-github-actions-1759866978728 ([6783076](https://github.com/mhalder/qdrant-mcp-server/commit/6783076)), closes [#12](https://github.com/mhalder/qdrant-mcp-server/issues/12)
- Merge pull request #13 from mhalder/examples-directory ([9e7c312](https://github.com/mhalder/qdrant-mcp-server/commit/9e7c312)), closes [#13](https://github.com/mhalder/qdrant-mcp-server/issues/13)
- Merge pull request #15 from mhalder/add-mit-license ([6e9525d](https://github.com/mhalder/qdrant-mcp-server/commit/6e9525d)), closes [#15](https://github.com/mhalder/qdrant-mcp-server/issues/15)
- Merge pull request #16 from mhalder/feat/rate-limiting-issue-6 ([fa3601e](https://github.com/mhalder/qdrant-mcp-server/commit/fa3601e)), closes [#16](https://github.com/mhalder/qdrant-mcp-server/issues/16)
- Merge pull request #17 from mhalder/feat/alternative-embedding-providers-issue-2 ([4670e29](https://github.com/mhalder/qdrant-mcp-server/commit/4670e29)), closes [#17](https://github.com/mhalder/qdrant-mcp-server/issues/17)
- Merge pull request #19 from mhalder/feat/use-ollama-as-default-issue-18 ([8b1075f](https://github.com/mhalder/qdrant-mcp-server/commit/8b1075f)), closes [#19](https://github.com/mhalder/qdrant-mcp-server/issues/19)
- test: add comprehensive tests for embedding provider architecture ([b2db1b4](https://github.com/mhalder/qdrant-mcp-server/commit/b2db1b4))
- test: add comprehensive unit tests for openai embeddings ([466a012](https://github.com/mhalder/qdrant-mcp-server/commit/466a012))
- test: add comprehensive unit tests for qdrant client ([0f6c3a9](https://github.com/mhalder/qdrant-mcp-server/commit/0f6c3a9))
- test: add comprehensive validation tests for environment variables ([1ae89b6](https://github.com/mhalder/qdrant-mcp-server/commit/1ae89b6))
- test: add functional testing round 3 for multi-provider architecture ([9588810](https://github.com/mhalder/qdrant-mcp-server/commit/9588810))
- test: add integration tests for mcp server tools ([b504329](https://github.com/mhalder/qdrant-mcp-server/commit/b504329))
- test: add interactive MCP testing round 4 results ([0cdc763](https://github.com/mhalder/qdrant-mcp-server/commit/0cdc763))
- test: add testing infrastructure with vitest ([35beed7](https://github.com/mhalder/qdrant-mcp-server/commit/35beed7))
- test: fix error handling tests and improve coverage ([1219574](https://github.com/mhalder/qdrant-mcp-server/commit/1219574))
- test: improve coverage for error handling paths ([833b3ef](https://github.com/mhalder/qdrant-mcp-server/commit/833b3ef))
- test: improve coverage reporting to 95.75% ([0a061d2](https://github.com/mhalder/qdrant-mcp-server/commit/0a061d2))
- test: update test expectations for ID normalization and document feature ([dce948d](https://github.com/mhalder/qdrant-mcp-server/commit/dce948d))
- fix: add copyright holder to LICENSE file ([d4f926b](https://github.com/mhalder/qdrant-mcp-server/commit/d4f926b))
- fix: add package-lock.json for reproducible builds ([ffc6385](https://github.com/mhalder/qdrant-mcp-server/commit/ffc6385))
- fix: add type guard for message.toLowerCase() call ([b622650](https://github.com/mhalder/qdrant-mcp-server/commit/b622650))
- fix: add validation for Retry-After header parsing ([f6e2d0f](https://github.com/mhalder/qdrant-mcp-server/commit/f6e2d0f))
- fix: address code quality issues and version mismatch ([8f48300](https://github.com/mhalder/qdrant-mcp-server/commit/8f48300))
- fix: convert simple key-value filters to Qdrant filter format ([cf7f684](https://github.com/mhalder/qdrant-mcp-server/commit/cf7f684))
- fix: generate coverage files before Codecov upload ([5e7369c](https://github.com/mhalder/qdrant-mcp-server/commit/5e7369c))
- fix: improve API key validation and Ollama error messages ([a556358](https://github.com/mhalder/qdrant-mcp-server/commit/a556358)), closes [#19](https://github.com/mhalder/qdrant-mcp-server/issues/19)
- fix: normalize string IDs to UUID format and enhance error handling ([75478e3](https://github.com/mhalder/qdrant-mcp-server/commit/75478e3))
- fix: select provider-specific API key in factory ([be2ed4b](https://github.com/mhalder/qdrant-mcp-server/commit/be2ed4b))
- feat: add Ollama model existence validation on startup ([3086563](https://github.com/mhalder/qdrant-mcp-server/commit/3086563))
- feat: add support for alternative embedding providers ([3762c43](https://github.com/mhalder/qdrant-mcp-server/commit/3762c43)), closes [#2](https://github.com/mhalder/qdrant-mcp-server/issues/2)
- feat: implement mcp server with semantic search tools ([3b99fce](https://github.com/mhalder/qdrant-mcp-server/commit/3b99fce))
- feat: implement OpenAI API rate limiting with exponential backoff ([c619570](https://github.com/mhalder/qdrant-mcp-server/commit/c619570)), closes [#6](https://github.com/mhalder/qdrant-mcp-server/issues/6)
- feat: implement openai embeddings provider ([e44c50c](https://github.com/mhalder/qdrant-mcp-server/commit/e44c50c))
- feat: implement qdrant client wrapper ([3195e63](https://github.com/mhalder/qdrant-mcp-server/commit/3195e63))
- feat: support both simple and Qdrant filter formats ([e5bb8fe](https://github.com/mhalder/qdrant-mcp-server/commit/e5bb8fe))
- feat: use Ollama as default embedding provider ([4342591](https://github.com/mhalder/qdrant-mcp-server/commit/4342591)), closes [#18](https://github.com/mhalder/qdrant-mcp-server/issues/18)
- docs: add Codecov badge to README ([fff50d2](https://github.com/mhalder/qdrant-mcp-server/commit/fff50d2))
- docs: add comment about Bottleneck reservoir configuration ([252fa9f](https://github.com/mhalder/qdrant-mcp-server/commit/252fa9f))
- docs: add comprehensive examples directory ([7ef9cf5](https://github.com/mhalder/qdrant-mcp-server/commit/7ef9cf5)), closes [#4](https://github.com/mhalder/qdrant-mcp-server/issues/4)
- docs: add comprehensive README with setup instructions ([4517207](https://github.com/mhalder/qdrant-mcp-server/commit/4517207))
- docs: add functional test report ([c0838bf](https://github.com/mhalder/qdrant-mcp-server/commit/c0838bf))
- docs: add MIT LICENSE file and update README ([3e427df](https://github.com/mhalder/qdrant-mcp-server/commit/3e427df))
- docs: add testing documentation to README ([cb5d62b](https://github.com/mhalder/qdrant-mcp-server/commit/cb5d62b))
- docs: comprehensive update to README with filtering examples ([66ec1b5](https://github.com/mhalder/qdrant-mcp-server/commit/66ec1b5))
- docs: streamline test report with latest MCP integration results ([b30cd04](https://github.com/mhalder/qdrant-mcp-server/commit/b30cd04))
- docs: update CI badge with correct GitHub username ([9d8bdfb](https://github.com/mhalder/qdrant-mcp-server/commit/9d8bdfb))
- docs: update configuration for claude code on linux ([429d514](https://github.com/mhalder/qdrant-mcp-server/commit/429d514))
- docs: update documentation for multi-provider support ([18196a1](https://github.com/mhalder/qdrant-mcp-server/commit/18196a1))
- docs: update documentation for Ollama as default provider ([60818dd](https://github.com/mhalder/qdrant-mcp-server/commit/60818dd))
- docs: update examples and version for Ollama as default ([eb7bd4d](https://github.com/mhalder/qdrant-mcp-server/commit/eb7bd4d))
- docs: update test report and README with v2 integration test results ([1ff1e22](https://github.com/mhalder/qdrant-mcp-server/commit/1ff1e22))
- ci: add GitHub Actions workflow for automated testing ([9420261](https://github.com/mhalder/qdrant-mcp-server/commit/9420261))
- ci: add provider verification tests to GitHub Actions ([f4d1f7d](https://github.com/mhalder/qdrant-mcp-server/commit/f4d1f7d))
- ci: remove Node.js 18.x from test matrix ([bf5f478](https://github.com/mhalder/qdrant-mcp-server/commit/bf5f478))
- ci: test Codecov integration with updated token ([60b5f2c](https://github.com/mhalder/qdrant-mcp-server/commit/60b5f2c))
- style: format CI workflow with yamlfmt ([cedf0f8](https://github.com/mhalder/qdrant-mcp-server/commit/cedf0f8))
- perf: optimize Ollama batch embedding with parallel processing ([7736c32](https://github.com/mhalder/qdrant-mcp-server/commit/7736c32))
- refactor: move verification script to scripts/ folder ([a25373f](https://github.com/mhalder/qdrant-mcp-server/commit/a25373f))
- refactor: replace error:any with typed OpenAIError interface ([08a0d23](https://github.com/mhalder/qdrant-mcp-server/commit/08a0d23))
