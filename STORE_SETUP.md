# TAAL LAB digital store setup

The store is integrated into the existing Cloudflare Worker in `worker/index.ts` via `worker/store.ts`. Keep the transfer database binding `DB` unchanged; the store uses its own `DBStore` binding to the D1 database `taallab-store`.

## Cloudflare bindings and secrets

Set these in the **Worker's production environment** (and in Preview if testing previews):

- D1 binding: `DBStore` → `taallab-store`
- Secret: `B2_KEY_ID`
- Secret: `B2_APPLICATION_KEY` (bucket-restricted, read-only key)
- Variable: `B2_BUCKET_NAME=taallab-product-files`
- Secret: `DOWNLOAD_SIGNING_SECRET` (random, high-entropy value)
- Secret: `RAZORPAY_KEY_ID` (Test Mode key ID while testing)
- Secret: `RAZORPAY_KEY_SECRET` (Test Mode secret while testing)

Do not put secrets in this repository or in `wrangler.toml`. The Razorpay key ID is returned by the server only when creating a checkout order. Use Razorpay Test Mode until checkout, signature verification and private downloads have been tested end to end.

## Wrangler configuration

`wrangler.toml` declares `DBStore` for the production Worker only. No preview D1 database or preview `DBStore` binding is configured. Store changes should be tested and deployed through the main branch workflow as requested. Keep the existing `DB` transfer binding unchanged.

## Store files and product catalogue

- `public/shop.html` — product listing.
- `public/checkout.html` — Razorpay checkout.
- `public/download.html` — time-limited download link page.
- `worker/store.ts` — product catalogue, order creation, payment verification and private B2 streaming.
- `store-schema.sql` — optional SQL for the store-only order table.

The Worker creates the `store_orders` table if it does not exist. If you use the SQL Console manually, run `store-schema.sql` against **taallab-store only**. Do not run it against `taallab-transfers`.

## Backblaze B2

Keep bucket `taallab-product-files` private. Upload each product to the exact key in `worker/store.ts`:

- `products/lab-2a.zip`
- `products/starter-sample-pack.zip`
- `products/cinematic-sound-library.zip`

The product catalogue is intentionally inactive and all example prices are zero. Do not activate a product until its real file is uploaded, its price is set, and a test purchase/download has succeeded. Never share the B2 application key or make the bucket public.

## Routes

- `GET /api/store/products`
- `POST /api/store/create-order`
- `POST /api/store/verify-payment`
- `GET /api/store/download?token=...`

Payment verification checks the Razorpay signature and confirms the payment amount, currency and order with Razorpay before marking the order paid. Download tokens are HMAC-signed and expire after 30 minutes. Downloads require a matching paid order and stream from private B2 storage.

## Testing checklist

1. Confirm production `DBStore` points to `taallab-store` and the existing `DB` still points to `taallab-transfers`.
2. Confirm the listed secrets exist in the Cloudflare Worker environment; never paste their values into GitHub or chat.
3. Confirm `GET /api/store/products` returns the inactive sample catalogue.
4. Confirm inactive products cannot create a Razorpay order.
5. When a real product file and price are configured, test checkout using Razorpay Test Mode.
6. Confirm invalid signatures and unpaid orders cannot download.
7. Confirm a valid paid test order streams the file from the private B2 bucket.
8. Confirm TrackDeliver login, transfers, upload/download and booking still work.

The store is not ready for real sales until these checks pass and products are explicitly activated.