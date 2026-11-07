# TAAL LAB — Third-party SDK, API and tracking audit

Last reviewed: 7 November 2026

Scope: repository-visible scripts, package dependencies, Worker integrations and public pages. This is a source-code audit, not a provider-console or network-traffic penetration test.

## Runtime integrations identified

| Provider / domain | How it is used | Data or request context | Optional tracker? |
|---|---|---|---|
| Google Fonts (fonts.googleapis.com, fonts.gstatic.com) | Website typography | Browser request metadata, including IP address and user-agent information | No advertising/analytics tracker; third-party font request is disclosed in the Privacy Policy. |
| Google (accounts.google.com, oauth2.googleapis.com, www.googleapis.com) | Google sign-in, Drive and Calendar APIs | Authentication identifiers, OAuth scopes/tokens and feature data needed for the requested integration | Feature-specific service integration, not an analytics tracker. |
| Razorpay (checkout.razorpay.com) | Payment checkout | Checkout and payment data handled under Razorpay's service terms | Payment provider, not an analytics tracker. |
| Resend (api.resend.com) | Verification, security, transactional and opted-in marketing email; booking enquiry delivery | Recipient email and message content/metadata | Email delivery provider, not an analytics tracker. |
| Backblaze (api.backblazeb2.com and configured B2 endpoints) | Private product-file storage | Product files and storage metadata | Storage provider, not an analytics tracker. |
| Unsplash (api.unsplash.com) | OCEAN cover-photo search and required download-event request | Search terms, photo IDs and download events | Feature API; not used as an advertising pixel. |
| Emoji API (emoji-api.com) | OCEAN emoji search | Search terms and category requests | Feature API; not used as an advertising pixel. |
| Cloudflare | Hosting, Worker runtime, D1 and delivery infrastructure | Request, application and database data needed to operate the service | Infrastructure provider; review provider-side logs and settings separately. |

## Tracking findings

- No Google Analytics, Google Tag Manager, Meta Pixel, TikTok Pixel, Hotjar, Microsoft Clarity, Segment, Mixpanel, Amplitude, PostHog or similar optional analytics/advertising integration was found in the reviewed source.
- No optional advertising or analytics script is currently loaded by the public pages.
- The essential-storage notice is informational because the reviewed site uses only essential session/storage features and no optional advertising/analytics trackers. Dismissing it is not recorded as consent to tracking.
- If an optional tracker is proposed, it must not load, send events or set non-essential storage before the applicable consent is obtained. Add a consent-management control and test both accepted and rejected states before enabling it.
- The dependency licence scanner inventories npm package metadata; it does not prove that every package is safe, does not identify all runtime network calls and does not replace browser network inspection.

## CI guard

The compliance workflow runs a source scan for known analytics and advertising script domains/functions. This is a guard against accidental introduction, not a substitute for reviewing new integrations, provider SDKs, network requests or browser storage.

## Manual verification still required

1. Inspect production browser network requests and storage on taallab.in and ocean.taallab.in, including logged-in and logged-out flows.
2. Inspect Cloudflare, Google, Resend, Razorpay, Backblaze, Unsplash and Emoji API account settings for optional analytics, telemetry, retention and data-sharing options.
3. Re-run the audit whenever a new external script, SDK, API or provider is added.
4. Keep the published [subprocessor list](/subprocessors.html) and [DPA register](DPA-REGISTER.md) in sync with actual production integrations.
