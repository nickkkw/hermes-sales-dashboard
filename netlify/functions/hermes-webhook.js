const DEFAULT_BRANCH = "main";
const DEFAULT_LATEST_PATH = "data/latest.json";
const DEFAULT_HISTORY_DIR = "data/history";
const FLAG_MARKETS = {
  "🇺🇸": { market: "US", label: "United States", currency: "USD" },
  "🇩🇪": { market: "DE", label: "Germany", currency: "EUR" },
  "🇯🇵": { market: "JP", label: "Japan", currency: "JPY" },
  "🇪🇸": { market: "ES", label: "Spain", currency: "EUR" },
  "🇨🇦": { market: "CA", label: "Canada", currency: "CAD" }
};
const SKU_RULES = [
  { pattern: /高端手碟|高端/i, code: "premium", title: "高端手碟" },
  { pattern: /12音/, code: "12-tone", title: "12音手碟" },
  { pattern: /10音/, code: "10-tone", title: "10音手碟" },
  { pattern: /9音/, code: "9-tone", title: "9音手碟" }
];

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

function parseReportDate(text, fallbackIsoDate) {
  const firstLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) {
    return fallbackIsoDate;
  }

  const match = firstLine.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!match) {
    return fallbackIsoDate;
  }

  const [, monthRaw, dayRaw, yearRaw] = match;
  const today = new Date();
  const year = yearRaw ? Number(yearRaw.length === 2 ? `20${yearRaw}` : yearRaw) : today.getUTCFullYear();
  const month = Number(monthRaw).toString().padStart(2, "0");
  const day = Number(dayRaw).toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function detectSku(segment) {
  for (const rule of SKU_RULES) {
    if (rule.pattern.test(segment)) {
      return rule;
    }
  }
  return null;
}

function parseSkuLine(line) {
  const cleaned = line.replace(/\s+/g, "");
  if (!cleaned || !/[音手碟]/.test(cleaned)) {
    return [];
  }

  return cleaned
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const sku = detectSku(part);
      if (!sku) {
        return null;
      }

      const qtyMatch = part.match(/[xX*＊](\d+)/);
      return {
        skuCode: sku.code,
        title: sku.title,
        units: qtyMatch ? Number(qtyMatch[1]) : 1
      };
    })
    .filter(Boolean);
}

function parseRawSalesReport(text, reportDate) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const products = [];
  const marketMeta = new Map();
  let currentMarket = null;

  for (const line of lines) {
    if (/^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?$/.test(line)) {
      continue;
    }

    if (FLAG_MARKETS[line]) {
      currentMarket = FLAG_MARKETS[line];
      marketMeta.set(currentMarket.market, currentMarket);
      continue;
    }

    if (!currentMarket) {
      continue;
    }

    for (const item of parseSkuLine(line)) {
      products.push({
        market: currentMarket.market,
        region: currentMarket.label,
        title: item.title,
        sku: item.skuCode,
        asin: "",
        units: item.units,
        revenue: 0,
        price: null,
        currency: currentMarket.currency,
        rank: null,
        change: "",
        url: "",
        note: `${currentMarket.label} ${reportDate} 日报`
      });
    }
  }

  const merged = new Map();
  for (const item of products) {
    const key = `${item.market}:${item.sku}`;
    const existing = merged.get(key);
    if (existing) {
      existing.units += item.units;
      continue;
    }
    merged.set(key, { ...item });
  }

  const normalizedProducts = [...merged.values()];
  const marketTotals = new Map();
  for (const product of normalizedProducts) {
    const meta = marketMeta.get(product.market) || {
      market: product.market,
      label: product.market,
      currency: product.currency || "USD"
    };
    const current = marketTotals.get(product.market) || {
      market: product.market,
      sales: 0,
      revenue: 0,
      currency: meta.currency,
      note: `${meta.label} 销量日报`
    };
    current.sales += product.units;
    marketTotals.set(product.market, current);
  }

  return {
    products: normalizedProducts,
    markets: [...marketTotals.values()]
  };
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
  const reportDate =
    report.reportDate ||
    report.date ||
    parseReportDate(rawText, new Date().toISOString().slice(0, 10));
  const parsedRaw = (!Array.isArray(report.products) && !Array.isArray(report.markets) && rawText)
    ? parseRawSalesReport(rawText, reportDate)
    : { products: [], markets: [] };
  const products = normalizeProducts({
    ...report,
    products: Array.isArray(report.products) ? report.products : parsedRaw.products
  });
  const markets = normalizeMarkets({
    ...report,
    markets: Array.isArray(report.markets) ? report.markets : parsedRaw.markets,
    products
  });
  const totalSales = products.reduce((sum, item) => sum + Number(item.units || 0), 0);
  const countries = markets.map((item) => item.market).join(", ");

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
      "This page reflects the latest Hermes sales payload normalized from the raw WeChat daily report.",
    summary: normalizeSummary(report, products, markets),
    sources: normalizeSources(report),
    highlights:
      (Array.isArray(report.highlights) && report.highlights.length
        ? report.highlights
        : [
            `已识别 ${markets.length} 个国家站点，合计 ${totalSales} 件手碟相关销量。`,
            countries ? `当前覆盖站点：${countries}。` : "当前消息里还没有解析出站点信息。",
            "日报格式支持国家 emoji、9音 / 10音 / 12音 / 高端手碟，以及 *数量 或 + 组合写法。"
          ].filter(Boolean)),
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
