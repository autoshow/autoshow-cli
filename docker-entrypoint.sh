#!/bin/bash
set -e

p='[docker-entrypoint]'

echo "$p Starting autoshow-cli container"
echo "$p Node version: $(node --version)"
echo "$p Python version: $(/app/build/pyenv/tts/bin/python --version)"
echo "$p Working directory: $(pwd)"

if [ ! -f .env ] && [ -f .env.example ]; then
    echo "$p Creating .env from .env.example"
    cp .env.example .env
fi

if [ -n "$OPENAI_API_KEY" ]; then
    echo "$p Setting OPENAI_API_KEY from environment"
    sed -i "s/^OPENAI_API_KEY=.*/OPENAI_API_KEY=$OPENAI_API_KEY/" .env
fi

if [ -n "$ANTHROPIC_API_KEY" ]; then
    echo "$p Setting ANTHROPIC_API_KEY from environment"
    sed -i "s/^ANTHROPIC_API_KEY=.*/ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY/" .env
fi

if [ -n "$GEMINI_API_KEY" ]; then
    echo "$p Setting GEMINI_API_KEY from environment"
    sed -i "s/^GEMINI_API_KEY=.*/GEMINI_API_KEY=$GEMINI_API_KEY/" .env
fi

if [ -n "$DEEPGRAM_API_KEY" ]; then
    echo "$p Setting DEEPGRAM_API_KEY from environment"
    sed -i "s/^DEEPGRAM_API_KEY=.*/DEEPGRAM_API_KEY=$DEEPGRAM_API_KEY/" .env
fi

if [ -n "$ASSEMBLY_API_KEY" ]; then
    echo "$p Setting ASSEMBLY_API_KEY from environment"
    sed -i "s/^ASSEMBLY_API_KEY=.*/ASSEMBLY_API_KEY=$ASSEMBLY_API_KEY/" .env
fi

if [ -n "$ELEVENLABS_API_KEY" ]; then
    echo "$p Setting ELEVENLABS_API_KEY from environment"
    sed -i "s/^ELEVENLABS_API_KEY=.*/ELEVENLABS_API_KEY=$ELEVENLABS_API_KEY/" .env
fi

if [ -n "$AWS_ACCESS_KEY_ID" ]; then
    echo "$p Setting AWS_ACCESS_KEY_ID from environment"
    sed -i "s/^AWS_ACCESS_KEY_ID=.*/AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID/" .env
fi

if [ -n "$AWS_SECRET_ACCESS_KEY" ]; then
    echo "$p Setting AWS_SECRET_ACCESS_KEY from environment"
    sed -i "s/^AWS_SECRET_ACCESS_KEY=.*/AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY/" .env
fi

if [ -n "$BFL_API_KEY" ]; then
    echo "$p Setting BFL_API_KEY from environment"
    sed -i "s/^BFL_API_KEY=.*/BFL_API_KEY=$BFL_API_KEY/" .env
fi

if [ -n "$GROQ_API_KEY" ]; then
    echo "$p Setting GROQ_API_KEY from environment"
    sed -i "s/^GROQ_API_KEY=.*/GROQ_API_KEY=$GROQ_API_KEY/" .env
fi

if [ -n "$HF_TOKEN" ]; then
    echo "$p Setting HF_TOKEN from environment for music model access"
    sed -i "s/^HF_TOKEN=.*/HF_TOKEN=$HF_TOKEN/" .env
fi

if [ -n "$HUGGING_FACE_HUB_TOKEN" ]; then
    echo "$p Setting HUGGING_FACE_HUB_TOKEN from environment"
    sed -i "s/^HUGGING_FACE_HUB_TOKEN=.*/HUGGING_FACE_HUB_TOKEN=$HUGGING_FACE_HUB_TOKEN/" .env
fi

echo "$p Validating dependencies"

if ! command -v yt-dlp &> /dev/null; then
    echo "$p Critical: yt-dlp not found in PATH, attempting to fix"
    if [ -f "/usr/local/bin/yt-dlp" ]; then
        echo "$p Found yt-dlp at /usr/local/bin/yt-dlp, updating PATH"
        export PATH="/usr/local/bin:$PATH"
        ln -sf /usr/local/bin/yt-dlp /usr/bin/yt-dlp 2>/dev/null || true
    else
        echo "$p Downloading yt-dlp as fallback"
        curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
        chmod +x /usr/local/bin/yt-dlp
        ln -sf /usr/local/bin/yt-dlp /usr/bin/yt-dlp
    fi
    
    if command -v yt-dlp &> /dev/null; then
        echo "$p yt-dlp now available at: $(which yt-dlp)"
    else
        echo "$p Warning: yt-dlp still not available, video processing will fail"
    fi
else
    echo "$p yt-dlp found: $(which yt-dlp)"
fi

if [ ! -f "/app/build/bin/whisper-cli" ]; then
    echo "$p Warning: whisper-cli not found, transcription may fail"
else
    echo "$p whisper-cli found: /app/build/bin/whisper-cli"
fi

if [ ! -f "/app/build/bin/sd" ]; then
    echo "$p Warning: stable-diffusion.cpp not found, image generation may fail"
else
    echo "$p stable-diffusion.cpp found: /app/build/bin/sd"
fi

echo "$p Checking whisper models availability"
for model in tiny base small; do
    if [ ! -f "/app/build/models/ggml-${model}.bin" ]; then
        echo "$p Downloading whisper model: ${model}"
        cd /app/build/models && wget -q "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${model}.bin" && cd /app
    fi
done

echo "$p Ensuring music model directories exist"
mkdir -p /app/build/models/audiocraft /app/build/models/stable-audio

echo "$p Checking CoreML availability"
if [ -f "/app/build/config/.coreml-config.json" ]; then
    COREML_STATUS=$(cat /app/build/config/.coreml-config.json | grep -o '"available":[^,}]*' | cut -d: -f2 | tr -d ' "')
    if [ "$COREML_STATUS" = "true" ]; then
        echo "$p CoreML environment available"
    else
        echo "$p CoreML environment not available, will fallback to regular whisper"
    fi
else
    echo "$p CoreML config not found, assuming unavailable"
    echo '{"available": false, "reason": "config not found"}' > /app/build/config/.coreml-config.json
fi

if [ "$1" = "bash" ] || [ "$1" = "sh" ]; then
    echo "$p Starting shell"
    exec "$@"
elif [ "$1" = "--help" ] || [ -z "$1" ]; then
    echo "$p Running autoshow-cli help"
    exec npx tsx --env-file=./.env --no-warnings src/commander.ts --help
else
    echo "$p Running autoshow-cli with arguments: $@"
    exec npx tsx --env-file=./.env --no-warnings src/commander.ts "$@"
fi