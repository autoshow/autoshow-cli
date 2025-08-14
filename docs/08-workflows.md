# Workflow Commands

These commands automate processing for content organized within the `output/workflows` subdirectory.

### AI

Generate shownotes for AI category feeds (replace `YYYY-MM-DD` with the desired date, or omit for default behavior):

```bash
npm run as -- --feed "01-ai-feeds.md" --metaShownotes --metaDate "2025-08-10"
```

Generate shownotes and info files for AI category feeds:

```bash
npm run as -- --feed "01-ai-feeds.md" --metaShownotes --metaDate "2025-08-10" --metaInfo
```

### Web

Generate shownotes for Web category feeds:

```bash
npm run as -- --feed "02-web-feeds.md" --metaShownotes --metaDate "2025-08-10"
```

Generate shownotes and info files for Web category feeds:

```bash
npm run as -- --feed "02-web-feeds.md" --metaShownotes --metaDate "2025-08-10" --metaInfo
```