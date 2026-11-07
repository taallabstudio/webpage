# TAAL LAB asset and third-party licence register

Last reviewed: 7 November 2026

This is a source-code inventory, not proof of ownership. An asset is not cleared merely because it is present in the repository.

## Images and brand artwork

| Asset | Current use | Evidence in repository | Status / action |
|---|---|---|---|
| `public/logo.png` | TaalLab site/app logo | No source or licence record stored alongside the file | Confirm TaalLab owns or has permission to use it. |
| `bimi/logo.png` | Email BIMI brand mark | No source or licence record stored alongside the file | Confirm it is the approved TaalLab mark and meets BIMI requirements. |
| `public/studio.webp` | Studio photograph | No photographer/source metadata or release recorded in repository | Confirm photographer, copyright ownership and any people/property permissions. |
| `public/headphones.webp` | Decorative hero animation | No source or licence record stored alongside the file | Confirm it is original, commissioned, or licensed for commercial web use. |
| `public/ocean-icon.svg` | OCEAN product icon | No source or licence record stored alongside the file | Confirm original authorship or record the upstream source and licence. |
| `src-tauri/icons/three-waves.svg` | Desktop application icon | No source or licence record stored alongside the file | Confirm original authorship or record the upstream source and licence. |

Do not add customer, artist, label or partner logos to marketing pages unless written permission or a valid brand-use licence is retained.

## Fonts

The repository references Google Fonts families Inter, Space Grotesk and Roboto. Google Fonts metadata identifies these families as SIL Open Font License 1.1 (OFL-1.1). The site currently requests fonts from Google's font service rather than bundling local font binaries.

- Inter: https://github.com/google/fonts/tree/main/ofl/inter
- Space Grotesk: https://github.com/google/fonts/tree/main/ofl/spacegrotesk
- Roboto: https://github.com/google/fonts/tree/main/ofl/roboto

If font binaries are later self-hosted or redistributed, include each family's copyright and OFL notice with the distributed font files and preserve any reserved-font-name conditions.

## OCEAN cover photos and emoji assets

- OCEAN retrieves cover photos through the Unsplash API. The UI displays photographer and source attribution, and the Worker calls Unsplash's download-tracking endpoint when a photo is selected. Keep the attribution fields with the saved cover and re-check the current Unsplash API terms before changing this flow.
- Emoji search uses Emoji API. The repository does not contain a licence record for the API's underlying artwork. Confirm its current terms and the source/licence of any returned artwork before using it in commercial marketing or redistributing it outside the API.

## Open-source code

- The repository has no root `LICENSE` or `NOTICE` file. Do not add a project-wide licence until the owner explicitly chooses one; absent a licence, the project should not be represented as open-source.
- Runtime and build dependencies are listed in `package.json`. Run the automated dependency licence inventory in CI and review packages marked unknown, custom, dual-licensed or copyleft before release.
- Preserve third-party copyright and licence notices when bundling or redistributing packages. This inventory does not replace the licence terms of each dependency.

## Dependency licence scan (CI, 7 November 2026)

The repository's CI inventory scanned 161 installed packages. All packages had a declared SPDX-style licence value in package metadata; 36 packages did not contain one of the common top-level licence/notice filenames checked by the scanner, so their actual package notices still need spot-checking. The inventory is uploaded as the `taallab-compliance-audit-reports` artifact on the pull-request workflow.

Notable entries:
- `lucide-react`: ISC.
- React and React DOM: MIT.
- `@simplewebauthn/browser` and `@simplewebauthn/server`: MIT.
- `@tauri-apps/api` and Tauri plugins: Apache-2.0 OR MIT / MIT OR Apache-2.0.
- `wrangler`: MIT OR Apache-2.0.
- `@img/sharp-libvips-linux-x64`: LGPL-3.0-or-later (two resolved versions appeared in the scan). It is a transitive binary of the dev-only `sharp` dependency used by the prebuild image-optimization script; verify it is not copied into the shipped web or desktop runtime.
- `caniuse-lite`: CC-BY-4.0 metadata; `@speed-highlight/core`: CC0-1.0.

The repository currently has no `package-lock.json`. Because dependencies use version ranges, the exact resolved inventory can change on a future install. Add and review a lockfile before a release, then regenerate the inventory. The automated report is triage, not legal approval.

## Required owner confirmations

1. Confirm ownership/permission for the logo, studio photo, headphones image and both SVG icons.
2. Confirm no client/artist/label logos or endorsements are shown without written permission.
3. Confirm the Unsplash API account and current API terms cover the production use and attribution flow.
4. Confirm Emoji API and returned artwork licensing.
5. Review the generated dependency licence inventory before each release or dependency update.
