# Video Quality Report

## Summary

- Run directory: `/Users/ajc/c/as/autoshow-cli/docs/benchmarks/video/2026-05-21_06-50-32-135_video-gen`
- Judge model: `gpt-5.5`
- Providers: 9
- Videos scored: 9
- Frames scored: 90

## Ranking

| Rank | Provider | Quality / 100 | Average / 10 | Prompt | Visual | Artifacts | Temporal | Composition/Camera | Evidence |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | `gemini/veo-3.1-generate-preview` | 88.00 | 8.80 | 9.00 | 9.00 | 8.00 | 9.00 | 9.00 | generated-video-gemini-veo-3.1-generate-preview.mp4: Strong match to a rainy neon city street with a slow, coherent camera move. The scene is atmospheric, reflective, and visually polished, with only minor generative issues in sign text and some vehicle/detail softness. |
| 2 | `minimax/MiniMax-Hailuo-2.3` | 88.00 | 8.80 | 9.00 | 9.00 | 8.00 | 9.00 | 9.00 | generated-video-minimax-MiniMax-Hailuo-2.3.mp4: Strong fit to the prompt: a wet, rainy-feeling neon city street with a clear slow pan and consistent nighttime atmosphere. Visuals are cinematic with rich reflections and stable lighting, though some signage is nonsensical and rain is mostly implied by wet pavement rather than visible rainfall. |
| 3 | `minimax/T2V-01-Director` | 88.00 | 8.80 | 9.00 | 9.00 | 8.00 | 9.00 | 9.00 | generated-video-minimax-T2V-01-Director.mp4: Strong match to the prompt: a rainy neon city street with glossy reflections and a slow, coherent camera pan. The scene remains stable and visually striking across frames, with only minor AI artifacts such as unreadable signage and slight neon bloom/overexposure. |
| 4 | `grok/grok-imagine-video` | 86.00 | 8.60 | 9.00 | 9.00 | 8.00 | 8.00 | 9.00 | generated-video-grok-grok-imagine-video.mp4: Strong match to the prompt: a rainy neon city street with reflective pavement and a slow lateral pan. The scene is visually polished and atmospheric, with only minor AI-text/sign artifacts and slight continuity concerns in vehicles/pedestrians. |
| 5 | `gemini/veo-3.1-lite-generate-preview` | 84.00 | 8.40 | 9.00 | 9.00 | 8.00 | 8.00 | 8.00 | generated-video-gemini-veo-3.1-lite-generate-preview.mp4: Strong depiction of a rainy neon city street with wet reflective pavement, heavy rain, pedestrians, signs, and a coherent slow camera move. The motion reads more like a forward tracking pan into an alley than a pure lateral pan, but it fits the requested mood very well. |
| 6 | `gemini/veo-3.1-fast-generate-preview` | 80.00 | 8.00 | 9.00 | 9.00 | 7.00 | 7.00 | 8.00 | generated-video-gemini-veo-3.1-fast-generate-preview.mp4: Strong fit to a rainy neon city street with vivid reflections, heavy rain, signage, pedestrians, and a coherent slow moving camera feel. Visuals are cinematic and atmospheric, though some generated signage is nonsensical and the prominent fish hologram changes color/shape noticeably over time. |
| 7 | `glm/viduq1-text` | 80.00 | 8.00 | 9.00 | 8.00 | 7.00 | 8.00 | 8.00 | generated-video-glm-viduq1-text.mp4: Strong match to the prompt: a rainy neon city street with wet reflections, umbrellas, and an apparent slow rightward camera pan. The scene is visually rich and coherent, though some signage/text, rain streaks, and distant pedestrians show typical generative artifacts. |
| 8 | `minimax/T2V-01` | 80.00 | 8.00 | 9.00 | 8.00 | 7.00 | 8.00 | 8.00 | generated-video-minimax-T2V-01.mp4: Strong fit to the prompt with a vivid rainy neon city street, wet reflections, umbrellas, traffic, and an implied slow pan/steady camera move. Visuals are cinematic and coherent, though headlights and neon bloom are overexposed and some signage/object details show AI artifacts. |
| 9 | `glm/cogvideox-3` | 78.00 | 7.80 | 8.00 | 8.00 | 7.00 | 8.00 | 8.00 | generated-video-glm-cogvideox-3.mp4: Strong neon rainy city street scene with vivid wet-road reflections and consistent urban atmosphere. The requested slow pan is only subtly implied, and some generated details show typical artifacts, but the overall video fits the prompt well. |

## Rubric

- Prompt adherence, visual quality, artifact control, temporal consistency, and composition/camera are scored from 1 to 10.
- `qualityScore` is the average 1-10 score multiplied by 10 for 0-100 ranking compatibility.
- Each video is judged from exactly 10 midpoint-interval screenshots in one vision request.
- The score excludes cost, generation speed, file size, provider latency, and audio.
