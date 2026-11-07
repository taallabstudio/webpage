# TAAL LAB — Policy acceptance record runbook

Last reviewed: 7 November 2026

## Current versions

- Terms of Service: 2026-11-07.2
- Privacy Policy: 2026-11-07.6

Keep these values aligned across:
- worker/index.ts policy constants and Google OAuth validation;
- worker/store.ts checkout acceptance constants;
- src/AppPages.jsx Google signup URL;
- the effective-version labels on public/terms.html and public/privacy.html.

## Where acceptance is recorded

- Email signup: the required Terms/Privacy checkbox is validated by the Worker and the accepted versions, timestamp and method are written to policy_acceptances.
- Google signup: the OAuth start flow carries the current versions and a short-lived consent cookie; the callback validates it before creating a new account and records the acceptance.
- Store checkout: the required checkbox is validated by the store Worker and the accepted versions and timestamp are written to the order record.
- Marketing consent is separate and must never be inferred from policy acceptance.

## Existing accounts and future changes

Historical acceptance records are immutable. A user who accepted an earlier version remains recorded against that earlier version; do not silently rewrite the record to a newer version.

The current application does not yet force all existing users to re-accept a newly published policy version before every sign-in. For a future material policy change that requires affirmative re-acceptance, implement and test a policy-update gate for email, Google and passkey sign-in before publishing the new version. Do not merely change the constants and assume existing users have accepted the new text.

Every store checkout continues to request acceptance of the current Terms and Privacy versions.


## Outstanding acceptance gap

The current record covers self-service email signup, Google signup and store checkout. It does not yet record the end user's acceptance when an administrator provisions an account through the managed-user or transfer-recipient flows (or the initial setup flow). Do not record an administrator's action as if it were the user's consent. Before treating every account path as covered, implement a first-login policy-acceptance gate for administrator-provisioned accounts and test email, Google and passkey sign-in. Until then, describe the acceptance record as covering the self-service signup and checkout paths only.
