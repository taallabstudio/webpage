# Children and parental-consent readiness

Last reviewed: 7 November 2026
Scope: TaalLab website, TrackDeliver/file transfers, OCEAN and digital store.

## Current repository state

- The Privacy Policy says the service is not designed specifically for children and that TaalLab does not knowingly seek children's personal data.
- The current main branch asks for date of birth after email verification, classifies accounts as adult or child, marks under-18 accounts as pending parent/guardian setup, and blocks store purchases/payment actions for those accounts.
- A verified parent/guardian identity and consent workflow is not yet implemented; there is no parent consent endpoint or consent-token flow in the inspected main branch.
- The Worker defines an age-eligibility helper, but it is not called by the protected account routes inspected. The client-side onboarding and store purchase restriction are not a complete server-side gate.
- Date of birth is currently collected before parent/guardian consent is verified. This does not satisfy a parent-first consent design and must not be described as verified parental consent.
- No child-specific tracking or targeted advertising feature was found in the repository scan.
- Do not describe the application as having verified parental consent.

## India DPDP timeline and requirements

The Digital Personal Data Protection Act, 2023, section 9 requires verifiable parental consent before processing a child's personal data. The Digital Personal Data Protection Rules, 2025, Rule 10 describes due diligence to verify that the person identifying themselves as a parent is an identifiable adult, using reliable identity/age details or a government-backed virtual token/Digital Locker route.

The commencement notification dated 13 November 2025 schedules sections 3–17, including section 9, to commence eighteen months after publication. Rule 10 is also scheduled to commence eighteen months after the Rules' publication on 13 November 2025. Rules 3, 5–16, 22 and 23, including Rule 10 on verifiable parental consent, are therefore scheduled to commence on 13 May 2027. Rule 4 is scheduled to commence one year after publication, on 13 November 2026. Re-check the Gazette and any corrigenda before launch; this is not a substitute for legal advice.

Official sources:
- DPDP Act, 2023: https://www.meity.gov.in/static/uploads/2024/02/Digital-Personal-Data-Protection-Act-2023.pdf
- Commencement notification (13 November 2025): https://egazette.gov.in/WriteReadData/2025/267647.pdf
- DPDP Rules, 2025: https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf

## Decision required before implementation

TaalLab must choose, with legal advice, between:

1. **Adult-only service:** implement a meaningful age-assurance gate and prevent under-18 account creation and data collection. A simple unchecked checkbox is not verifiable parental consent and must not be described as such.
2. **Service available to children:** implement parent/guardian identification and verifiable adult-age checks before collecting the child's account data, plus consent records, withdrawal handling and safeguards against tracking, behavioural monitoring and child-directed advertising.

Do not collect a child's date of birth, email, files or account details before the required parent/guardian verification. Do not invent a lightweight email-only parent confirmation and call it verifiable consent.

## Pre-deadline work

- Decide adult-only versus child-eligible product policy.
- Obtain legal review of the age threshold, exemptions and verification mechanism.
- Design parent flow and audit trail before the statutory commencement date.
- Keep tracking and targeted advertising disabled for children.
- Update the public Privacy Policy and Terms only after the actual workflow exists and has been tested.
