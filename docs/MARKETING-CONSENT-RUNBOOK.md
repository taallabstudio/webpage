# TAAL LAB — Marketing consent and unsubscribe runbook

Last reviewed: 7 November 2026

## Consent rules

- Marketing consent is optional, unchecked by default and separate from accepting the Terms of Service and Privacy Policy.
- Email signup records consent only when the user explicitly checks the marketing option.
- Google sign-up does not carry marketing consent through the OAuth redirect; users can opt in later from Account Settings.
- Account Settings allows a user to opt in or opt out at any time.
- A verified email address is required before a marketing email can be sent.
- Account verification, password recovery, security and purchase messages are service messages and are not disabled by marketing unsubscribe.
- A deletion request immediately records an unsubscribe choice while the request is being reviewed.

## Sending a marketing campaign

There is no bulk marketing-campaign UI in the current application. Do not send bulk marketing campaigns directly from the Resend dashboard unless the recipient list has been independently checked against the current consent and suppression records.

Any future application campaign must use the guarded sendMarketingEmail helper in worker/index.ts. The helper:
- checks that the user has an active marketing opt-in and a verified email;
- adds a visible unsubscribe link to HTML and plain-text bodies;
- adds List-Unsubscribe and List-Unsubscribe-Post headers;
- uses a stable idempotency key per campaign and recipient.

Pass a stable, unique campaign identifier as campaignId. Do not reuse it for a different campaign.

## Unsubscribe paths

1. Account Settings -> Email preferences.
2. The unsubscribe link in every marketing email.
3. One-click unsubscribe through the List-Unsubscribe-Post header.

Unsubscribe updates the marketing preference and appends an event to marketing_consent_events. Do not remove an unsubscribe/suppression record merely to make a future campaign easier to send.

## Operational checks before a campaign

- Confirm the campaign audience is limited to users with subscribed=1 and a verified email.
- Confirm the email content identifies TaalLab and includes the unsubscribe link.
- Confirm one-click unsubscribe works from a real delivered test email.
- Confirm account/security/purchase emails remain unaffected.
- Confirm bounce, complaint and provider suppression handling in the Resend account.
- Retain campaign content, campaign ID, send date and audience query for accountability.
