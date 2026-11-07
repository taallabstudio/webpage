# Compliance review items that require owner or legal action

Last reviewed: 7 November 2026
Repository: `taallabstudio/webpage`

This is an operational checklist, not a legal opinion or a claim that the items below are complete.

## Asset and font provenance

### Image and icon assets

The repository contains these image/icon files:

- `bimi/logo.png`
- `public/logo.png`
- `public/headphones.webp`
- `public/studio.webp`
- `public/ocean-icon.svg`
- `src-tauri/icons/three-waves.svg`

The repository does not contain source receipts, contributor attribution, model releases, or licence records for these assets. Confirm that Taal Lab owns each asset or has permission for the intended website, app, marketing, and commercial use. Do not treat a file being present in the repository as proof of ownership.

### Fonts

The website references Space Grotesk, Inter and Roboto through Google Fonts when a visitor explicitly allows optional external fonts. Their Google Fonts distributions are published under the SIL Open Font License (OFL) family licences. If font files are ever self-hosted or bundled in desktop/mobile releases, include the applicable copyright and OFL notice with the distributed font files.

- Space Grotesk: https://github.com/google/fonts/tree/main/ofl/spacegrotesk
- Inter: https://github.com/google/fonts/tree/main/ofl/inter
- Roboto: https://github.com/google/fonts/tree/main/apache/roboto
- Google Fonts licence overview: https://github.com/google/fonts/blob/main/README.md

### Open-source code

No root `LICENSE`, `NOTICE`, or third-party licence inventory was present in the repository when reviewed. This does not mean the project must be open-sourced. Before distributing desktop/mobile binaries, generate and review a complete direct and transitive dependency licence report, include required notices, and check any copyleft or source-disclosure obligations. Do not add a project-wide licence without the owner's decision about whether the Taal Lab code itself is intended to be open source.

## Third-party processing agreements

The public subprocessors page identifies Cloudflare, Backblaze, Google, Resend, Razorpay, Unsplash and Emoji API. The repository cannot prove which agreements have been accepted in the provider dashboards or whether the relevant service-specific data-processing terms apply.

Owner action: verify the legal entity/account, applicable DPA or data-processing terms, international transfer terms, retention settings, security controls and deletion behaviour for each provider. Save the executed agreement or acceptance record in the business's contract records. Do not describe a DPA as signed merely because a public DPA link is published.

## Copyright notices and takedowns

Taal Lab operates user file-transfer and hosting features. Whether the service is a qualifying U.S. service provider and whether it should seek the U.S. DMCA Section 512 safe harbours is a legal/business decision.

If Taal Lab seeks to rely on the relevant U.S. Section 512 safe harbour for hosted user material, the U.S. Copyright Office says the provider must designate an agent, publish the required agent contact information, register the designation electronically with the Copyright Office, keep it current, and renew it every three years. The repository does not show a registered designated agent or a complete notice/counter-notice and repeat-infringer procedure.

Official references:
- https://www.copyright.gov/dmca-directory/
- https://www.copyright.gov/512/
- https://www.copyright.gov/title37/201/37cfr201-38.html

Before publishing a DMCA agent page, the owner must provide the authorised agent/department name, physical mailing address, telephone number and email address, and decide whether to register with the Copyright Office. Do not invent these details.

## India intermediary and grievance review

Because Taal Lab provides user file storage, public sharing and OCEAN pages, obtain Indian legal advice on whether the service is an intermediary under the Information Technology Act and the current Intermediary Rules, and which due-diligence and grievance obligations apply to the specific features and entity. The 2026 Amendment Rules took effect on 20 February 2026. They add a requirement for intermediaries to inform users at least once every three months about compliance, removal/suspension and legal consequences. A scheduled, non-marketing policy reminder is now implemented for verified active accounts; the actual legal applicability and required notice wording still need counsel review.

The 2026 amendments also shorten certain grievance and law-enforcement response timelines. If applicable, appoint and publish the required named Grievance Officer details and implement a tracked complaint process with the correct acknowledgement, resolution, takedown, appeal and evidence-preservation deadlines. The current privacy-request queue is not a substitute for a statutory grievance workflow. The repository currently publishes a general contact email but does not identify a named Grievance Officer or a dedicated grievance workflow.\n\nThe 2026 amendments introduce obligations for intermediaries whose computer resources enable, permit or facilitate the creation, generation, modification, alteration, publication, transmission, sharing or dissemination of synthetically generated audio, visual or audio-visual information. Taal Lab does not provide an AI-generation feature, but users can upload and share audio, images and video. Obtain a legal determination on whether those sharing features trigger labelling/provenance obligations. If they do, design per-content declarations, prominent labels and technically feasible provenance metadata before treating this requirement as complete. Significant social media intermediaries have additional declaration/verification requirements; do not assume Taal Lab falls into or outside that category without review.

Official references:
- https://upload.indiacode.nic.in/view-casepdf?id=AC_CEN_45_76_00001_200021_1517807324077&type=act
- https://www.meity.gov.in/static/uploads/2024/02/IT-Intermediary-Rules-2021-updated-on-28.10.2022-2.pdf\n- 2026 Amendment Rules (Gazette of India, 10 February 2026; effective 20 February 2026): https://egazette.gov.in/WriteReadData/2026/269993.pdf

## Features not identified in the repository review

The inspected implementation did not show:
- recurring subscription billing or auto-renewals;
- an AI content-generation feature;
- customer testimonial/review widgets;
- customer-logo walls;
- fake countdown or scarcity timers;
- SOC 2 or ISO certification claims;
- a numerical uptime guarantee.

Re-check these items before introducing new features or marketing pages. If AI generation is added, determine the applicable disclosure/labelling rules before launch.

## Outstanding confirmations

- Confirm ownership/licence for each image and SVG asset listed above.
- Confirm whether Taal Lab wants to seek U.S. DMCA safe-harbour protection.
- Name the person or department responsible for copyright complaints and Indian grievances, and provide its phone contact.
- Verify actual DPAs and provider account settings outside this repository.
- Review the retention periods for tax/accounting records with the business's accountant or legal adviser.
- Review how existing accounts created before the age gate should be handled; the new gate applies to new account creation paths and does not prove the age of legacy accounts.
