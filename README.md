# Hermes Sales Dashboard

Static dashboard for publishing sales updates that arrive through Hermes.

## Flow

1. You send a `#sales` message to Hermes.
2. Hermes forwards the message to a webhook.
3. The Netlify function normalizes the payload and writes `data/latest.json` into the GitHub repo.
4. Netlify rebuilds the site from Git.

## Main Files

- `index.html`: dashboard page
- `data/latest.json`: latest published sales snapshot
- `netlify/functions/hermes-webhook.js`: webhook receiver
- `netlify.toml`: Netlify config
- `HERMES_NETLIFY_SETUP.md`: setup notes

## Next Steps

1. Initialize and commit this repo locally.
2. Create an empty GitHub repository.
3. Add the GitHub remote and push `main`.
4. Connect the repo to Netlify.
5. Set Netlify environment variables.
6. Replace the Hermes test webhook with the Netlify production webhook.
