# TAAL LAB — P1 privacy, accessibility and trust review

Last reviewed: 7 November 2026  
Repository reviewed: `taallabstudio/webpage` (main)

This is an implementation review, not a legal opinion or a certification of compliance. Findings below are based on the repository source. External provider settings, ownership evidence and real-device/manual testing cannot be proven from source code alone.

## Implemented in the repository

- Privacy Policy and Terms of Service are published and linked from the site.
- The site displays an essential-storage notice. The application currently uses essential session cookies and local storage for the shop cart and interface preferences. No optional advertising or analytics trackers were found in the reviewed landing, shop and account source. The notice is informational; it is not a consent manager for optional trackers. If optional tracking is introduced, implement granular opt-in before loading it.
- Account data export is available from account settings. The export now includes parent-child links, invitations, consent records and permission-change history.
- Account correction/deletion requests can be submitted from account settings and reviewed in the authenticated admin queue. Fulfilment is a human-reviewed process; a request is not an automatic erasure.
- A retention schedule is documented. Parent invitation tokens expire after 24 hours and invitation metadata is removed 30 days after expiry. Withdrawn parent-child link rows, consent records and audit events are eligible for deletion after two years, subject to legal holds and obligations. Child permission settings are deleted on withdrawal.
- Child accounts cannot purchase or initiate payments. This is enforced server-side in store order creation and payment verification.
- Parent linking requires a separate adult-classified account with verified email, parent/legal-guardian attestation, an expiring single-use invitation to the child's verified email, and acceptance from the child's own signed-in account. Acceptance remains pending; an authorised TaalLab administrator must record an independent manual identity, age and relationship review before child access is enabled. Parent toggles remain disabled while verification is pending.
- Four child permissions are independently controlled and default off: tutorial viewing, lesson-material downloads, comments/discussions, and uploads/sharing. Consent withdrawal revokes the link, deletes permission settings and active child sessions, and records the withdrawal.
- Keyboard focus indicators are present globally. The studio navigation dropdown opens on focus as well as hover; the mobile navigation button exposes `aria-expanded`. Skip links were added to the studio homepage and shop.
- Small-text colour values in the main app stylesheet and shop stylesheet were darkened in selected muted-text roles to improve contrast.
- The reviewed homepage and shop source did not contain countdown timers, false scarcity claims or customer testimonial/logo walls. The homepage's booking cooldown is tied to the server's real anti-abuse rate limit; it is not a sales countdown.
- Reviewed image elements have alternative text. Decorative logo/headphone/preview images intentionally use empty alt text and are hidden from assistive technology; content images use descriptive text. Unsplash cover images include photographer and source attribution links.

## Marketing email status

No marketing campaign sender or marketing list was found, so no marketing emails are currently sent. Account settings now provide a separate adult-only opt-in, unchecked by default, with versioned consent records. The Worker provides a public one-click unsubscribe POST endpoint; the GET page requires a confirmation click so email-security scanners do not silently unsubscribe users. A future sender must add the per-user unsubscribe URL and RFC 8058 `List-Unsubscribe` and `List-Unsubscribe-Post` headers before any campaign is sent. Transactional/security messages remain separate from marketing.

## Asset and software licensing review

- Google Fonts are used for Roboto, Inter and Space Grotesk. Google Fonts documents that its families use open-source font licences (including OFL, Apache and UFL); the exact family metadata and licence file should still be recorded for each font version used: https://googlefonts.github.io/gf-guide/metadata.html and https://googlefonts.github.io/gf-guide/googlefonts.html
- OCEAN obtains cover images through the Unsplash API and stores photographer/source attribution URLs. Unsplash's general licence permits commercial and non-commercial use, but depicted people, trademarks, artwork and property can involve separate rights: https://unsplash.com/license and https://help.unsplash.com/en/articles/2612329-releases-and-trademarks
- The Unsplash API attribution guidance asks applications to attribute the photographer and link to the photographer and Unsplash with referral parameters. The reviewed OCEAN selection and cover display code implements this: https://help.unsplash.com/en/articles/2511315-guideline-attribution
- The owner confirmed on 7 November 2026 that Taal Lab holds permission/licence to use `public/logo.png` and `public/studio.webp`, and that `public/headphones.webp` was AI-generated by the owner. This owner confirmation is recorded in `docs/P1-LICENSE-AND-COPYRIGHT-REVIEW.md`; it is not independent legal verification. Retain the underlying logo/photo permissions, any required photo releases, and AI-generation/tool-term records in business records. The generated `studio-preview.avif` should remain traceable to the cleared studio source. Product cover images still need source/licence evidence recorded alongside each product.
- Direct and transitive npm dependency licences have not yet been exhaustively inventoried. The package manifest identifies the direct dependencies, but does not prove the licence of every resolved transitive package. Generate and review a dependency licence report from the production lockfile before marking software licensing complete.

## Remaining P1 actions / external verification

1. Obtain local legal review of child age assurance, parental authority, approved evidence and staff procedure for the manual review gate, consent wording, data minimisation, retention and withdrawal. The application does not perform government-ID verification.
2. The repository has no tutorial catalogue, lesson-material library, comments/discussions feature or tutorial playback route. The child tutorial access endpoint checks the parent permission and a valid entitlement, but there is no content catalogue/player or entitlement-granting workflow to connect yet. The other three permission flags are ready for future content routes; do not claim those capabilities are live until those routes enforce them server-side.
3. Add automated tests for parent invitation expiry/replay, child account ownership, consent withdrawal, each permission, and adult-only payment enforcement.
4. Manually test keyboard-only navigation, screen-reader labels, contrast on every route, zoom/reflow and mobile layouts. Source review is not a substitute for WCAG testing.
5. Record source and licence evidence for each product cover image, and retain the underlying logo/studio-photo permissions, releases and AI-generation records in business records.
6. Produce a complete dependency licence inventory from an exact production lockfile, including transitive packages; the repository currently has no lockfile.
7. Verify retention, deletion, backups, regional processing and contractual/DPA settings directly in Cloudflare, Google, Resend, Razorpay and Backblaze consoles. Repository documentation cannot prove provider-console configuration.
8. Verify the privacy-request queue operationally: named staff owner, response SLA, identity checks, fulfilment checklist, and evidence that provider-side data is handled appropriately.

## No dark-pattern findings in the reviewed pages

No fake countdown, false scarcity or customer-logo/testimonial section was found in the reviewed studio homepage and shop source. Signup policy consent is unchecked by default; parent authority attestation is unchecked by default; all child permissions start off. Re-review any future promotions, pricing, preselected controls, subscription flows or social-proof sections before release.
