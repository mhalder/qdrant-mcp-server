import type express from "express";
import logger from "./logger.js";
import type { QdrantManager } from "./qdrant/client.js";

const log = logger.child({ component: "dashboard" });

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function getCollectionSummaries(qdrant: QdrantManager) {
  const names = await qdrant.listCollections();
  return Promise.all(
    names.sort().map(async (name) => {
      try {
        return {
          name,
          info: await qdrant.getCollectionInfo(name),
          error: null,
        };
      } catch (error) {
        return {
          name,
          info: null,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    })
  );
}

function renderCollectionsDashboard(
  summaries: Awaited<ReturnType<typeof getCollectionSummaries>>
): string {
  const rows = summaries
    .map(({ name, info, error }) => {
      const type = info?.hybridEnabled ? "Hybrid" : "Dense";
      const points = info ? info.pointsCount.toLocaleString() : "n/a";
      const vectorSize = info ? String(info.vectorSize) : "n/a";
      const distance = info ? info.distance : "n/a";
      const status = error ? `<span class="status error">${escapeHtml(error)}</span>` : "";

      return `<tr>
        <td><code>${escapeHtml(name)}</code></td>
        <td>${points}</td>
        <td>${vectorSize}</td>
        <td>${escapeHtml(distance)}</td>
        <td>${type}</td>
        <td>${status}</td>
      </tr>`;
    })
    .join("");

  const emptyState =
    summaries.length === 0
      ? `<tr><td colspan="6" class="empty">No collections found.</td></tr>`
      : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Qdrant MCP Collections</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #f7f8fa;
      --fg: #1f2933;
      --muted: #6b7280;
      --line: #d8dee7;
      --panel: #ffffff;
      --accent: #0f766e;
      --error: #b91c1c;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #111418;
        --fg: #e5e7eb;
        --muted: #9ca3af;
        --line: #2c3440;
        --panel: #171c22;
        --accent: #2dd4bf;
        --error: #f87171;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--fg);
      font: 14px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    main {
      width: min(1120px, calc(100% - 32px));
      margin: 28px auto;
    }
    header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 16px;
    }
    h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 650;
      letter-spacing: 0;
    }
    .meta {
      color: var(--muted);
      white-space: nowrap;
    }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }
    .health {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-height: 32px;
      padding: 0 10px;
      color: var(--muted);
    }
    .led {
      width: 9px;
      height: 9px;
      border-radius: 999px;
      background: var(--muted);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--muted), transparent 78%);
    }
    .health.ok .led {
      background: #16a34a;
      box-shadow: 0 0 0 2px color-mix(in srgb, #16a34a, transparent 75%);
    }
    .health.error .led {
      background: var(--error);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--error), transparent 75%);
    }
    a.button {
      display: inline-flex;
      align-items: center;
      min-height: 32px;
      padding: 0 10px;
      border: 1px solid var(--line);
      border-radius: 6px;
      color: var(--fg);
      background: var(--panel);
      text-decoration: none;
    }
    a.button:hover { border-color: var(--accent); }
    .table-wrap {
      overflow: auto;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 760px;
    }
    th, td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
    }
    th {
      color: var(--muted);
      font-size: 12px;
      font-weight: 650;
      text-transform: uppercase;
    }
    tr:last-child td { border-bottom: 0; }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 13px;
    }
    .status.error { color: var(--error); }
    .empty {
      color: var(--muted);
      text-align: center;
      padding: 28px 12px;
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Qdrant Collections</h1>
      <div class="meta">${summaries.length} collection${summaries.length === 1 ? "" : "s"}</div>
    </header>
    <div class="toolbar">
      <a class="button" href="/dashboard">Refresh</a>
      <a class="button" href="/api/collections">JSON</a>
      <a class="button" href="/health">Health</a>
      <span class="health" id="health-indicator"><span class="led"></span><span id="health-label">Checking</span></span>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Points</th>
            <th>Vector Size</th>
            <th>Distance</th>
            <th>Type</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${rows}${emptyState}</tbody>
      </table>
    </div>
  </main>
  <script>
    const health = document.getElementById("health-indicator");
    const label = document.getElementById("health-label");
    fetch("/health")
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json();
      })
      .then((data) => {
        health.classList.add("ok");
        label.textContent = data.status === "ok" ? "OK" : data.status;
      })
      .catch(() => {
        health.classList.add("error");
        label.textContent = "Down";
      });
  </script>
</body>
</html>`;
}

export function registerDashboardRoutes(app: express.Express, qdrant: QdrantManager): void {
  app.get("/", (_req, res) => {
    res.redirect("/dashboard");
  });

  app.get("/api/collections", async (_req, res) => {
    try {
      res.json(await getCollectionSummaries(qdrant));
    } catch (error) {
      log.error({ err: error }, "Failed to load collections");
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.get("/dashboard", async (_req, res) => {
    try {
      res.type("html").send(renderCollectionsDashboard(await getCollectionSummaries(qdrant)));
    } catch (error) {
      log.error({ err: error }, "Failed to render collections dashboard");
      res.status(500).type("text").send(error instanceof Error ? error.message : String(error));
    }
  });
}
