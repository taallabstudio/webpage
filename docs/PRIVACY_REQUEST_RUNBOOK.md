# TAAL LAB privacy request handling runbook

This runbook is for an authorised TaalLab administrator handling requests submitted through Account settings. It is an operational checklist, not legal advice.

## 1. Verify and record the request

1. Open the Admin dashboard → Account settings → Privacy requests.
2. Confirm the request reference, account email and request type.
3. Verify the request using the account email and, where needed, an additional account-authentication step. Do not ask for passwords or one-time codes by email.
4. Change the status to **In review**.
5. Record the verification outcome and the systems checked in the organisation's approved case notes. Do not copy secrets or full file contents into case notes.

## 2. Access and correction requests

- The signed-in user can download an account-data export from Account settings → Privacy & personal data.
- Compare a correction request with the source record and the user's verified evidence.
- Correct only the affected fields. Preserve a record of the correction and its date where accountability requires it.
- If the user asks about Google Drive or Google Calendar content, explain which information is held by TaalLab and which remains in the user's Google account.

## 3. Deletion requests: review before deleting

Do not mark a request completed merely because the request was received. Review each of these data areas:

- Main account record, sign-in sessions, Google identity links, passkeys, authenticator configuration and recovery codes.
- File transfers, transfer metadata and associated Google Drive objects. Check whether an object is still referenced by another active transfer before deleting it.
- OCEAN pages, page shares, comments, uploaded assets and Google Calendar connection. Check collaborator ownership and shared-page access before removing content.
- Digital-store customer profile and order records in the separate store database.
- Marketing preference and consent-event records. A deletion request immediately opts the account out of marketing; preserve only the minimum suppression record needed to honour that choice, and document its retention basis.
- Privacy acceptance and request records, which may be needed to demonstrate the handling of the request.
- Backups, provider-side retention and any legal hold or unresolved payment dispute.

## 4. Preserve records that must be retained

Paid order and payment records may need to be retained for tax, accounting, payment disputes, fraud prevention or other legal obligations. Do not erase or alter those records until the applicable retention requirement has been checked. Where full deletion is not permitted, remove or restrict unrelated profile data and minimise the retained record to what is necessary, where legally allowed. Ask the responsible accountant or legal adviser to confirm the retention period for TaalLab's specific tax status and records.

Do not assume that deleting a row in D1 also deletes a Google Drive object, a Backblaze B2 object, a Google Calendar event, a provider backup or a copy held by a collaborator.

## 5. Complete the request

1. Carry out and verify the required deletion or correction in each applicable system.
2. Confirm that sessions and connected access have been revoked where appropriate.
3. Record what was deleted, what was retained, why it was retained and any provider-side action still pending.
4. Contact the requester at the verified account email with the outcome and any limitations.
5. Only then mark the request **Completed** or **Declined** in the Admin privacy-request queue.

## 6. Operational safeguards

- Never run broad delete statements against production databases without a reviewed, account-scoped plan and a verified backup.
- Never delete a shared storage object while another active transfer references it.
- Never expose password hashes, OAuth refresh tokens, TOTP secrets, recovery-code hashes, passkey public keys or payment credentials in exports or support messages.
- Escalate uncertain legal retention, shared ownership, disputed payments or provider-side deletion to the responsible adviser before completing the request.
