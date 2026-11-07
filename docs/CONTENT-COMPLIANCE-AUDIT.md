# Website and product content compliance audit

Last reviewed: 7 November 2026
Scope: repository-visible public pages and product copy.

## Findings

| Topic | Repository finding | Action |
|---|---|---|
| Fake countdown timers | No sales countdown or false urgency timer found. The resend countdown in account verification is a real cooldown. | Keep it tied to the actual resend limit; do not repurpose it as a sales timer. |
| Fake reviews | No customer review/rating carousel or fabricated testimonial block found. | Do not add testimonials without permission and evidence. |
| Customer/partner logos | No third-party customer or partner logo section found in the inspected public pages. | Obtain written permission before adding any. |
| SOC 2 / certification claims | No SOC 2 certification claim found in repository copy. | Do not publish certifications unless TaalLab has current evidence and permission to use the mark. |
| Uptime claims | Terms say the service aims for availability but makes no fixed uptime guarantee. | Keep any future SLA tied to measured operations and support capacity. |
| Subscription and auto-renewal claims | Store code currently implements one-time digital purchases; no recurring billing or subscription lifecycle was found. | If subscriptions are introduced, disclose renewal amount/cadence and provide self-serve cancellation before launch. |
| Hidden checkout fees | Checkout calculates subtotal, coupon discount and final total; no additional fee line was found in the inspected checkout. | Keep the final payable amount visible before payment and disclose any tax/fee before order submission. |
| Unsupported product claims | The shop previously described downloads as delivered through “secure, private links.” This was changed to the narrower statement that downloads are made available through private storage after payment verification. | Ensure future security, performance and quality claims match implemented controls and evidence. |
| AI-generated content | No AI content-generation feature or AI provider integration was found in the inspected application. | If introduced, label generated output and disclose third-party processing before enabling it. |
| Dark patterns | No false urgency, fake review, preselected marketing checkbox or hidden subscription cancellation flow was found. | Marketing consent is now optional and unchecked by default; keep it separate from service/terms acceptance. |

## Limits of this review

This is a repository source review, not a complete visual review of every live page, advertisement, social post, email campaign, product claim or provider dashboard. Re-run the audit whenever public copy, store products, billing or external integrations change.
