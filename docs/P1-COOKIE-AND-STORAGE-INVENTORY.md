# P1 Cookie and Browser Storage Inventory

Review date: 7 November 2026  
Repository: `taallabstudio/webpage`  
Branch: `main`

## Observed implementation

This is a source-code inventory, not a browser/network penetration test.

| Mechanism | Observed use | Classification / notes |
|---|---|---|
| Worker session cookie | Keeps authenticated users signed in; Worker cookie helper sets session attributes and expiry | Essential authentication storage |
| `taallab.store.cart.v1` | Remembers the digital-shop cart in browser local storage | Functional storage |
| `ocean-theme` | Remembers the OCEAN interface theme | Functional preference |
| `ocean-recent-emojis` | Remembers recently used emojis in OCEAN | Functional preference |
| `taallab.essential-storage-notice.v1` | Remembers dismissal of the essential-storage notice | Notice preference |

The shop and checkout pages already had an informational essential-storage notice. The main React application entry now displays the same notice so it is available on the studio/app/OCEAN routes as well. The notice can be dismissed and links to the Privacy Policy. Dismissing it is not treated as consent to tracking.

## Third-party requests and verification limits

Source references show integrations or external requests involving Google Fonts, Google sign-in, Google Drive, Google Calendar, Razorpay checkout and feature-specific APIs. These may make provider requests when the relevant page or feature is used. This source review did not capture live browser network traffic, inspect provider-set cookies, or verify every third-party script at runtime.

No optional advertising or analytics tracker was identified in the inspected source paths. This is not a guarantee that no provider or future deployment can set additional storage. Recheck network requests and response headers in production after changes to integrations.

## Current user-facing notice

The notice explains essential session cookies and local storage used for functional preferences. It is informational only; no non-essential tracking consent is being requested because no optional advertising or analytics tracker was identified in this source review.

## Follow-up checks

- Re-run a browser storage and network audit on `taallab.in`, `ocean.taallab.in`, shop and checkout.
- Inspect cookie attributes (Secure, HttpOnly, SameSite, Path, Domain, expiry) against the deployed Worker responses.
- Reassess the notice and consent design before introducing analytics, advertising pixels, or any other non-essential storage.
- Confirm the privacy notice remains aligned with production behavior and provider integrations.

## Scope

This inventory records observed source behavior only. It is not legal advice, a full compliance certification, or proof that all third-party behavior has been exhaustively inspected.
