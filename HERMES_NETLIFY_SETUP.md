# Hermes -> Netlify Setup

This project now contains a first-pass implementation of the flow:

`WeChat -> Hermes -> Netlify Function webhook -> GitHub repo data/latest.json -> Netlify rebuild`

## Files

- `index.html`
  The static dashboard page.
- `data/latest.json`
  The latest report consumed by the page.
- `netlify/functions/hermes-webhook.js`
  The webhook endpoint that receives Hermes payloads and writes them into GitHub through the GitHub Contents API.
- `netlify.toml`
  Netlify configuration for publish path and functions.

## Recommended deploy model

1. Put this project in a GitHub repository.
2. Connect that repository to Netlify with Git-based deployment.
3. In Netlify, set the following environment variables:

   - `GITHUB_TOKEN`
     A GitHub token with permission to update repository contents.
   - `GITHUB_OWNER`
     Your GitHub username or org.
   - `GITHUB_REPO`
     The repository name.
   - `GITHUB_BRANCH`
     Usually `main`.
   - `HERMES_WEBHOOK_SECRET`
     Shared secret for Hermes to call the webhook.
   - `DASHBOARD_LATEST_PATH`
     Optional. Defaults to `data/latest.json`.
   - `DASHBOARD_HISTORY_DIR`
     Optional. Defaults to `data/history`.

4. After deploy, Netlify will expose the function at:

   - `https://your-site.netlify.app/.netlify/functions/hermes-webhook`

## Supported payload shapes

The webhook accepts JSON. The cleanest option is structured JSON like:

```json
{
  "reportDate": "2026-04-28",
  "title": "Hermes Sales Dashboard",
  "summary": {
    "headline": "US and DE both grew today.",
    "totalSales": 128,
    "totalRevenue": 12458.9,
    "currency": "USD"
  },
  "highlights": [
    "US top seller stayed stable.",
    "DE ranking improved."
  ],
  "markets": [
    {
      "market": "US",
      "sales": 84,
      "revenue": 8940.55,
      "currency": "USD",
      "note": "Strong afternoon run."
    },
    {
      "market": "DE",
      "sales": 44,
      "revenue": 3518.35,
      "currency": "EUR",
      "note": "Lower volume, stronger conversion."
    }
  ],
  "products": [
    {
      "market": "US",
      "title": "Sarospan Handpan Drum",
      "asin": "B0DKFJ27X5",
      "units": 21,
      "revenue": 3969.84,
      "price": 189.04,
      "currency": "USD",
      "rank": 79,
      "change": "+3",
      "url": "https://www.amazon.com/...",
      "note": "Cross-market listing."
    }
  ],
  "rawText": "Original Hermes message goes here"
}
```

The function also tolerates a simpler body like:

```json
{
  "text": "Today sales update...\nUS Sales: 84\nDE Sales: 44"
}
```

That is useful if Hermes can only forward raw message text at first.

## Authentication

The function checks `HERMES_WEBHOOK_SECRET` if present. Hermes can send it as either:

- `Authorization: Bearer YOUR_SECRET`
- `X-Hermes-Secret: YOUR_SECRET`

## Quick test

After the site is deployed, you can test the endpoint with a request like:

```bash
curl -X POST "https://your-site.netlify.app/.netlify/functions/hermes-webhook" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SECRET" \
  -d '{
    "reportDate": "2026-04-28",
    "summary": {
      "headline": "US and DE both grew today.",
      "totalSales": 128,
      "totalRevenue": 12458.9,
      "currency": "USD"
    },
    "highlights": [
      "US top seller stayed stable.",
      "DE ranking improved."
    ],
    "markets": [
      { "market": "US", "sales": 84, "revenue": 8940.55, "currency": "USD" },
      { "market": "DE", "sales": 44, "revenue": 3518.35, "currency": "EUR" }
    ],
    "products": [
      {
        "market": "US",
        "title": "Sarospan Handpan Drum",
        "asin": "B0DKFJ27X5",
        "units": 21,
        "revenue": 3969.84,
        "price": 189.04,
        "currency": "USD",
        "rank": 79,
        "change": "+3",
        "url": "https://www.amazon.com/..."
      }
    ],
    "rawText": "Original Hermes message goes here"
  }'
```

## What the webhook updates

Each successful call writes:

- `data/latest.json`
- `data/history/YYYY-MM-DD.json`

Because the repository changes, Netlify Git deployment should rebuild the site automatically.

## Important notes

- This project assumes the Netlify function is allowed to call the GitHub API.
- The page is static and fetches `data/latest.json` with `cache-control: no-store`.
- If Hermes eventually supports richer structured payloads, the dashboard will immediately become cleaner without changing the page.

## Good next steps

1. Confirm how Hermes can send outbound requests.
2. Lock the exact payload format.
3. Add product sorting and history comparison on the page.
4. Add a small parser if Hermes can only output semi-structured plain text.
