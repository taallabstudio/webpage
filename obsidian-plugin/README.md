# TaalLab OCEAN Sync — Obsidian plugin

Syncs your entire Obsidian vault to the **Obsidian** folder in OCEAN at https://ocean.taallab.in.

## Features
- Full-vault sync (all Markdown notes, folders and non-Markdown attachments).
- Preserves nested folder paths.
- Manual **Sync entire vault now** command and ribbon button.
- Automatic sync after create, edit, rename and delete events.
- Hash-based change detection to avoid re-uploading unchanged content.
- One-way sync: Obsidian is the source of truth; OCEAN copies are read-only.
- Uses a personal bearer token; it does not reuse browser login cookies.

The Obsidian application configuration directory `.obsidian` is excluded intentionally so plugin tokens and workspace settings are not uploaded.

## Build
```sh
npm install
npm run build
```

Copy `main.js`, `manifest.json` and `styles.css` (if present) into:
`.obsidian/plugins/taallab-ocean-sync/`

Enable **TaalLab OCEAN Sync** in Obsidian → Settings → Community plugins, then paste the token generated in OCEAN → Obsidian Sync.

## Limits
- Each attachment is limited to 100 MB.
- Each Markdown note is limited to 350 KB.
- OCEAN currently stores the original frontmatter as page metadata and converts common Markdown blocks for display.
- Two-way editing and conflict resolution are not included in this initial release.
