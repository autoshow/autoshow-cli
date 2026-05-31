# Image Quality Report

## Summary

- Run directory: `/Users/ajc/c/as/autoshow-cli/docs/benchmarks/image/2026-05-21_10-33-37-508_image-gen`
- Judge model: `gpt-5.5`
- Providers: 10
- Images scored: 10

## Ranking

| Rank | Provider | Quality / 100 | Average / 10 | Prompt | Visual | Artifacts | Composition | Detail/Text | Evidence |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | `openai/gpt-image-2` | 90.00 | 9.00 | 9.00 | 9.00 | 9.00 | 9.00 | 9.00 | generated-image-openai-gpt-image-2.png: Clean, readable technical infographic closely matching the requested media processing pipeline with correct stages, colors, icons, arrows, and monospace labels. |
| 2 | `gemini/gemini-3.1-flash-image-preview` | 86.00 | 8.60 | 9.00 | 9.00 | 8.00 | 9.00 | 8.00 | generated-image-gemini-gemini-3.1-flash-image-preview.png: Clean, readable technical infographic matching the requested media pipeline structure, colors, icons, and dark documentation-style aesthetic. Minor issues include Stage 3 labeled “WRITE” instead of requested “Write” placement/name nuance and slight roughness/unevenness in some line/icon rendering. |
| 3 | `grok/grok-imagine-image-quality` | 82.00 | 8.20 | 8.00 | 9.00 | 8.00 | 8.00 | 8.00 | generated-image-grok-grok-imagine-image-quality.jpg: Strong technical infographic matching the requested dark developer-doc style, with all seven stages, numbered nodes, appropriate colors, icons, and mostly readable monospace labels. Minor structure issues include output arrows not perfectly fanning from the AI node and an extra-looking flow between Music and Video. |
| 4 | `openai/gpt-image-1.5` | 78.00 | 7.80 | 7.00 | 8.00 | 9.00 | 7.00 | 8.00 | generated-image-openai-gpt-image-1.5.png: Clean, readable technical infographic with strong dark navy palette, clear extraction paths, central AI brain, and output icons. It misses some prompt specifics such as the Download label and numbering for stages 4–7, and the lower half has excessive empty space. |
| 5 | `bfl/flux-2-flex` | 76.00 | 7.60 | 7.00 | 8.00 | 8.00 | 7.00 | 8.00 | generated-image-bfl-flux-2-flex.jpg: Clean, readable dark technical infographic with the main pipeline and color coding mostly correct, but it has a structural numbering error and an extra output node. |
| 6 | `bfl/flux-2-pro` | 76.00 | 7.60 | 7.00 | 8.00 | 8.00 | 8.00 | 7.00 | generated-image-bfl-flux-2-pro.jpg: Clean, readable technical infographic that matches the overall dark navy, flat developer-documentation style and includes the main pipeline nodes, icons, colors, and fan-out from the AI Write stage. However, the Extract split is structurally confusing and the speech-to-text/OCR side paths are incorrectly numbered, conflicting with the requested seven-stage sequence. |
| 7 | `bfl/flux-2-max` | 74.00 | 7.40 | 7.00 | 8.00 | 8.00 | 7.00 | 7.00 | generated-image-bfl-flux-2-max.jpg: Clean, readable dark technical infographic with correct general pipeline, colors, icons, and output fan-out, but the seven-stage top-to-bottom numbering/flow is imperfect and Stage 2/3 structure is somewhat mislabeled/ambiguous. |
| 8 | `reve/latest` | 74.00 | 7.40 | 6.00 | 8.00 | 8.00 | 7.00 | 8.00 | generated-image-reve-latest.png: Clean, readable dark technical infographic with most requested stages, colors, and icons present, but the pipeline structure and arrow directions do not fully match the prompt. |
| 9 | `grok/grok-imagine-image` | 72.00 | 7.20 | 6.00 | 8.00 | 8.00 | 7.00 | 7.00 | generated-image-grok-grok-imagine-image.jpg: Clean, readable flat infographic with the requested dark navy palette, numbered stages, and many correct labels/icons, but the pipeline structure is not fully faithful: the central AI node is not a brain, arrows are confusing, and there is a duplicated/mislabeled output. |
| 10 | `reve/reve-create@20250915` | 60.00 | 6.00 | 5.00 | 8.00 | 7.00 | 7.00 | 3.00 | generated-image-reve-reve-create@20250915.png: Clean flat infographic style with appropriate dark background and color palette, but the requested seven-stage structure is only partially followed and several key labels/numbers are incorrect or missing. |

## Rubric

- Prompt adherence, visual quality, artifact control, composition, and detail/text handling are scored from 1 to 10.
- `qualityScore` is the average 1-10 score multiplied by 10 for 0-100 ranking compatibility.
- The score excludes cost, generation speed, file size, and provider latency.
