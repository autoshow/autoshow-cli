# Image Quality Report

## Summary

- Run directory: `/Users/ajc/c/as/autoshow-cli/docs/benchmarks/image/2026-05-21_10-35-24-459_image-gen`
- Judge model: `gpt-5.5`
- Providers: 9
- Images scored: 9

## Ranking

| Rank | Provider | Quality / 100 | Average / 10 | Prompt | Visual | Artifacts | Composition | Detail/Text | Evidence |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | `bfl/flux-2-flex` | 88.00 | 8.80 | 9.00 | 9.00 | 8.00 | 9.00 | 9.00 | generated-image-bfl-flux-2-flex.jpg: Highly effective pencil-style recursive drawing scene with clear nested figures and strong draftsmanship. It closely follows the prompt, though the deepest recursion is only lightly suggested rather than fully legible. |
| 2 | `openai/gpt-image-1.5` | 88.00 | 8.80 | 9.00 | 9.00 | 8.00 | 9.00 | 9.00 | generated-image-openai-gpt-image-1.5.png: Strong recursive pencil-drawing image that closely matches the prompt, with convincing graphite texture and multiple nested drawings. Minor anatomical/hand ambiguities and slight recursive clutter keep it from perfect. |
| 3 | `openai/gpt-image-2` | 86.00 | 8.60 | 9.00 | 9.00 | 8.00 | 9.00 | 8.00 | generated-image-openai-gpt-image-2.png: The image strongly matches the prompt: a highly detailed graphite-style drawing showing a recursive scene of a person drawing a person drawing, repeated several levels deep. It has excellent pencil texture, shading, and clear visual hierarchy. |
| 4 | `bfl/flux-2-max` | 84.00 | 8.40 | 9.00 | 8.00 | 8.00 | 9.00 | 8.00 | generated-image-bfl-flux-2-max.jpg: Strong pencil-style recursive drawing scene that closely matches the prompt, with clear nested figures and detailed graphite shading. Minor anatomical and fine-detail imperfections are present but not very distracting. |
| 5 | `grok/grok-imagine-image` | 84.00 | 8.40 | 8.00 | 9.00 | 8.00 | 9.00 | 8.00 | generated-image-grok-grok-imagine-image.jpg: Highly detailed pencil-style image with a convincing recursive drawing theme, though it depicts multiple artists rather than a single clear chain of one person drawing another person drawing another. |
| 6 | `gemini/gemini-3.1-flash-image-preview` | 82.00 | 8.20 | 8.00 | 9.00 | 8.00 | 8.00 | 8.00 | generated-image-gemini-gemini-3.1-flash-image-preview.png: Highly detailed pencil-style image with strong recursive drawing theme, especially in the right panel. It mostly matches the prompt, though the split-panel layout and extra scene make the recursion less clean than requested. |
| 7 | `grok/grok-imagine-image-quality` | 82.00 | 8.20 | 8.00 | 9.00 | 8.00 | 9.00 | 7.00 | generated-image-grok-grok-imagine-image-quality.jpg: A highly detailed graphite-style recursive drawing that strongly matches the requested pencil-drawing-within-a-drawing concept, though it adds extra people and some incidental text not asked for. |
| 8 | `bfl/flux-2-pro` | 80.00 | 8.00 | 7.00 | 9.00 | 8.00 | 8.00 | 8.00 | generated-image-bfl-flux-2-pro.jpg: High-quality monochrome pencil-style image of an artist drawing a nested scene, but the full recursive chain requested is only partially legible. |
| 9 | `reve/latest` | 76.00 | 7.60 | 7.00 | 8.00 | 7.00 | 8.00 | 8.00 | generated-image-reve-latest.png: A strong pencil-sketch style image with a clear recursive drawing setup, but the nested drawings do not consistently show full people drawing; they shift into hands, canvases, and small figures, so the exact prompt structure is only partially fulfilled. |

## Rubric

- Prompt adherence, visual quality, artifact control, composition, and detail/text handling are scored from 1 to 10.
- `qualityScore` is the average 1-10 score multiplied by 10 for 0-100 ranking compatibility.
- The score excludes cost, generation speed, file size, and provider latency.
