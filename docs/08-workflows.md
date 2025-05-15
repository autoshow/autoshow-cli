# Workflow Commands

These commands automate processing for content organized within the `./workflows` subdirectory.

### AI

Get info and generate shownotes for AI category feeds (replace `YYYY-MM-DD` with the desired date, or omit for default behavior):

```bash
npm run as -- --metaDir "01-ai" --metaSrcDir "workflows" --metaInfo
npm run as -- --metaDir "01-ai" --metaSrcDir "workflows" --metaShownotes --metaDate "2025-05-13"
```

### Web

Get info and generate shownotes for Web category feeds:

```bash
npm run as -- --metaDir "02-web" --metaSrcDir "workflows" --metaInfo
npm run as -- --metaDir "02-web" --metaSrcDir "workflows" --metaShownotes --metaDate "2025-05-13"
```