# Third-party licence and asset audit

Last reviewed: 7 November 2026  
Repository: `taallabstudio/webpage`

This is an evidence register, not a blanket legal clearance. The CI licence report must be reviewed whenever dependencies change. Asset rights must be confirmed from the original source/creator; a file being present in this repository does not establish permission.

## Fonts

The following font families are referenced by the website/app or the studio design system. Their upstream font projects publish them under the SIL Open Font License 1.1 (OFL-1.1), which permits commercial use subject to the licence terms.

| Font | Where used | Published licence | Evidence |
|---|---|---|---|
| Space Grotesk | Main site headings and brand typography | SIL OFL 1.1 | [Upstream project](https://github.com/floriankarsten/space-grotesk) |
| Inter | Application and OCEAN UI | SIL OFL 1.1 | [Google Fonts family metadata](https://github.com/google/fonts/tree/main/ofl/inter) |
| Roboto | Shop/checkout typography | SIL OFL 1.1 | [Google Fonts family metadata](https://github.com/google/fonts/tree/main/ofl/roboto) |
| JetBrains Mono | Code-font preference/design system | SIL OFL 1.1 | [JetBrains project and licence](https://github.com/JetBrains/JetBrainsMono) |

Google Fonts is loaded remotely in the current site, so the browser makes requests to Google when those pages load. If font files are later bundled locally, preserve the applicable copyright and OFL text alongside the font files.

## First-party image and icon assets — ownership evidence still required

The following repository assets need a source/creator record and confirmation that Taal Lab owns them or has a commercial-use licence. Do not treat them as cleared solely because they are in Git.

| Asset | Current assessment | Required evidence |
|---|---|---|
| `public/logo.png` | Taal Lab brand logo; ownership not evidenced in this repository | Confirm created/commissioned by Taal Lab or obtain written assignment/licence |
| `bimi/logo.png` | Brand/BIMI logo | Confirm same ownership and any BIMI provider requirements |
| `public/studio.webp` | Studio photograph | Confirm photographer/owner and commercial website permission |
| `public/headphones.webp` | Hero artwork | Confirm whether original, commissioned, licensed stock or AI-generated; retain source evidence |
| `public/ocean-icon.svg` | Application icon | Confirm author and source |
| `src-tauri/icons/three-waves.svg` | Desktop application icon | Confirm author and source |

No third-party customer/client logos were identified in the inspected rendered website code. Continue to obtain written permission before adding customer logos, names or testimonials.

## Application and build dependencies

The direct dependencies in `package.json` include React, React DOM, Lucide React, aws4fetch, SimpleWebAuthn browser/server, qrcode, Tauri plugins, Vite, TypeScript, Wrangler and Sharp.

The P1 CI snapshot on 7 November 2026 reported **64 production packages**: 48 MIT, 8 ISC, 2 MIT OR Apache-2.0, 1 Apache-2.0 OR MIT, 2 0BSD, 1 BSD-3-Clause, 1 Apache-2.0 and 1 `UNLICENSED`. No GPL, AGPL or LGPL packages appeared in this snapshot. The `UNLICENSED` entry is the private application package `taallab-transfer@1.0.0` itself, not a third-party dependency; `package.json` already sets `private: true`. The full report is attached to the P1 GitHub Actions run as the `third-party-license-report` artifact. This report reflects the dependency versions installed in that CI run and must be regenerated when dependencies change.

The CI workflow generates a machine-readable licence report from the installed production dependency tree and uploads it as a build artifact. Review the report for:

- Missing/unknown licence metadata.
- GPL/AGPL or other reciprocal/copyleft components and their distribution obligations.
- Packages with dual licences or custom terms.
- Required copyright notices, attribution and NOTICE files.
- Transitive packages included in desktop bundles as well as the web Worker.

This repository currently has no root `LICENSE` or `NOTICE` file. Do not add an open-source licence to Taal Lab's own code without the owner's explicit decision. A third-party notices file should be generated from the reviewed dependency report if redistribution obligations require it.

## Release gate

Before each production release:

1. Review the latest CI dependency licence report.
2. Re-run the asset ownership check if images/icons changed.
3. Preserve source URLs, invoices, licence copies or written permissions in the project's private records.
4. Remove or replace any asset whose commercial rights cannot be evidenced.
