const DEFAULT_BRANCH = "main";
const DEFAULT_LATEST_PATH = "data/latest.json";
const DEFAULT_HISTORY_DIR = "data/history";

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(body, null, 2)
  };
}

function parseJsonBody(event) {
  if (!event.body) {
    return {};
  }

  try {
    return JSON.parse(event.body);
  } catch (error) {
    throw new Error("Request body must be valid JSON.");
  }
}

function pickText(payload) {
  return (
    payload.rawText ||
    payload.text ||
    payload.message ||
    payload.content ||
    payload.body ||
    ""
  );
}

function linesToHighlights(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.includes(":"))
    .slice(0, 5);
}

function normalizeSources(payload) {
  const sources = Array.isArray(payload.sources) ? payload.sources : [];
  if (sources.length) {
    return sources;
  }

  return [
    {
      label: "Hermes via WeChat",
      url: payload.sourceUrl || "https://example.com/hermes",
      note: "Replace this placeholder when you know the exact Hermes-facing link you want to show."
    }
  ];
}

function normalizeMarkets(payload) {
  if (Array.isArray(payload.markets)) {
    return payload.markets.map((item) => ({
      market: item.market || item.name || "Unknown",
      sales: Number(item.sales || item.units || 0),
      revenue: Number(item.revenue || item.salesAmount || 0),
      currency: item.currency || "USD",
      note: item.note || ""
    }));
  }

  const products = Array.isArray(payload.products) ? payload.products : [];
  const grouped = new Map();
  for (const product of products) {
    const key = product.market || "Unknown";
    const current = grouped.get(key) || {
      market: key,
      sales: 0,
      revenue: 0,
      currency: product.currency || "USD",
      note: ""
    };
    current.sales += Number(product.units || product.sales || 0);
    current.revenue += Number(product.revenue || 0);
    grouped.set(key, current);
  }
  return [...grouped.values()];
}

function normalizeProducts(payload) {
  if (!Array.isArray(payload.products)) {
    return [];
  }

  return payload.products.map((item) => ({
    market: item.market || item.region || "Unknown",
    title: item.title || item.name || "Untitled product",
    asin: item.asin || "",
    units: Number(item.units || item.sales || 0),
    revenue: Number(item.revenue || item.salesAmount || 0),
    price: item.price === undefined || item.price === null ? null : Number(item.price),
    currency: item.currency || "USD",
    rank: item.rank === undefined || item.rank === null ? null : Number(item.rank),
    change: item.change || "",
    url: item.url || item.link || "",
    note: item.note || ""
  }));
}

function normalizeSummary(payload, products, markets) {
  const totalSales =
    payload.summary?.totalSales ??
    payload.totalSales ??
    products.reduce((sum, item) => sum + Number(item.units || 0), 0);

  const totalRevenue =
    payload.summary?.totalRevenue ??
    payload.totalRevenue ??
    products.reduce((sum, item) => sum + Number(item.revenue || 0), 0);

  return {
    headline:
      payload.summary?.headline ||
      payload.headline ||
      "Hermes posted a new sales update.",
    totalSales: Number(totalSales || 0),
    totalRevenue: Number(totalRevenue || 0),
    trackedProducts:
      payload.summary?.trackedProducts ??
      payload.trackedProducts ??
      products.length,
    marketCount:
      payload.summary?.marketCount ??
      payload.marketCount ??
      markets.length,
    currency: payload.summary?.currency || payload.currency || "USD"
  };
}

function normalizePayload(payload) {
  const report = payload.report && typeof payload.report === "object" ? payload.report : payload;
  const rawText = pickText(report);
  const products = normalizeProducts(report);
  const markets = normalizeMarkets(report);
  const reportDate =
    report.reportDate ||
    report.date ||
    new Date().toISOString().slice(0, 10);

  return {
    reportDate,
    generatedAt: new Date().toISOString(),
    title: report.title || "Hermes Sales Dashboard",
    subtitle:
      report.subtitle ||
      "Updated automatically from Hermes messages through a Netlify webhook.",
    source: report.source || "Hermes via WeChat",
    scope:
      report.scope ||
      "This page reflects the latest normalized Hermes sales payload stored in the repository.",
    summary: normalizeSummary(report, products, markets),
    sources: normalizeSources(report),
    highlights:
      (Array.isArray(report.highlights) && report.highlights.length
        ? report.highlights
        : linesToHighlights(rawText)),
    markets,
    products,
    rawText: rawText || "No raw message content supplied."
  };
}

function base64Encode(text) {
  return Buffer.from(text, "utf8").toString("base64");
}

async function fetchGitHubJson(url, token) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json"
    }
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`GitHub read failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function upsertGitHubFile({ owner, repo, branch, path, content, message, token }) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const existing = await fetchGitHubJson(`${url}?ref=${encodeURIComponent(branch)}`, token);

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message,
      content: base64Encode(content),
      branch,
      sha: existing?.sha
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub write failed for ${path}: ${response.status} ${text}`);
  }

  return response.json();
}

function isAuthorized(event, secret) {
  if (!secret) {
    return true;
  }

  const authHeader = event.headers.authorization || event.headers.Authorization || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const headerSecret = event.headers["x-hermes-secret"] || event.headers["X-Hermes-Secret"] || "";
  return bearer === secret || headerSecret === secret;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Use POST for this endpoint." });
  }

  if (!isAuthorized(event, process.env.HERMES_WEBHOOK_SECRET)) {
    return json(401, { error: "Unauthorized webhook request." });
  }

  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  if (!token || !owner || !repo) {
    return json(500, {
      error: "Missing required environment variables.",
      required: ["GITHUB_TOKEN", "GITHUB_OWNER", "GITHUB_REPO"]
    });
  }

  try {
    const payload = parseJsonBody(event);
    const report = normalizePayload(payload);
    const branch = process.env.GITHUB_BRANCH || DEFAULT_BRANCH;
    const latestPath = process.env.DASHBOARD_LATEST_PATH || DEFAULT_LATEST_PATH;
    const historyDir = process.env.DASHBOARD_HISTORY_DIR || DEFAULT_HISTORY_DIR;
    const historyPath = `${historyDir}/${report.reportDate}.json`;
    const serialized = JSON.stringify(report, null, 2);
    const messageBase = payload.commitMessage || `Update dashboard for ${report.reportDate}`;

    await upsertGitHubFile({
      owner,
      repo,
      branch,
      path: latestPath,
      content: serialized,
      message: messageBase,
      token
    });

    await upsertGitHubFile({
      owner,
      repo,
      branch,
      path: historyPath,
      content: serialized,
      message: `${messageBase} (history snapshot)`,
      token
    });

    return json(200, {
      ok: true,
      reportDate: report.reportDate,
      latestPath,
      historyPath,
      trackedProducts: report.products.length,
      markets: report.markets.length
    });
  } catch (error) {
    return json(500, {
      error: error.message
    });
  }
};
