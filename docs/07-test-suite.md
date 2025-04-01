# CLI Test Suite

```bash
npm run test:cli-local
npm run test:cli
npm run test:models
```

```bash
clean && npm run as -- --rss "https://ajcwebdev.substack.com/feed" --whisper tiny
clean && npm run as -- --rss "https://ajcwebdev.substack.com/feed" --info

clean && npm run as -- --channel "https://www.youtube.com/@ajcwebdev" --info
clean && npm run as -- --video "https://www.youtube.com/watch?v=MORMZXEaONk"

clean && npm run as -- --playlist "https://www.youtube.com/playlist?list=PLCVnrVv4KhXPz0SoAVu8Rc1emAdGPbSbr" --whisper tiny
clean && npm run as -- --playlist "https://www.youtube.com/playlist?list=PLCVnrVv4KhXPz0SoAVu8Rc1emAdGPbSbr" --info
clean && npm run as -- --urls "content/examples/example-urls.md" --whisper tiny
clean && npm run as -- --urls "content/examples/example-urls.md" --info

clean && npm run as -- --file "content/examples/audio.mp3"
clean && npm run as -- --file "content/examples/audio.mp3" --whisper tiny
clean && npm run as -- --file "content/examples/audio.mp3" --prompt titles summary
clean && npm run as -- --file "content/examples/audio.mp3" --chatgpt
clean && npm run as -- --file "content/examples/audio.mp3" --claude
clean && npm run as -- --file "content/examples/audio.mp3" --gemini
clean && npm run as -- --file "content/examples/audio.mp3" --deepseek
clean && npm run as -- --file "content/examples/audio.mp3" --fireworks
clean && npm run as -- --file "content/examples/audio.mp3" --together
clean && npm run as -- --file "content/examples/audio.mp3" --deepgram
clean && npm run as -- --file "content/examples/audio.mp3" --assembly
clean && npm run as -- --file "content/examples/audio.mp3" --assembly best
clean && npm run as -- --file "content/examples/audio.mp3" --assembly nano
clean && npm run as -- --file "content/examples/audio.mp3" --deepgram nova-2
clean && npm run as -- --file "content/examples/audio.mp3" --deepgram base
clean && npm run as -- --file "content/examples/audio.mp3" --deepgram enhanced
clean && npm run as -- --file "content/examples/audio.mp3" --chatgpt gpt-4.5-preview
clean && npm run as -- --file "content/examples/audio.mp3" --chatgpt gpt-4o
clean && npm run as -- --file "content/examples/audio.mp3" --chatgpt gpt-4o-mini
clean && npm run as -- --file "content/examples/audio.mp3" --chatgpt o1-mini
clean && npm run as -- --file "content/examples/audio.mp3" --claude claude-3-7-sonnet-latest
clean && npm run as -- --file "content/examples/audio.mp3" --claude claude-3-5-haiku-latest
clean && npm run as -- --file "content/examples/audio.mp3" --claude claude-3-opus-latest
clean && npm run as -- --file "content/examples/audio.mp3" --gemini gemini-1.5-pro
clean && npm run as -- --file "content/examples/audio.mp3" --gemini gemini-1.5-flash-8b
clean && npm run as -- --file "content/examples/audio.mp3" --gemini gemini-1.5-flash
clean && npm run as -- --file "content/examples/audio.mp3" --gemini gemini-2.0-flash-lite
clean && npm run as -- --file "content/examples/audio.mp3" --gemini gemini-2.0-flash
clean && npm run as -- --file "content/examples/audio.mp3" --deepseek deepseek-chat
clean && npm run as -- --file "content/examples/audio.mp3" --deepseek deepseek-reasoner
clean && npm run as -- --file "content/examples/audio.mp3" --fireworks accounts/fireworks/models/llama-v3p1-405b-instruct
clean && npm run as -- --file "content/examples/audio.mp3" --fireworks accounts/fireworks/models/llama-v3p1-70b-instruct
clean && npm run as -- --file "content/examples/audio.mp3" --fireworks accounts/fireworks/models/llama-v3p1-8b-instruct
clean && npm run as -- --file "content/examples/audio.mp3" --fireworks accounts/fireworks/models/llama-v3p2-3b-instruct
clean && npm run as -- --file "content/examples/audio.mp3" --fireworks accounts/fireworks/models/qwen2p5-72b-instruct
clean && npm run as -- --file "content/examples/audio.mp3" --together meta-llama/Llama-3.2-3B-Instruct-Turbo
clean && npm run as -- --file "content/examples/audio.mp3" --together meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo
clean && npm run as -- --file "content/examples/audio.mp3" --together meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo
clean && npm run as -- --file "content/examples/audio.mp3" --together meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo
clean && npm run as -- --file "content/examples/audio.mp3" --together google/gemma-2-27b-it
clean && npm run as -- --file "content/examples/audio.mp3" --together google/gemma-2-9b-it
clean && npm run as -- --file "content/examples/audio.mp3" --together Qwen/Qwen2.5-72B-Instruct-Turbo
clean && npm run as -- --file "content/examples/audio.mp3" --together Qwen/Qwen2.5-7B-Instruct-Turbo
clean && npm run as -- --file "content/examples/audio.mp3" --prompt titles --whisper tiny --deepseek
clean && npm run as -- --file "content/examples/audio.mp3" --prompt summary --whisper tiny --deepseek
clean && npm run as -- --file "content/examples/audio.mp3" --prompt shortSummary --whisper tiny --deepseek
clean && npm run as -- --file "content/examples/audio.mp3" --prompt longSummary --whisper tiny --deepseek
clean && npm run as -- --file "content/examples/audio.mp3" --prompt bulletPoints --whisper tiny --deepseek
clean && npm run as -- --file "content/examples/audio.mp3" --prompt quotes --whisper tiny --deepseek
clean && npm run as -- --file "content/examples/audio.mp3" --prompt chapterTitlesAndQuotes --whisper tiny --deepseek
clean && npm run as -- --file "content/examples/audio.mp3" --prompt x --whisper tiny --deepseek
clean && npm run as -- --file "content/examples/audio.mp3" --prompt facebook --whisper tiny --deepseek
clean && npm run as -- --file "content/examples/audio.mp3" --prompt linkedin --whisper tiny --deepseek
clean && npm run as -- --file "content/examples/audio.mp3" --prompt chapterTitles --whisper tiny --deepseek
clean && npm run as -- --file "content/examples/audio.mp3" --prompt shortChapters --whisper tiny --deepseek
clean && npm run as -- --file "content/examples/audio.mp3" --prompt mediumChapters --whisper tiny --deepseek
clean && npm run as -- --file "content/examples/audio.mp3" --prompt longChapters --whisper tiny --deepseek
clean && npm run as -- --file "content/examples/audio.mp3" --prompt takeaways --whisper tiny --deepseek
clean && npm run as -- --file "content/examples/audio.mp3" --prompt questions --whisper tiny --deepseek
clean && npm run as -- --file "content/examples/audio.mp3" --prompt faq --whisper tiny --deepseek
clean && npm run as -- --file "content/examples/audio.mp3" --prompt blog --whisper tiny --deepseek
clean && npm run as -- --file "content/examples/audio.mp3" --prompt rapSong --whisper tiny --deepseek
clean && npm run as -- --file "content/examples/audio.mp3" --prompt rockSong --whisper tiny --deepseek
clean && npm run as -- --file "content/examples/audio.mp3" --prompt countrySong --whisper tiny --deepseek
```