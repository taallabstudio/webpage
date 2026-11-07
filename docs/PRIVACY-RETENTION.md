# TAAL LAB privacy operations and retention schedule

Last reviewed: 7 November 2026
Scope: `taallab.in`, `ocean.taallab.in`, the shared Worker, and the two D1 databases in this repository.

This document records the retention behavior implemented in the application. It is an engineering schedule, not a legal opinion. TaalLab must confirm statutory accounting, tax, consumer, privacy and dispute-retention periods with its qualified adviser before changing or deleting regulated records.

## Implemented automatic retention

| Data class | Current limit | Cleanup behavior |
|---|---:|---|
| User and admin sessions | 7 days | Expired D1 session rows removed by the hourly Worker cleanup. |
| Email verification codes | 10 minutes | Expired rows removed hourly. |
| Two-step verification challenges | 10 minutes | Expired rows removed hourly. |
| Password reset tokens | 30 minutes | Expired rows removed hourly. |
| Google app hand-off codes | 2 minutes | Expired rows removed hourly. |
| Google Calendar OAuth state | Stored expiry | Expired rows removed hourly. |
| Transfer file objects | Transfer's displayed expiry | Worker attempts deletion from connected Google Drive at/after expiry. Failed deletion remains eligible for retry. |
| Transfer and file metadata | 30 days after transfer expiry | Purged after expiry only after associated file records are marked deleted; failed storage deletion keeps the record for retry. |
| Booking anti-abuse identifiers | 30 days after last activity | Old rate-limit rows are removed hourly. |

## Records not automatically deleted

- Account credentials, profile data and OCEAN workspace content remain while the account is active. Account deletion is a recorded request that requires review; it is not an immediate destructive action.
- Store customer profiles remain while needed for account and checkout features, or until a deletion request is reviewed and processed.
- Orders, payment references, invoices/tax data and related evidence must be retained for the period required by applicable accounting, tax, payment-provider and dispute obligations. The exact statutory period must be confirmed for TaalLab's legal and tax status before implementing automatic deletion.
- Policy acceptance and privacy-request records are retained as needed to evidence consent and handle legal claims. A specific fixed purge period requires legal review.
- Data held directly by Google, Razorpay, Cloudflare, Backblaze, Resend, Unsplash or Emoji API is subject to the relevant provider's retention controls and contractual terms.

## User rights workflows

- Signed-in users can download a JSON export from Account Settings. It includes account, transfer/file metadata, policy acceptance, OCEAN page content/comments/shares/assets metadata, Google connection metadata and digital-store customer/order records.
- The export deliberately excludes passwords, session secrets, OAuth refresh tokens, private storage keys and download tokens. It does not include uploaded file bytes or content held directly in third-party accounts.
- Signed-in users can submit an account-deletion request after explicit confirmation. The request is stored in the primary D1 database and an email notification is sent to `contact@taallab.in`; scheduled retries attempt notification again if the provider did not accept it.
- A request is not complete until a verified human review handles related transfers, shared OCEAN content, store records and any legally required retention. The user-facing interface says this clearly.

## Cookie, storage and tracker review

- Essential session cookies support sign-in; local storage holds the shop cart and the privacy-notice dismissal.
- The repository scan on 7 November 2026 found no configured Google Analytics/gtag, Google Tag Manager, Meta Pixel, Hotjar, Microsoft Clarity, Segment, Mixpanel, PostHog, Plausible or Umami integrations.
- Google Fonts is requested as an external font resource. Razorpay and Google authentication resources are contacted when users invoke those features. These are disclosed in the public Privacy Policy and shared notice; they are not presented as optional analytics consent.
- If optional analytics, advertising, session replay or marketing trackers are added, they must not load before the applicable consent is recorded. Add a consent platform and test its blocking behavior before adding any such script.

## Manual review still required

1. Confirm tax/accounting retention periods with TaalLab's accountant or legal adviser.
2. Verify actual DPA acceptance, data-transfer terms, deletion support and account configuration for every provider in `/subprocessors.html`.
3. Confirm how deletion requests should handle shared pages, active transfers, Google Drive objects, Backblaze objects, Razorpay references and records under legal hold.
4. Confirm the process and response deadlines for privacy requests in each jurisdiction where TaalLab offers services.
5. Re-run the provider and code scan whenever dependencies, analytics, advertising or external integrations change.
