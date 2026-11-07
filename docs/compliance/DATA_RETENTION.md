# Data retention schedule

Last reviewed: 7 November 2026
Repository: `taallabstudio/webpage`

This schedule reflects the current code paths in this repository. It is not a statement that every external provider has the same retention setting.

| Data category | Current handling | Retention / deletion trigger |
|---|---|---|
| User sessions | Expired session rows are removed by the hourly Worker cleanup. | Session lifetime is 7 days; expired rows are purged hourly. |
| Admin sessions | Expired admin-session rows are removed by the hourly Worker cleanup. | Expiry is stored per session; expired rows are purged hourly. |
| Email verification tokens | One-time verification tokens are deleted after use or expiry. | 10 minutes. |
| Two-factor challenges | One-time challenges are deleted after use or expiry. | 10 minutes. |
| Password reset tokens | One-time reset tokens are deleted after use or expiry. | 30 minutes. |
| Google app login codes | Short-lived one-time codes are deleted after use or expiry. | 2 minutes. |
| File-transfer content | Expired Drive objects are permanently deleted when no other unexpired transfer references them. Failed deletion is retried by the hourly cleanup. | Per-transfer expiry setting; default is 7 days. |
| File and transfer metadata | Expired transfers/files are marked deleted and their metadata is purged after the operational grace period. | 30 days after expiry, provided storage deletion has succeeded or the object remains referenced by another unexpired transfer. |
| Abandoned unpaid store orders | Unpaid orders without a payment ID are purged by store cleanup. | 30 days. |
| Paid orders and payment records | Retained for accounting, tax, payment disputes, fraud prevention and legal obligations. | No fixed automatic deletion period is currently configured; obtain accountant/legal advice and implement a documented period. |
| Saved customer profiles | Stored only when the customer selects the save-details option. | Until updated or deleted through an account/data request; no automatic inactivity expiry is configured. |
| Account records and security methods | Retained while the account is active. | Manual account deletion request and applicable legal/security retention exceptions; no automatic inactive-account purge is configured. |
| OCEAN pages, comments, shares and assets | Retained while associated with the account/page. | Manual account/content deletion request; no automatic inactivity expiry is configured. |
| Marketing unsubscribe tokens | Expired or used tokens are removed by hourly cleanup. | Tokens expire after 365 days; used tokens are purged after 30 days. |
| Age confirmations and marketing preferences | Stored as minimal account-level records. | Retained while the account exists; remove during account deletion processing. |
| Privacy requests and policy-notice log | Kept to document requests, decisions and required notices. | No automatic expiry is configured; retention period needs owner/legal approval. |
| Provider-side copies and logs | Governed by the relevant provider settings and contract. | Must be verified separately in Cloudflare, Google, Backblaze, Resend, Razorpay, Unsplash and Emoji API accounts/agreements. |

## Important limits

- A transfer expiring does not mean every related database row is immediately erased. The code uses a 30-day operational grace period and retries storage deletion if it fails.
- A privacy request is queued for review; the current application does not automatically erase every related record across both D1 databases and external storage. The administrator must review shared content, purchases and legal retention requirements.
- Paid order records, account records, saved profiles, OCEAN content and privacy-request records do not yet have complete automatic deletion periods.
- Do not promise immediate or complete erasure until the manual deletion process and provider-side deletion have been completed and verified.

## Owner/legal actions

1. Ask the accountant/legal adviser to approve a fixed retention period for paid order, tax and payment records.
2. Approve a retention period for resolved privacy requests and policy-notice records.
3. Define an inactive-account deletion policy and implement a safe process across the transfer DB, store DB, Google Drive, Backblaze and OCEAN.
4. Verify and record provider-side retention/deletion settings and contractual commitments.
