# Video Quality Report

## Summary

- Run directory: `/Users/ajc/c/as/autoshow-cli/docs/benchmarks/video/2026-05-21_06-51-12-517_video-gen`
- Judge model: `gpt-5.5`
- Providers: 8
- Videos scored: 8
- Frames scored: 80

## Ranking

| Rank | Provider | Quality / 100 | Average / 10 | Prompt | Visual | Artifacts | Temporal | Composition/Camera | Evidence |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | `gemini/veo-3.1-lite-generate-preview` | 90.00 | 9.00 | 10.00 | 9.00 | 8.00 | 9.00 | 9.00 | generated-video-gemini-veo-3.1-lite-generate-preview.mp4: High-quality, photorealistic video matching the prompt: a man actively eating spaghetti. The action progresses clearly from lifting noodles to putting them in his mouth, with stable subject identity and appealing framing. |
| 2 | `gemini/veo-3.1-fast-generate-preview` | 88.00 | 8.80 | 10.00 | 9.00 | 8.00 | 8.00 | 9.00 | generated-video-gemini-veo-3.1-fast-generate-preview.mp4: The video clearly depicts a man eating spaghetti, with strong realism, appealing lighting, and a coherent dining-room setup. Motion is mostly believable, though the spaghetti and fork interaction show minor AI-style inconsistencies across frames. |
| 3 | `grok/grok-imagine-video` | 88.00 | 8.80 | 10.00 | 9.00 | 8.00 | 8.00 | 9.00 | generated-video-grok-grok-imagine-video.mp4: The video clearly depicts a man eating spaghetti in a restaurant setting, with attractive lighting, sharp subject detail, and a coherent eating action from twirling to lifting to biting and swallowing. Minor AI artifacts appear in the spaghetti/fork interaction and there is a noticeable camera/framing jump mid-sequence, but overall it is a strong match to the prompt. |
| 4 | `minimax/MiniMax-Hailuo-2.3` | 84.00 | 8.40 | 9.00 | 8.00 | 8.00 | 8.00 | 9.00 | generated-video-minimax-MiniMax-Hailuo-2.3.mp4: The video clearly depicts a man eating spaghetti at a table, with a coherent sequence of twirling, lifting, and eating the noodles. It is visually appealing and well-framed, with only minor generative artifacts in the fork, hand, and spaghetti motion. |
| 5 | `minimax/T2V-01` | 80.00 | 8.00 | 9.00 | 8.00 | 7.00 | 8.00 | 8.00 | generated-video-minimax-T2V-01.mp4: The video clearly depicts a man eating spaghetti, with a coherent progression from lifting noodles on a fork to slurping them. It is visually strong and readable, though heavily warm-toned and slightly stylized. Minor artifacts appear in the fork, hand, steam, and noodle behavior, but the scene remains convincing overall. |
| 6 | `glm/cogvideox-3` | 78.00 | 7.80 | 8.00 | 8.00 | 7.00 | 7.00 | 9.00 | generated-video-glm-cogvideox-3.mp4: Clear, attractive shot of a man with a plate of spaghetti, lifting noodles toward his mouth in a cozy kitchen. It fits the prompt well, though the actual eating moment is not fully convincing and some utensil/noodle physics are artificial. |
| 7 | `minimax/T2V-01-Director` | 74.00 | 7.40 | 7.00 | 8.00 | 7.00 | 8.00 | 7.00 | generated-video-minimax-T2V-01-Director.mp4: The video clearly depicts a man at a table with a bowl of spaghetti, lifting noodles with utensils in a warm cinematic setting. It fits the prompt reasonably well, though he never visibly takes a bite, so the 'eating' action is only implied. |
| 8 | `glm/viduq1-text` | 66.00 | 6.60 | 5.00 | 8.00 | 6.00 | 6.00 | 8.00 | generated-video-glm-viduq1-text.mp4: High-quality close-up of spaghetti being lifted with utensils, but it does not actually show a man eating; only hands and arms are visible. The scene is attractive and readable, with some utensil warping and continuity issues. |

## Rubric

- Prompt adherence, visual quality, artifact control, temporal consistency, and composition/camera are scored from 1 to 10.
- `qualityScore` is the average 1-10 score multiplied by 10 for 0-100 ranking compatibility.
- Each video is judged from exactly 10 midpoint-interval screenshots in one vision request.
- The score excludes cost, generation speed, file size, provider latency, and audio.
