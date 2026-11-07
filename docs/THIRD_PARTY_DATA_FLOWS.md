# Third-party SDK, analytics and data-flow audit

Reviewed: 7 November 2026  
Repository: `taallabstudio/webpage`

## External providers found in the inspected code

| Provider / SDK | Trigger | Data or access involved | Purpose |
|---|---|---|---|
| Cloudflare Pages, Workers and D1 | Every site/app request | Request metadata, application/database records | Hosting, edge runtime, databases and delivery |
| Google Fonts | Pages loading remote font stylesheets | Browser request metadata such as IP address and user-agent | Typography |
| Google OAuth | User selects Google sign-in | OAuth authorization data and Google account identifiers | Authentication |
| Google Drive API | TaalLab transfer-storage operations | File contents, file names and storage metadata | Store and deliver transferred files |
| Google Calendar API | User chooses OCEAN Calendar connection/features | OAuth account details, calendar list/event data and refresh token (stored encrypted) | Calendar integration |
| Resend | Verification, sign-in/security, password reset, transfer/purchase and booking email | Recipient addresses, message contents and delivery metadata | Transactional and booking email |
| Razorpay Checkout | User proceeds to payment | Order reference, amount, currency and payment/customer details submitted by checkout | Payment processing |
| Backblaze B2 | OCEAN asset and digital-product storage operations | Uploaded asset/product file contents and object metadata | Object storage |
| Unsplash API | User searches for or selects an OCEAN cover photo | Search terms, selected photo identifiers and required download-event call | Cover-photo search |
| Emoji API | User searches/browses the OCEAN emoji picker | Emoji search terms | Emoji search |

## SDKs and libraries that do not themselves represent a separate data processor

- React, React DOM and Lucide React render the user interface.
- SimpleWebAuthn browser/server implement WebAuthn/passkey flows.
- Tauri API and plugins support desktop-app functionality such as deep links and opening URLs.
- aws4fetch signs storage/API requests.
- qrcode renders QR codes.
- Vite, TypeScript, Wrangler and Sharp are build/development tooling.

These libraries may still require licence review, but the inspected code does not show them independently transmitting customer content to an analytics or advertising service.

## Analytics and tracking

No Google Analytics, Meta Pixel, advertising SDK, session-replay tool, behavioural analytics tag or tracking-pixel integration was found in the inspected repository. The current cookie/storage notice therefore describes essential session storage and the local shop cart, not optional analytics/advertising consent.

Google Fonts, OAuth, payment checkout and feature-specific APIs still make external provider requests when their pages/features are used. These functional requests are disclosed in the Privacy Policy and Subprocessors page.

## Outstanding operational checks

- Verify the exact Cloudflare, Google, Resend, Razorpay and Backblaze account products/regions in use.
- Confirm whether each applicable provider DPA is accepted/signed and whether any international-transfer addendum or transfer mechanism is required.
- Confirm provider-side retention, logging and deletion settings.
- Re-run this audit whenever an SDK, analytics tag, payment provider, storage provider or integration is added.
- Do not add optional analytics or advertising scripts without a consent gate that blocks them until valid consent is recorded.
