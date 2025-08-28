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

echo "$p Checking whisper models availability"
for model in tiny base small; do
    if [ ! -f "/app/build/models/ggml-${model}.bin" ]; then
        echo "$p Downloading whisper model: ${model}"
        cd /app/build/models && wget -q "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${model}.bin" && cd /app
    fi
done

if [ "$1" = "bash" ] || [ "$1" = "sh" ]; then
    echo "$p Starting shell"
    exec "$@"
elif [ "$1" = "--help" ] || [ -z "$1" ]; then
    echo "$p Running autoshow-cli help"
    exec npx tsx --env-file=.env --no-warnings src/commander.ts --help
else
    echo "$p Running autoshow-cli with arguments: $@"
    exec npx tsx --env-file=.env --no-warnings src/commander.ts "$@"
fi