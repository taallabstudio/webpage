# Child account and age-screening implementation

Last reviewed: 7 November 2026  
Repository: `taallabstudio/webpage`

## Agreed product rules

- Public visitors may browse the tutorial catalogue, but must sign in to watch any tutorial.
- Account sign-up and email verification happen before asking for date of birth.
- Date of birth is requested at the first signed-in account visit after email verification.
- Adult accounts may continue to normal account features.
- Accounts with a user-supplied date of birth indicating under 18 are placed in a pending parent/guardian setup state.
- Child accounts must never be able to make purchases or initiate payments. Parent/guardian consent does not enable payment capability on the child's own account; any purchase arrangement must be handled through an adult account.
- Child access to tutorials must require login, verified parent/guardian consent and a valid tutorial entitlement.

## Implemented

- Added `users.date_of_birth`, `users.account_type`, `users.parental_consent_status` and `users.parent_user_id` columns using the Worker schema bootstrap.
- Added authenticated `POST /api/account/date-of-birth`. It requires a verified email, validates a real non-future date, stores it once and classifies the account using the 18-year threshold.
- Added a post-sign-in date-of-birth screen in the account portal.
- Parent accounts must be separately email-verified and age-screened as adult before they can send an invitation.
- Parent invitation requires an explicit parent/legal-guardian attestation. The invitation is single-use, hashed at rest, expires after 24 hours and is sent to the child's verified account email.
- The child must sign in to their own account and accept the invitation. The parent cannot take over the child's account.
- Acceptance creates a pending link only. The child remains blocked from protected account features until an authorised TaalLab administrator records a separate manual identity, age and parent/guardian relationship review. Parent permission toggles remain disabled until that review is approved.
- Consent records capture parent/child account references, policy version, permission scope, timestamp and method. Separate events record link acceptance, permission changes and withdrawal.
- The parent dashboard provides four independent permissions: tutorial viewing, lesson-material downloads, comments/discussions, and uploads/sharing. All start off.
- Purchases and payments are always disabled for child accounts, regardless of parent settings.
- Consent withdrawal disables all four permissions, revokes the active link, marks consent history withdrawn and deletes active child sessions.
- Account-data exports include parent-child links, invitations, consent records and permission/consent history.
- Expired invitations are deleted 30 days after expiry. Withdrawn consent records and permission/consent events are retained for up to two years, subject to legal holds and obligations.
- The shared `requireUser` guard blocks child accounts unless the parent link is active in the user's consent state. Store order creation and payment verification require an adult-classified account on the server.

## Remaining P1 limitations — do not describe as complete

1. **Independent adult/parent verification:** the application does not itself verify government ID or legal parental authority. The admin queue requires a separate manual review outside the app before child access is enabled. TaalLab must define approved evidence, staff roles, escalation, review logging and legal adequacy with counsel; a suitable verification provider may be preferable.
2. **Tutorial system integration:** this repository has no tutorial catalogue, lesson-material library, discussion feature or tutorial playback route. A child tutorial-access endpoint checks the parent toggle and a valid entitlement, but no catalogue/entitlement assignment or player exists yet. The other three permissions are stored and exposed for future content routes; they cannot be enforced by content features that do not exist in this repository.
3. **Automated authorization tests:** add integration tests for pending/consented/withdrawn child access, each permission, parent ownership, invitation expiry/replay and payment rejection.
4. **Legal review:** obtain local legal review of age assurance, parental authority, consent scope, child-data minimisation, retention and withdrawal before enabling child accounts in production.
5. **Deletion fulfilment:** the account deletion request is an intake and human-review process. It does not automatically erase the account, provider-side copies, backups or legally retained records.

## Security rules

- Do not change a child account to a consented state manually.
- Do not treat the adult age-screening flow as identity verification.
- Keep every child permission disabled unless a parent explicitly enables it.
- Do not enable tutorial playback until the content route checks login, active parent link, the relevant permission and a valid entitlement on the server.
- Never enable checkout or payment endpoints for child accounts.
## Safety state

Until items 1–8 are implemented and reviewed, child accounts stay pending and cannot use protected account features or purchase/payment endpoints. Do not manually change a child account to `parental_consent_status='verified'` as a workaround.
