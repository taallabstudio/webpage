# TAAL LAB — Internal privacy retention schedule

Last reviewed: 7 November 2026  
Scope: `taallab.in`, `ocean.taallab.in`, TrackDeliver/file transfers, OCEAN and the digital store.

This schedule records the retention behaviour implemented in the application. It is an operational control document, not a substitute for confirming statutory accounting, tax, provider or mailbox retention obligations.

| Data category | Retention rule | Deletion / review mechanism |
|---|---|---|
| Sign-in sessions | Maximum 7 days | Hourly Worker cleanup |
| Email verification tokens | 10 minutes | Hourly Worker cleanup |
| Two-factor challenges | 10 minutes | Hourly Worker cleanup |
| Password-reset tokens | 30 minutes | Hourly Worker cleanup |
| Passkey/WebAuthn challenges | 2 minutes | Hourly Worker cleanup |
| Temporary Google app sign-in codes | 2 minutes | Hourly Worker cleanup |
| OCEAN Google Calendar OAuth state | Short-lived; expiry is stored with the state | Hourly Worker cleanup |
| File contents in Google Drive | Until the transfer expiry shown to the sender/recipient | Worker moves expired objects to Google Drive trash; failures remain eligible for retry |
| Transfer and file metadata | 30-day operational grace period after expiry | Hourly Worker cleanup after successful storage retirement |
| Unpaid/abandoned digital-store orders | 30 days from creation | Hourly Store cleanup |
| Paid orders and payment records | Only as long as needed for accounting, tax, payment disputes, fraud prevention and legal obligations | Manual review; confirm exact statutory periods with the accountant/legal adviser before implementing automatic deletion |
| Booking anti-abuse identifiers (email and IP) | Up to 1 year after last use | Hourly Worker cleanup |
| Account profile and OCEAN content | While the account remains active; following a verified deletion request, review and erase data no longer needed | Human review through the privacy-request queue; shared content, legal holds and provider-side copies require case-by-case handling |
| Privacy-request records | As needed to document and respond to the request and meet accountability obligations | Periodic manual review; no fixed automatic purge until an approved accountability period is set |
| Terms and Privacy acceptance records | As needed to demonstrate which policy versions were accepted | Periodic manual review; no automatic purge currently configured |
| Booking enquiry emails | In the business mailbox while needed to respond to the enquiry and manage any resulting engagement | Mailbox review and management; automatic mailbox deletion is not configured in this repository |
| Provider backups and external service records | According to the relevant provider's actual retention/deletion settings and agreements | Verify in each provider console and applicable DPA; do not assume application deletion immediately removes provider backups |

## Operational requirements

1. The scheduled Worker cleanup runs hourly. It must not delete transfer metadata while a failed Google Drive deletion is still awaiting retry.
2. A privacy deletion request is an intake and human-review workflow. Do not mark it completed until identity is verified, the appropriate erasure/revocation work is performed, and any retained records are documented.
3. Never automatically purge paid-order records until TaalLab's accountant/legal adviser confirms the applicable statutory retention period and invoice obligations.
4. Verify deletion and retention settings in Cloudflare, Google, Resend, Razorpay and Backblaze accounts. Published provider links are not proof that TaalLab has accepted or signed a DPA.
5. Revisit this schedule before the relevant India DPDP provisions commence and whenever a provider, data category or product feature changes.

## Known manual follow-ups

- Confirm statutory retention periods for invoices, paid orders and payment records.
- Confirm the legal basis and exact retention period for privacy-request and policy-acceptance records.
- Review the contact mailbox retention policy for booking enquiries.
- Verify provider-side deletion, backups, regional processing and DPA settings.
- Decide and implement the adult-only versus verifiable parental-consent product policy before collecting children's personal data.
