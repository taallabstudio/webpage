# AI data use and content labelling review

Reviewed: 7 November 2026  
Repository: `taallabstudio/webpage`

## Current code review

- No OpenAI, Gemini, Anthropic or other model SDK/API integration was found in the inspected `package.json`, Worker or OCEAN application code.
- No TaalLab-hosted AI text/image/audio generation endpoint was found.
- OCEAN contains an agent-authorization setting, but this repository does not contain an agent execution or model-generation endpoint.
- Because the current application does not generate AI content, there is no AI-generated output to badge today. Do not label ordinary user-authored content as AI-generated.

## Protections added

- TaalLab's Privacy Policy and Terms state that TaalLab does not train or fine-tune its own AI models using user files, OCEAN pages, comments, account information or other user content.
- OCEAN's agent authorization defaults to page-owner-only. Existing pages were moved to owner-only once; an owner may deliberately choose broader delegation in Advanced settings.
- The UI warns users to review a third-party agent's privacy, data-use and model-training terms before granting access.

## Gate for any future AI feature

Before adding a model or agent integration:

1. Identify the provider, model, region, data sent, retention, subprocessors and training/improvement defaults.
2. Sign and review the required data-processing terms before sending personal data.
3. Make access explicit and scoped; default to no access and owner-only authorisation.
4. Do not send private pages/files to a provider merely because a user has a general account.
5. Record AI provenance on generated content (provider/model where available, creation time and generating actor) and show a visible **AI-generated** label next to the affected output.
6. Provide a way to distinguish user-edited content from generated content without removing the provenance label.
7. Do not use customer content for model training or fine-tuning unless a separate, informed, specific opt-in and legal review authorise it. A general Terms checkbox is not sufficient.
8. Re-audit provider terms, retention and the subprocessors list before release.

This review describes the code in this repository only; it does not audit third-party agents or external services connected outside the application.
