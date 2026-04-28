window.DASHBOARD_DATA = {
  "reportDate": "2026-04-28",
  "generatedAt": "2026-04-28T16:20:00+08:00",
  "title": "Hermes Sales Dashboard",
  "subtitle": "A Netlify-ready sales page that can be updated by Hermes webhook pushes.",
  "source": "Prototype seed data",
  "scope": "This is the target data shape for the webhook flow. Hermes can send fully structured JSON or plain text that we normalize into this schema.",
  "summary": {
    "headline": "Today is running as a prototype. Once Hermes starts posting real payloads, this page can refresh automatically on each Git-driven deploy.",
    "totalSales": 128,
    "totalRevenue": 12458.9,
    "trackedProducts": 4,
    "marketCount": 2,
    "currency": "USD"
  },
  "sources": [
    {
      "label": "Hermes via WeChat",
      "url": "https://example.com/hermes",
      "note": "Replace this placeholder with your real Hermes or data source reference if you want it displayed."
    },
    {
      "label": "Netlify Production Site",
      "url": "https://example.netlify.app",
      "note": "This site will rebuild when the webhook updates the repository data file."
    }
  ],
  "highlights": [
    "The page is designed for summary metrics, market breakdown, product rows, and the raw Hermes message.",
    "The webhook can accept structured JSON immediately, but it can also tolerate plain text as a first step.",
    "Git-driven deploys keep the setup stable and easy to audit."
  ],
  "markets": [
    {
      "market": "US",
      "sales": 84,
      "revenue": 8940.55,
      "currency": "USD",
      "note": "Prototype market summary row."
    },
    {
      "market": "DE",
      "sales": 44,
      "revenue": 3518.35,
      "currency": "USD",
      "note": "You can switch this to EUR when Hermes sends market-specific currency data."
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
      "url": "https://www.amazon.com/Sarospan-Handpan-Drum-Stickers-Performance/dp/B0DKFJ27X5/",
      "note": "Example row showing how a tracked product can be presented."
    },
    {
      "market": "US",
      "title": "Amkoskr Handpan 22 inch D Minor Kurd",
      "asin": "B0DHRVJYCZ",
      "units": 15,
      "revenue": 3599.85,
      "price": 239.99,
      "currency": "USD",
      "rank": 54,
      "change": "-1",
      "url": "https://www.amazon.com/Handpan-Instrument-Professional-Performance-Adults/dp/B0DHRVJYCZ/",
      "note": "Another example row using current handpan tracking data."
    },
    {
      "market": "DE",
      "title": "ANTETOK Harmonic Handpan Drum",
      "asin": "B09MF21KF3",
      "units": 10,
      "revenue": 2799.6,
      "price": 279.96,
      "currency": "USD",
      "rank": 52,
      "change": "+5",
      "url": "https://www.amazon.de/-/en/ANTETOK-10-22-Harmonious-Percussion/dp/B09MF21KF3/",
      "note": "Prototype row for a Germany listing."
    },
    {
      "market": "DE",
      "title": "22 Inch Handpan Drum 10 Tones D Minor",
      "asin": "B0F7X8VSSV",
      "units": 8,
      "revenue": 1535.36,
      "price": 191.92,
      "currency": "USD",
      "rank": 72,
      "change": "+2",
      "url": "https://www.amazon.de/-/en/Handpan-Nitride-Hand-Tuned-Complete-Performance/dp/B0F7X8VSSV/",
      "note": "Example of a lower-ranked but still tracked listing."
    }
  ],
  "rawText": "Date: 2026-04-28\nChannel: Hermes via WeChat\nSummary: Prototype seed payload for the Netlify workflow.\n\nUS Sales: 84 units / $8,940.55\nDE Sales: 44 units / $3,518.35\n\nTop Notes:\n- Sarospan stayed visible in both marketplaces.\n- Germany still has a higher density of real handpan listings.\n- This raw block can store the original Hermes message for audit and debugging."
};
