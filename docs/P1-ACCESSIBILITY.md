# TAAL LAB — P1 accessibility implementation notes

Reviewed: 7 November 2026  
Repository: `taallabstudio/webpage`  
Scope: shared transfer/account UI, studio landing page and OCEAN page covers.

## Implemented in this change

- Added a consistent, high-visibility `:focus-visible` outline for interactive controls in the shared transfer/account application.
- Improved low-contrast secondary text and small accent links in the studio landing page.
- Added a descriptive alt value to OCEAN page cover images using the page title. Decorative page icons and brand artwork remain intentionally hidden from assistive technology.
- Added descriptive alt text to image previews in file transfers.
- Made the file preview an accessible modal dialog with an accessible name, labelled close control, Escape-to-close, focus trapping while open, and focus restoration on close.
- Enabled the existing build-validation workflow on pushes to `main`, so direct main-branch commits receive the same build and Worker validation as pull requests.

## Contrast spot-checks

Ratios below are calculated from the CSS foreground/background colour pairs changed in this commit. They are spot-checks, not a complete WCAG audit.

| Text use | Foreground | Background | Contrast |
|---|---:|---:|---:|
| Hero and body secondary text | `#5b6470` | `#f4f6f8` | 5.54:1 |
| Section kicker | `#606a75` | `#ffffff` | 5.50:1 |
| Service-card index | `#626d79` | `#fafbfc` | 5.09:1 |
| Contact metadata | `#626d79` | `#eaf0f4` | 4.59:1 |
| Small blue links | `#0068c9` | `#ffffff` | 5.49:1 |

## Image alt-text source audit

A source-level pass over the repository image renderers found:

- Decorative logo and avatar images use empty alt text and are hidden from assistive technology where appropriate.
- File-transfer image previews use the uploaded file name; product covers use the product name; OCEAN uploaded assets use the file name; page covers use the page title as a fallback.
- OCEAN Unsplash search thumbnails and the cover-crop preview now fall back to a descriptive label when the provider description is empty, rather than emitting an empty alt value.
- The six-digit verification inputs, authenticator QR, and OCEAN image controls have explicit accessible names or descriptions.

This is a source-code audit of known image components, not a complete content audit: user-provided alt descriptions can still be missing or inaccurate, and the production DOM may include images from data or external providers not represented by these renderers.

## Remaining manual verification

- Keyboard-test every route and OCEAN's table, board, calendar, menus, sharing dialogs and settings with a real keyboard.
- Test with NVDA or another screen reader, including form errors, upload progress, media controls and dynamic database updates.
- Run an automated WCAG 2.2 AA scan against deployed pages at desktop and mobile breakpoints, then manually inspect all flagged contrast pairs.
- Review user-supplied images: the page-title fallback is not a substitute for meaningful author-provided alt text when the image conveys information.
- Verify focus order and modal behaviour with browser zoom and reduced-motion settings.

No claim of complete WCAG conformance is made by this implementation note.
