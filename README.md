# RSS Email Worker

Hourly Cloudflare Worker that polls multiple RSS/Atom feeds, deduplicates items, and sends an email digest through Mailtrap. A lightweight frontend (served from the Worker) lets you manage feeds and run the job immediately.

## Features

- Store feeds plus sent-item hashes in Cloudflare KV.
- Scheduled cron (`*/30 * * * *`) fetches all feeds every 30 minutes.
- Mailtrap integration (HTML + plain-text digest) to `gobarabadze@gmail.com`.
- Frontend CRUD (add/update/delete feeds) and "Run Now" button.
- Optional `MANAGEMENT_API_KEY` header to guard mutations/manual runs.

## Prerequisites

- `wrangler` 4.21+
- Mailtrap account with API token and inbox ID.

## Configuration

1. Install deps
   ```bash
   npm install
   ```
2. Create a KV namespace for feeds/sent items (replace the names if you prefer):
   ```bash
   npx wrangler kv namespace create FEEDS_KV
   npx wrangler kv namespace create FEEDS_KV --preview
   ```
   Update `wrangler.json` with the generated `id`/`preview_id` values (replace the placeholder strings currently committed).
3. Mailtrap + app config (`wrangler.json` → `vars`)
   - `MAILTRAP_FROM`: Sender email/name e.g. `RSS Worker <rss@example.com>` or just `rss@example.com`
   - `MAILTRAP_RECIPIENT`: defaults to `gobarabadze@gmail.com` but can be changed.
4. Secrets
   ```bash
   wrangler secret put MAILTRAP_API_TOKEN
   wrangler secret put MANAGEMENT_API_KEY   # required if you want to lock down the UI
   ```
   The `MANAGEMENT_API_KEY` is the value typed into the frontend and passed as the `X-Admin-Key` header. Leaving it unset keeps CRUD endpoints open (not recommended publicly).
5. Deploy
   ```bash
   npm run deploy
   ```

## Local development

```bash
npm run dev
```

- Visit the local dev URL to open the feed manager UI.
- Add feeds, edit URLs/titles inline, delete rows, or press **Run fetch & email now** to call `/api/run`.
- The UI stores the admin key in `localStorage` (it is never written to KV).

## Manual API usage

```bash
curl -X POST https://<worker-host>/api/run \
  -H "X-Admin-Key: $MANAGEMENT_API_KEY"

curl -X POST https://<worker-host>/api/feeds \
  -H "X-Admin-Key: $MANAGEMENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"Example","url":"https://example.com/rss"}'
```

Responses are JSON and include job summaries: feeds checked, new items, and whether Mailtrap send succeeded.

## Mailtrap notes

- API token stays secret: `wrangler secret put MAILTRAP_API_TOKEN`.
- Sender email/name live in `wrangler.json` vars (safe to commit).
- The worker sends one message per run summarizing every new item; duplicates are prevented via hashed IDs stored in KV for ~30 days.
- Get your API token from your [Mailtrap account](https://mailtrap.io/).
- Uses Mailtrap Sending API to send emails to real recipients.

## Frontend quick tips

- “Manual run” triggers the same logic as the hourly cron.
- If your admin key is wrong/missing you’ll see 401 responses and inline errors.
- Feed cards show last run time and outcome (“Sent N new items”, “Email failed”, etc.).
