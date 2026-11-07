# TAAL LAB — P1 licensing, copyright and policy review

Reviewed: 7 November 2026  
Repository: `taallabstudio/webpage`  
Status: evidence inventory; not a legal opinion or a completed legal clearance.

## 1. Fonts

The website loads **Space Grotesk** and **Roboto** through Google Fonts.

- Google Fonts metadata identifies Space Grotesk as `OFL`; its upstream source includes an `OFL.txt` file: https://github.com/google/fonts/blob/main/ofl/spacegrotesk/METADATA.pb and https://github.com/floriankarsten/space-grotesk/blob/master/OFL.txt
- Google Fonts metadata identifies Roboto as `OFL`: https://github.com/google/fonts/blob/main/ofl/roboto/METADATA.pb
- The upstream Roboto project states that its fonts and software are under SIL Open Font License 1.1: https://github.com/googlefonts/roboto-3-classic

The font families' upstream licensing is identified. The website currently loads them remotely; the exact served font CSS/variant and copyright notice should be retained in release evidence if fonts are later self-hosted or bundled.

## 2. Unsplash API usage

The current OCEAN implementation has the main API integration elements visible in source:

- Search results use the API-provided `photo.urls` values for the preview and selected cover (hotlinking).
- Applying a selected photo calls the API photo download endpoint through `/api/ocean/unsplash/track`.
- The page displays the photographer and Unsplash attribution, and the saved links include `utm_source=taal_lab_ocean&utm_medium=referral`.

Official requirements:
- API guidelines: https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines
- API terms: https://unsplash.com/api-terms
- Attribution guidance: https://help.unsplash.com/en/articles/2511315-guideline-attribution

The API key/account must remain controlled by Taal Lab, and the production application registration and any special approval or quota conditions must be checked in the Unsplash developer console. Source code alone cannot prove the account's approval status.

## 3. User-uploaded content and local image/brand assets — owner evidence required

### Upload-time rights confirmation

The TrackDeliver administrator upload form now requires the uploader to affirm that they own the rights to each selected file or have permission from the rights holder to upload and share it with the intended recipient. The control is required before transfer creation and is also checked by the client-side upload handler. This is an uploader attestation, not independent verification of ownership, a licence, model/property releases, or lawful content. Keep the wording and workflow under review as upload surfaces are added; the control currently applies to the TrackDeliver admin transfer uploader, not automatically to product cover management or OCEAN cover selection.

The uploader must not upload material they are not authorised to distribute. The public Terms now provide a copyright/content complaint route at `contact@taallab.in`, with the information requested to identify the work and disputed material. This is an intake route, not a designated DMCA agent registration. Taal Lab still needs an operational review/takedown/repeat-infringer process and counsel's assessment of applicable Indian intermediary duties or U.S. DMCA safe-harbour eligibility.

### Local image and brand asset evidence



The repository contains these local assets:

| Asset | Current evidence | Clearance status |
|---|---|---|
| `public/logo.png` | File is present in the repository | Confirm Taal Lab owns or has permission to use all artwork in the logo |
| `public/studio.webp` | Studio photograph is present | Confirm photographer/creator, ownership and any identifiable people/property permissions |
| `public/headphones.webp` | Hero image is present | Confirm it is original, commissioned, or covered by a valid licence |
| `public/studio-preview.avif` | Generated/optimised preview referenced by the landing page build | Verify it is derived only from a cleared source image |
| Product cover images | Loaded from configured store product metadata/storage | Keep the source and licence evidence alongside each product record |

No asset provenance or licence file is embedded in the repository for these local images. Do not mark them cleared until the owner has confirmed the source and any necessary permissions. User-supplied files are not automatically proof of copyright ownership.

## 4. npm dependencies — incomplete until a lockfile and full report exist

The current `package.json` uses version ranges and the repository has no `package-lock.json`. No root `LICENSE` or third-party notices inventory was found in the repository tree. Therefore the exact resolved dependency tree for a particular build cannot be reconstructed from the repository alone, and this is not a complete transitive dependency audit.

Package metadata/source evidence checked for representative direct dependencies:

| Package | Declared range in project | Publicly declared licence | Evidence |
|---|---|---|---|
| `react-dom` | `^19.1.1` | MIT | https://www.npmjs.com/package/react-dom |
| `lucide-react` | `^0.468.0` | ISC in npm package metadata | https://www.npmjs.com/package/lucide-react |
| `aws4fetch` | `^1.0.20` | MIT | https://www.npmjs.com/package/aws4fetch |
| `@simplewebauthn/browser` | `^14.0.0` | MIT | https://www.npmjs.com/package/%40simplewebauthn/browser |
| `@simplewebauthn/server` | `^14.0.3` | MIT | https://www.npmjs.com/package/%40simplewebauthn/server |
| `qrcode` | `^1.5.4` | MIT | https://www.npmjs.com/package/qrcode |
| `@tauri-apps/plugin-opener` | `^2.5.0` | MIT OR Apache-2.0 | https://www.npmjs.com/package/%40tauri-apps/plugin-opener |
| `@tauri-apps/plugin-deep-link` | `^2.4.0` | MIT OR Apache-2.0 | https://www.npmjs.com/package/%40tauri-apps/plugin-deep-link |

This table is not the complete dependency inventory. Before shipping a desktop/mobile binary, generate a report from the exact installed dependency tree, inspect all direct and transitive licences, and include required notices/licence texts in the distributed application. Do not infer the licence of an exact resolved package version from the latest npm page.

## 5. DMCA / copyright complaints

The file-transfer product stores material at users' direction. Whether Taal Lab should seek the U.S. DMCA section 512 safe-harbour protections, and whether the relevant service/entity falls within the applicable statutory category, must be confirmed by counsel.

The U.S. Copyright Office states that a service provider seeking the relevant section 512 safe harbour must designate an agent, publish the agent's required contact information on its service, and register the designation through the Office's online system. The agent details must be kept current; registrations expire after three years unless renewed.

Official sources:
- https://www.copyright.gov/512/
- https://www.copyright.gov/dmca-directory/
- https://www.copyright.gov/title37/201/37cfr201-38.html

Taal Lab must not publish a fictitious DMCA agent or imply registration before an actual designation has been accepted and entered in the official directory. The business must first decide which legal person is the service provider and appoint an agent with a real name/role, postal address, phone number and monitored email.

For India, counsel should separately assess the Information Technology Act, 2000 section 79 and the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, including whether the product qualifies as an intermediary and which due-diligence obligations apply:
- https://www.indiacode.nic.in/bitstream/123456789/18236/1/it_act_2000_0.pdf
- https://upload.indiacode.nic.in/showfile?actid=AC_CEN_45_76_00001_200021_1517807324077&filename=amended_it_%28ig_and_dmec%29_rules_2021_updated_as_on_28.10.2022.pdf&type=rule

## 6. Children and parental consent — product decision required

The Digital Personal Data Protection Act, 2023 defines a child as an individual under 18 and section 9 provides for verifiable parental consent before processing a child's personal data. The Act's commencement is phased; the official text records an 18-month commencement period for section 9 from 13 November 2025, so its scheduled commencement is 13 May 2027.

Official text: https://www.indiacode.nic.in/bitstream/123456789/22037/2/a2023-22.pdf

Before changing signup, Taal Lab must choose one product policy:

1. **Adults only:** do not offer accounts/services to under-18 users and implement an age declaration plus an escalation/deletion process if a child is identified; or
2. **Support minors:** build a verifiable parent/guardian consent flow and records before processing a child's data, and assess all child-specific restrictions.

A simple age checkbox is not verifiable parental consent. No child account or parental-consent workflow is represented as implemented by this review.



## 6A. Product decision — minors may register, safeguards still required

Product owner decision recorded 7 November 2026: **do not impose a blanket 18+ registration restriction**. Registration remains available without a hard age gate. This is not a decision to knowingly process children's personal data without safeguards. Before enabling or knowingly accepting an under-18 user's account or data processing, obtain counsel's advice and implement all safeguards required by applicable law, including verifiable parental consent where required, age-appropriate notices, restrictions on processing/advertising, and a workable escalation and deletion path. Do not represent an ordinary self-declared checkbox as verifiable parental consent. The decision must be revisited before the relevant DPDP provisions commence and when the product audience or law changes.

## 7. Marketing email — no marketing programme found

The inspected repository uses Resend for transactional messages such as verification, password recovery, security codes and service notifications. No marketing campaign/list workflow was found.

To avoid unnecessary collection, Taal Lab should not add a marketing opt-in checkbox or collect marketing preferences until it actually launches marketing emails. Before any marketing email is sent, implement separate optional opt-in, record its version/time/source, provide a working unsubscribe link in each marketing message, and honour opt-outs before sending further campaigns. Transactional/security messages must remain separate from marketing consent.

## 8. Required follow-up before marking P1 licensing/legal items complete

- Obtain owner/creator confirmation and permission records for the logo, studio photo, headphones image and every product cover.
- Generate and retain a complete licence report from the exact dependency tree; add a lockfile and a third-party notices file for shipped app builds.
- Confirm Unsplash production application status and API compliance in the provider console.
- Obtain legal advice on Indian intermediary obligations and whether Taal Lab will seek U.S. DMCA section 512 safe-harbour protection; appoint/register a real agent only if proceeding.
- Choose the adults-only or verifiable-parental-consent product policy before collecting data from children.
- Keep marketing email disabled until a separate consent and unsubscribe implementation is ready.
