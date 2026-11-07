# Accessibility review — P1

Last reviewed: 7 November 2026

## Implemented in this branch

- Added a consistent, high-visibility `:focus-visible` outline for links, buttons, inputs, selects, textareas and explicitly focusable elements in the main application and static pages.
- Kept OCEAN's own focus-visible treatment and improved the contrast of subdued text in both light and dark themes.
- Improved common muted-text colours in the main site, shop, checkout and download pages.
- Added descriptive alt text to shared image previews and retained empty alt text only for decorative imagery (brand mark beside visible text, hero decoration, profile avatar beside the account identity, and decorative OCEAN cover/page icons).
- Made the shared-file preview dialog keyboard-dismissible with Escape, labelled it as a modal dialog, moved focus to its close button, trapped Tab navigation and restored focus when closed.
- Made the shop cart dialog move focus on open, trap Tab navigation, close with Escape and restore focus to the opener.

## Contrast token checks

Ratios below were calculated using the WCAG relative-luminance contrast formula for the stated foreground/background pairs. They are targeted token checks, not a claim that every rendered element has passed a full WCAG audit.

| Foreground | Background | Contrast |
|---|---|---:|
| `#626b76` | `#f4f6f8` | 4.99:1 |
| `#626b76` | `#f5f7f8` | 4.99:1 |
| `#929292` | `#191919` | 5.65:1 |
| `#9b9b9b` | `#191919` | 6.33:1 |
| `#a0aab6` | `#171a1f` | 7.41:1 |
| `#075fb8` | `#ffffff` | 6.29:1 |

## Remaining manual verification

- Test the production pages with keyboard only, including all OCEAN database views, dropdowns, editor blocks, sharing dialogs and calendar controls.
- Test at 200% zoom, narrow mobile widths, reduced motion and screen readers.
- Review any new images added to pages; informative images need meaningful alt text, while purely decorative images should keep empty alt text.
- Review dynamic content, validation errors, focus order and dialog focus management after each significant UI change.

The automated build does not by itself certify WCAG 2.2 AA conformance. A complete audit needs browser-based testing of the live rendered application and assistive-technology checks.
