# TaalLab Transfer — GitHub Pages + Cloudflare backend

This version is designed specifically for the existing `https://taallab.work` GitHub Pages site.

## Architecture

- GitHub Pages: public frontend at `taallab.work`
- Cloudflare Worker: `/api/*` and `/f/*`
- Cloudflare D1: metadata, sessions, counters
- Cloudflare R2: private files
- Cloudflare Cron: hourly expiration cleanup

GitHub Pages supports custom domains and GitHub Actions-based builds. The included workflow builds the Vite app and deploys `dist`. citeturn0search1turn0search3

Cloudflare R2 presigned URLs are used for direct browser uploads/downloads, so R2 credentials never reach the browser. R2 officially supports GET/PUT presigned URLs, and Cloudflare documents `aws4fetch` for Workers. citeturn1search0turn1search1

## 1. GitHub Pages

Put this project in the repository currently serving `taallab.work`.

Enable **Settings → Pages → Source: GitHub Actions**. The included `.github/workflows/pages.yml` builds and deploys the site. GitHub documents this Pages workflow approach. citeturn0search3turn0search7

Keep the included `CNAME` file. If your Pages custom domain is already configured as `taallab.work`, do not change your DNS just for the frontend.

## 2. Cloudflare

Create:

- R2 bucket: `taallab-transfers`
- D1 database: `taallab-transfers`
- Worker: `taallab-transfer-api`

Run:

```bash
npm install
npx wrangler d1 migrations apply taallab-transfers --remote
npx wrangler deploy
```

Create R2 API credentials with permission for the transfer bucket. Store them only as Worker secrets:

```bash
npx wrangler secret put ADMIN_PASSWORD_HASH
npx wrangler secret put SESSION_SECRET
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
```

Set `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, and your D1/bucket IDs in `wrangler.toml`.

Generate the admin password hash with:

```bash
node scripts/hash-password.mjs
```

Paste the resulting `pbkdf2$...` value into `ADMIN_PASSWORD_HASH`.

## 3. Route Worker backend paths

The cleanest setup is to keep the same public domain:

- `https://taallab.work/` → GitHub Pages
- `https://taallab.work/d/...` → GitHub Pages client UI
- `https://taallab.work/admin` → GitHub Pages admin UI
- `https://taallab.work/api/...` → Cloudflare Worker
- `https://taallab.work/f/...` → Cloudflare Worker

If `taallab.work` is proxied through Cloudflare DNS, add Worker routes for `/api/*` and `/f/*`. Do not route the whole domain to the Worker because GitHub Pages needs to continue serving the frontend.

If your DNS is not currently on Cloudflare, use a backend subdomain such as `api.taallab.work` instead and change `API_ORIGIN` in `src/main.jsx` accordingly.

## 4. R2 CORS

Apply `public/r2-cors.json` to the R2 bucket. Cloudflare recommends CORS when browser clients use presigned R2 URLs. citeturn1search1

## 5. Expiration

Every transfer and file receives a seven-day server-side expiration timestamp. The Worker Cron runs hourly and deletes expired R2 objects and invalidates their D1 records. Cloudflare Cron Triggers invoke a Worker `scheduled()` handler independently of page visits. citeturn0search0

## 6. Important download behavior

- Opening a transfer page does not increment downloads.
- Audio/video/image previews do not increment downloads.
- `/f/:token` verifies transfer + file + expiration + R2 object, then increments the file counter and redirects to a short-lived R2 presigned URL.
- Download-all requests a list of individual file endpoints so each actual download remains countable. It does not attempt to build a multi-GB ZIP in the Worker.

## 7. GitHub Pages route fallback

The client transfer route `/d/:id` is handled by the app's fallback page, so the browser can retain the clean URL while GitHub Pages serves the static application.
