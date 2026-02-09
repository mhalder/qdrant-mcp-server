import pino from "pino";

const VALID_LEVELS = [
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "silent",
];

function resolveLogLevel(): string {
  const level = process.env.LOG_LEVEL?.toLowerCase();
  if (!level) return "info";

  if (VALID_LEVELS.includes(level)) {
    return level;
  }

  // Write warning directly to stderr since logger isn't initialized yet
  process.stderr.write(
    `WARNING: Invalid LOG_LEVEL "${process.env.LOG_LEVEL}". Valid levels: ${VALID_LEVELS.join(", ")}. Falling back to "info".\n`,
  );
  return "info";
}

const logger = pino(
  { level: resolveLogLevel(), name: "qdrant-mcp" },
  pino.destination(2),
);

export default logger;
