FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC
ENV NODE_VERSION=22.11.0
ENV PYTHON_VERSION=3.11
ENV WHISPER_CPP_VERSION=v1.7.3

WORKDIR /app

RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    cmake \
    pkg-config \
    libssl-dev \
    software-properties-common \
    ffmpeg \
    graphicsmagick \
    espeak-ng \
    python3.11 \
    python3.11-dev \
    python3.11-venv \
    python3-pip \
    libsndfile1 \
    libsndfile1-dev \
    libportaudio2 \
    libportaudiocpp0 \
    portaudio19-dev \
    libblas-dev \
    liblapack-dev \
    gfortran \
    rustc \
    cargo \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g npm@latest

RUN update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1 \
    && update-alternatives --set python3 /usr/bin/python3.11

RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod +x /usr/local/bin/yt-dlp \
    && ln -sf /usr/local/bin/yt-dlp /usr/bin/yt-dlp

RUN mkdir -p /app/build/pyenv/tts
RUN python3 -m venv /app/build/pyenv/tts \
    && /app/build/pyenv/tts/bin/pip install --upgrade pip setuptools wheel

RUN /app/build/pyenv/tts/bin/pip install --no-cache-dir \
    "numpy<2" \
    cffi \
    pycparser

RUN /app/build/pyenv/tts/bin/pip install --no-cache-dir \
    SoundFile \
    scipy

RUN /app/build/pyenv/tts/bin/pip install --no-cache-dir \
    torch==2.5.0 --index-url https://download.pytorch.org/whl/cpu

RUN /app/build/pyenv/tts/bin/pip install --no-cache-dir \
    torchaudio --index-url https://download.pytorch.org/whl/cpu

RUN /app/build/pyenv/tts/bin/pip install --no-cache-dir \
    librosa \
    sentencepiece \
    transformers \
    huggingface_hub \
    safetensors \
    protobuf

RUN /app/build/pyenv/tts/bin/pip install --no-cache-dir \
    TTS==0.22.0 || /app/build/pyenv/tts/bin/pip install --no-cache-dir git+https://github.com/coqui-ai/TTS.git

RUN /app/build/pyenv/tts/bin/pip install --no-cache-dir \
    https://github.com/KittenML/KittenTTS/releases/download/0.1/kittentts-0.1.0-py3-none-any.whl || true

RUN /app/build/pyenv/tts/bin/pip install --no-cache-dir \
    audiocraft || /app/build/pyenv/tts/bin/pip install --no-cache-dir git+https://github.com/facebookresearch/audiocraft.git

RUN /app/build/pyenv/tts/bin/pip install --no-cache-dir \
    xformers || true

RUN /app/build/pyenv/tts/bin/pip install --no-cache-dir \
    stable-audio-tools || /app/build/pyenv/tts/bin/pip install --no-cache-dir git+https://github.com/Stability-AI/stable-audio-tools.git

RUN /app/build/pyenv/tts/bin/pip install --no-cache-dir \
    einops \
    wandb \
    gradio || true

RUN mkdir -p /app/build/models /app/output /app/input /app/build/config \
    /app/build/models/audiocraft /app/build/models/stable-audio /app/build/models/sd \
    /app/build/pyenv/coreml

RUN ARCH=$(uname -m) && \
    if [ "$ARCH" = "x86_64" ]; then \
        python3 -m venv /app/build/pyenv/coreml && \
        /app/build/pyenv/coreml/bin/pip install --no-cache-dir \
            "coremltools>=7,<8" \
            ane-transformers \
            openai-whisper; \
        echo '{"available": true, "arch": "x86_64"}' > /app/build/config/.coreml-config.json; \
    else \
        echo '{"available": false, "arch": "arm64", "reason": "CoreML tools not supported on ARM64"}' > /app/build/config/.coreml-config.json; \
    fi

RUN git clone https://github.com/ggerganov/whisper.cpp.git /tmp/whisper-cpp \
    && cd /tmp/whisper-cpp \
    && git checkout ${WHISPER_CPP_VERSION} \
    && cmake -B build -S . -DBUILD_SHARED_LIBS=OFF \
    && cmake --build build --config Release -j$(nproc) \
    && mkdir -p /app/build/bin \
    && cp build/bin/whisper-cli /app/build/bin/ || cp build/bin/main /app/build/bin/whisper-cli \
    && cp build/src/*.a /app/build/bin/ 2>/dev/null || true \
    && cp build/ggml/src/*.a /app/build/bin/ 2>/dev/null || true \
    && rm -rf /tmp/whisper-cpp

RUN git clone https://github.com/leejet/stable-diffusion.cpp.git /tmp/stable-diffusion-cpp \
    && cd /tmp/stable-diffusion-cpp \
    && git submodule update --init --recursive \
    && mkdir -p build \
    && cd build \
    && cmake .. -DCMAKE_BUILD_TYPE=Release \
    && cmake --build . --config Release -j$(nproc) \
    && mkdir -p /app/build/bin \
    && cp bin/sd /app/build/bin/ || cp sd /app/build/bin/ \
    && chmod +x /app/build/bin/sd \
    && cd /app \
    && rm -rf /tmp/stable-diffusion-cpp

COPY package*.json ./
RUN apt-get update && apt-get install -y apt-utils && npm ci --omit=dev || npm install --omit=dev

COPY tsconfig.json ./
COPY .env.example ./.env
COPY src ./src
COPY .github/setup ./.github/setup

RUN mkdir -p build/models && \
    cd build/models && \
    echo "Downloading Whisper models..." && \
    wget -q --show-progress https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin && \
    wget -q --show-progress https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin && \
    wget -q --show-progress https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.safetensors -P sd/ && \
    cd ../..

RUN echo '{"python":"/app/build/pyenv/tts/bin/python","venv":"/app/build/pyenv/tts","coqui":{"default_model":"tts_models/en/ljspeech/tacotron2-DDC","xtts_model":"tts_models/multilingual/multi-dataset/xtts_v2"},"kitten":{"default_model":"KittenML/kitten-tts-nano-0.1","default_voice":"expr-voice-2-f"}}' > /app/build/config/.tts-config.json

RUN echo '{"python":"/app/build/pyenv/tts/bin/python","venv":"/app/build/pyenv/tts","audiocraft":{"default_model":"facebook/musicgen-small","cache_dir":"/app/build/models/audiocraft"},"stable_audio":{"default_model":"stabilityai/stable-audio-open-1.0","cache_dir":"/app/build/models/stable-audio"}}' > /app/build/config/.music-config.json

RUN /app/build/pyenv/tts/bin/python -c "from TTS.api import TTS; print('TTS import successful')" || echo "TTS import check failed, will download models on first use"

RUN /app/build/pyenv/tts/bin/python -c "import audiocraft; print('AudioCraft import successful')" || echo "AudioCraft import check failed, will work on first use"

RUN /app/build/pyenv/tts/bin/python -c "import stable_audio_tools; print('Stable Audio Tools import successful')" || echo "Stable Audio Tools import check failed, will work on first use"

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV PATH="/usr/local/bin:/app/build/bin:/app/build/pyenv/tts/bin:${PATH}"
ENV TTS_PYTHON_PATH=/app/build/pyenv/tts/bin/python
ENV COQUI_PYTHON_PATH=/app/build/pyenv/tts/bin/python
ENV KITTEN_PYTHON_PATH=/app/build/pyenv/tts/bin/python
ENV MUSIC_PYTHON_PATH=/app/build/pyenv/tts/bin/python
ENV PYTHONPATH=/app/build/pyenv/tts/lib/python3.11/site-packages
ENV AUDIOCRAFT_CACHE_DIR=/app/build/models/audiocraft
ENV HF_HOME=/app/build/models/stable-audio
ENV WANDB_MODE=offline

VOLUME ["/app/input", "/app/output", "/app/build/models", "/app/build/config"]

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["--help"]