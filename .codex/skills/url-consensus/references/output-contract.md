# URL Consensus Output Contract

## Required outputs

Write these files into the AutoShow URL run directory:

1. `consensus-extraction.txt`
2. `provider-comparison-report.md`
3. `provider-comparison-report.json`

## Consensus extraction

`consensus-extraction.txt` is the gold reference used for scoring. It should contain only reconciled article extraction content. It may preserve article headings, lists, and meaningful inline links when they are part of the article. It must not include scoring notes, provider names, report headings, or process commentary.

## Markdown report

`provider-comparison-report.md` must include:

1. Run summary with discovered provider count.
2. Overall ranking table.
3. Local provider table.
4. Hosted provider table.
5. Tier breakdown.
6. Short notes on missing cost or timing data.

## JSON report

`provider-comparison-report.json` must include:

1. `schemaVersion: 1`
2. `kind: "url-provider-comparison"`
3. `runDir`
4. `providers`
5. `overallMetric`
6. `overallWeights`
7. `overall`
8. `tiering`
9. `generatedAt`

Each provider entry must include provider/model identity, group, WER, CER, content coverage, token estimate, processing time, cost, overall score, and score components.
