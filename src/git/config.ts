/**
 * Default configuration and constants for git history indexing
 */

import type { CommitType, GitConfig } from "./types.js";

/**
 * Default configuration for git history indexing
 */
export const DEFAULT_GIT_CONFIG: GitConfig = {
  maxCommits: 5000,
  includeFileList: true,
  includeDiff: true,
  maxDiffSize: 5000, // 5KB max diff per commit
  maxChunkSize: 3000,
  batchSize: 100,
  defaultSearchLimit: 10,
  enableHybridSearch: true,
};

/**
 * Patterns for classifying commit types based on conventional commits
 * Order matters - first match wins
 */
export const COMMIT_TYPE_PATTERNS: Array<{
  type: CommitType;
  patterns: RegExp[];
}> = [
  {
    type: "feat",
    patterns: [
      /^feat(\(.+\))?[!:]/, // feat: or feat(scope):
      /^feature(\(.+\))?[!:]/,
      /\badd(ed|s|ing)?\b.*\b(feature|functionality|support)/i,
      /\bimplement(ed|s|ing)?\b/i,
      /\bnew\b.*\b(feature|functionality)/i,
    ],
  },
  {
    type: "fix",
    patterns: [
      /^fix(\(.+\))?[!:]/,
      /^bugfix(\(.+\))?[!:]/,
      /^hotfix(\(.+\))?[!:]/,
      /\bfix(ed|es|ing)?\b.*\b(bug|issue|problem|error)/i,
      /\bresolve[ds]?\b.*\b(issue|bug|problem)/i,
      /\bcorrect(ed|s|ing)?\b/i,
    ],
  },
  {
    type: "refactor",
    patterns: [
      /^refactor(\(.+\))?[!:]/,
      /\brefactor(ed|s|ing)?\b/i,
      /\brestructur(ed|es|ing)?\b/i,
      /\breorganiz(ed|es|ing)?\b/i,
      /\bclean(ed|s|ing)?\s*up\b/i,
    ],
  },
  {
    type: "docs",
    patterns: [
      /^docs?(\(.+\))?[!:]/,
      /\bdocument(ed|s|ing|ation)?\b/i,
      /\breadme\b/i,
      /\bchangelog\b/i,
      /\bcomments?\b/i,
      /\bjsdoc\b/i,
      /\btypedoc\b/i,
    ],
  },
  {
    type: "test",
    patterns: [
      /^test(\(.+\))?[!:]/,
      /^tests?(\(.+\))?[!:]/,
      /\btest(ed|s|ing)?\b/i,
      /\bspec(s)?\b/i,
      /\bcoverage\b/i,
      /\bunit\s*test/i,
      /\bintegration\s*test/i,
      /\be2e\b/i,
    ],
  },
  {
    type: "chore",
    patterns: [
      /^chore(\(.+\))?[!:]/,
      /\bchore\b/i,
      /\bmaintenance\b/i,
      /\bdependenc(y|ies)\b/i,
      /\bbump(ed|s|ing)?\b.*\bversion/i,
      /\bupgrade[ds]?\b/i,
      /\bupdate[ds]?\b.*\b(dep|package|lock)/i,
    ],
  },
  {
    type: "style",
    patterns: [
      /^style(\(.+\))?[!:]/,
      /\bformat(ted|s|ting)?\b/i,
      /\blint(ed|s|ing)?\b/i,
      /\bprettier\b/i,
      /\beslint\b/i,
      /\bwhitespace\b/i,
      /\bindentation\b/i,
    ],
  },
  {
    type: "perf",
    patterns: [
      /^perf(\(.+\))?[!:]/,
      /^performance(\(.+\))?[!:]/,
      /\bperformance\b/i,
      /\boptimiz(ed|es|ing|ation)?\b/i,
      /\bspeed\s*up\b/i,
      /\bfaster\b/i,
      /\bcach(e|ed|ing)\b/i,
    ],
  },
  {
    type: "build",
    patterns: [
      /^build(\(.+\))?[!:]/,
      /\bbuild\b/i,
      /\bwebpack\b/i,
      /\brollup\b/i,
      /\bvite\b/i,
      /\bbundl(e|ed|er|ing)\b/i,
      /\bcompil(e|ed|er|ing|ation)\b/i,
    ],
  },
  {
    type: "ci",
    patterns: [
      /^ci(\(.+\))?[!:]/,
      /\bci\b/i,
      /\bgithub\s*actions?\b/i,
      /\bworkflow\b/i,
      /\bpipeline\b/i,
      /\btravis\b/i,
      /\bcircle\s*ci\b/i,
      /\bjenkins\b/i,
    ],
  },
  {
    type: "revert",
    patterns: [/^revert(\(.+\))?[!:]/, /\brevert(ed|s|ing)?\b/i],
  },
];

/**
 * Git log format string for extracting structured commit data
 * Format: hash|shortHash|author|authorEmail|date|subject|body
 */
export const GIT_LOG_FORMAT = "%H|%h|%an|%ae|%aI|%s|%b";

/**
 * Delimiter used in git log output to separate commits
 */
export const GIT_LOG_COMMIT_DELIMITER = "---COMMIT_DELIMITER---";

/**
 * Max buffer size for git operations (50MB)
 */
export const GIT_MAX_BUFFER = 50 * 1024 * 1024;

/**
 * Reserved ID for storing indexing metadata in the collection
 */
export const GIT_INDEXING_METADATA_ID = "__git_indexing_metadata__";
