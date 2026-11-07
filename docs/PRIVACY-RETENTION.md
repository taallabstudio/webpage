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
| Date of birth and age classification | Stored after email verification and sign-in; retained with the active account while needed for age safeguards and parent/guardian controls | User cannot self-edit after submission; correction requests require support review and identity checks |
| Privacy-request records | As needed to document and respond to the request and meet accountability obligations | Periodic manual review; no fixed automatic purge until an approved accountability period is set |
| Terms and Privacy acceptance records | As needed to demonstrate which policy versions were accepted | Periodic manual review; no automatic purge currently configured |
| Parent-link invitations | Single-use token expires after 24 hours; invitation metadata is deleted 30 days after expiry | Hourly Worker cleanup |
| Parent-child link and parental-consent history | While the link is active; revoked link rows, withdrawn consent records and associated events are retained for up to two years after withdrawal unless a legal hold or other legal obligation requires longer | Hourly Worker cleanup removes eligible revoked links, consent records and events |
| Child permission settings | Stored only while the parent-child link is active; deleted on withdrawal | Withdrawal endpoint deletes the settings row; missing settings always mean all permissions are off |
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
- The app now asks for date of birth only after email verification and the user's first subsequent sign-in. It classifies accounts as adult or child; child accounts remain pending parent/guardian setup.
- Child and unclassified accounts are blocked from protected account APIs, store checkout creation and payment verification. Adult-only payment access is enforced in the Worker, not only in the UI.
- Parent-link invitations, consent capture, parent dashboard, four independent permission settings and consent withdrawal are implemented. A link remains pending and child access remains blocked until an authorised administrator records a separate manual identity, age and parent/guardian relationship review. The app itself does not perform identity verification; local legal review and a documented staff procedure remain outstanding. Tutorial playback integration is also outstanding because the repository has no tutorial catalogue or player. Child-account deletion remains a verified human-review process, not an automatic action.
- Date of birth is user-supplied age screening, not proof of parent identity, legal age or parental authority. Parent attestation and the child account acceptance are recorded but do not constitute independent identity verification.\n- No marketing email campaign or marketing subscription list is implemented in this repository. Marketing emails must remain disabled; only transactional/security emails are currently used. Do not add marketing sends until separate opt-in and one-click unsubscribe are implemented.
