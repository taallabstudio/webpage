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

## Implemented in this phase

- Added `users.date_of_birth`, `users.account_type`, `users.parental_consent_status` and `users.parent_user_id` columns using the Worker schema bootstrap.
- Added authenticated `POST /api/account/date-of-birth`. It requires a verified email, validates a real non-future date, stores it once and classifies the account using the 18-year threshold.
- Added a post-sign-in date-of-birth screen in the account portal.
- Pending child and unclassified accounts are blocked by the shared `requireUser` authorization helper from protected account APIs.
- Store order creation and payment verification require an adult-classified account on the server.
- Added the process to the public Terms and Privacy Policy.

## Not yet implemented — do not describe as complete

1. Parent/guardian account creation and secure child-account linking.
2. Verification that the parent/guardian is an adult and has authority to consent. Date of birth entered by the child is not sufficient.
3. A consent record containing parent identity reference, child account, policy version, consent scope, timestamp, verification method and withdrawal status.
4. Parent dashboard to view linked children, permissions and account status.
5. Parent consent withdrawal and account deletion workflows.
6. Child-specific tutorial catalogue/playback authorization: logged-in status + verified parental consent + entitlement check.
7. Automated tests for child/adult/pending-consent authorization and payment rejection.
8. Legal review of age assurance, consent and data minimisation under applicable Indian law before enabling child accounts.

## Safety state

Until items 1–8 are implemented and reviewed, child accounts stay pending and cannot use protected account features or purchase/payment endpoints. Do not manually change a child account to `parental_consent_status='verified'` as a workaround.
