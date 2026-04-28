const fs = require("fs");
const path = require("path");

const SOURCE_PATH = "/Users/nickwei/.hermes/amazon-sales.json";
const TARGET_PATH = path.resolve(__dirname, "../data/amazon-sales.json");

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`无法读取或解析 JSON: ${filePath}\n${error.message}`);
  }
}

function validateSalesData(data) {
  if (!data || typeof data !== "object") {
    throw new Error("数据必须是一个 JSON object。");
  }

  if (!Array.isArray(data.entries)) {
    throw new Error("缺少 entries 数组。");
  }

  for (const [index, entry] of data.entries.entries()) {
    if (!entry.date) {
      throw new Error(`entries[${index}] 缺少 date。`);
    }

    if (!entry.sales || typeof entry.sales !== "object") {
      throw new Error(`entries[${index}] 缺少 sales object。`);
    }
  }
}

function summarize(data) {
  const entries = data.entries || [];
  const countries = new Set();
  const skus = new Set();
  let totalSales = 0;

  for (const entry of entries) {
    for (const [country, skuMap] of Object.entries(entry.sales || {})) {
      countries.add(country);
      for (const [sku, count] of Object.entries(skuMap || {})) {
        skus.add(sku);
        totalSales += Number(count || 0);
      }
    }
  }

  return {
    entries: entries.length,
    countries: countries.size,
    skus: skus.size,
    totalSales
  };
}

function main() {
  const data = readJson(SOURCE_PATH);
  validateSalesData(data);

  fs.mkdirSync(path.dirname(TARGET_PATH), { recursive: true });
  fs.writeFileSync(TARGET_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf8");

  const summary = summarize(data);
  console.log("Amazon sales data synced.");
  console.log(`Source: ${SOURCE_PATH}`);
  console.log(`Target: ${TARGET_PATH}`);
  console.log(`Entries: ${summary.entries}`);
  console.log(`Countries: ${summary.countries}`);
  console.log(`SKUs: ${summary.skus}`);
  console.log(`Total sales: ${summary.totalSales}`);
  console.log("");
  console.log("Next publish steps:");
  console.log("  git add data/amazon-sales.json");
  console.log('  git commit -m "Update Amazon sales data"');
  console.log("  git push origin main");
}

main();
