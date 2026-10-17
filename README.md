# FH Electrical Ops — Live Logs Dashboard

A Next.js dashboard for viewing your Roblox electrical-system logs stored by your existing FastAPI + MySQL API. Designed for deployment on Vercel.

## Features

- Polls for new log records every 5 seconds (can be paused)
- Search by message, category, server ID, or details
- Filter by inferred level, category, and server
- Inspect a log's full details JSON
- Export currently filtered results to CSV
- Keeps the API key on the server; it is never sent to the browser

## 1. Configure environment variables

Copy `.env.example` to `.env.local` for local development and fill in your API key:

```env
LOGS_API_URL=https://api.fh-development.xyz/logs
LOGS_API_KEY=your_real_api_key
```

`LOGS_API_URL` should be the base GET endpoint that returns logs, not `/logs/batch`. The server proxy appends `after_id` and `limit` query parameters and sends `X-API-Key`.

Do **not** use `NEXT_PUBLIC_` for the API key. That would expose it in client-side JavaScript.

## 2. Run locally

Use Node.js 18.17+ (Node 20 LTS recommended).

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## 3. Deploy to Vercel

1. Create a GitHub repository and upload the contents of this folder.
2. In Vercel, select **Add New → Project** and import that repository.
3. In **Project Settings → Environment Variables**, add:
   - `LOGS_API_URL` = `https://api.fh-development.xyz/logs`
   - `LOGS_API_KEY` = the same API key your FastAPI endpoint expects
4. Add the variables to Production (and Preview if desired), then redeploy.

Vercel will detect Next.js automatically.

## API expectations

The proxy requests:

```http
GET /logs?after_id=0&limit=100
X-API-Key: <server-only API key>
```

The API response may be either an array of rows or an object with a `logs` or `items` array. Expected row fields match the database/API setup:

- `id`
- `event_timestamp` or `timestamp`
- `received_at`
- `server_id`
- `category`
- `message`
- `details`

The dashboard infers INFO/WARNING/ERROR/CRITICAL from category/message text. If your API returns a different response shape, adjust `getRows()` in `app/page.tsx`.

## Notes

- The dashboard keeps the latest 500 records in the browser view. It fetches up to 100 new records per poll; if more than 100 logs arrive between polls, the API's `after_id` pagination means the rest will be fetched in later polls.
- Your FastAPI API must be reachable from Vercel and its `GET /logs` endpoint must accept the `X-API-Key` header.
- Logs and API keys are not bundled into the frontend. The Next.js route at `/api/logs` proxies requests server-side.
