# Music Generation Command

Generate AI-powered instrumental music using Google's Lyria RealTime or AWS SageMaker MusicGen models with customizable prompts, styles, and musical parameters.

## Available Services

### 1. Google Lyria RealTime
⚠️ **Experimental Preview**: Lyria RealTime is currently in experimental preview and requires WebSocket support that isn't yet available in the Google Generative AI SDK for Node.js.

**Alternative Options:**
- **Web Interface**: Try the [Prompt DJ](https://aistudio.google.com/apps/bundled/promptdj) on AI Studio
- **MIDI Support**: Use the [MIDI DJ](https://aistudio.google.com/apps/bundled/promptdj-midi) for MIDI control
- **Python SDK**: The Python SDK has experimental support for Lyria RealTime
- **Placeholder Mode**: The current implementation generates test audio files for pipeline testing

### 2. AWS SageMaker MusicGen
**Production Ready**: Deploy Meta's AudioCraft MusicGen models on Amazon SageMaker for scalable music generation.

**Available Models:**
- `musicgen-small` - Fastest, lower quality (300M parameters)
- `musicgen-medium` - Balanced performance (1.5B parameters)
- `musicgen-large` - Best quality, slower (3.3B parameters)

**Features:**
- Asynchronous inference for long-running generations
- Auto-scaling capabilities
- S3 integration for input/output storage
- Support for 30+ second generation

## Setup

### Lyria Setup
Add your Gemini API key to `.env`:
```env
GEMINI_API_KEY=your_gemini_api_key
```

### SageMaker Setup

#### 1. Deploy MusicGen to SageMaker
Follow the [AWS guide](https://aws.amazon.com/blogs/machine-learning/inference-audiocraft-musicgen-models-using-amazon-sagemaker/) to deploy a MusicGen model endpoint.

Quick deployment steps:
```python
# Example deployment code (run in SageMaker notebook)
from sagemaker.huggingface import HuggingFaceModel

huggingface_model = HuggingFaceModel(
    model_data='s3://your-bucket/model.tar.gz',
    role='your-sagemaker-role',
    transformers_version='4.37',
    pytorch_version='2.1',
    py_version='py310',
)

predictor = huggingface_model.deploy(
    initial_instance_count=1,
    instance_type='ml.g5.2xlarge',
    endpoint_name='musicgen-large-endpoint'
)
```

#### 2. Configure AWS Credentials
Add to `.env`:
```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1

SAGEMAKER_MUSICGEN_ENDPOINT=musicgen-large-endpoint
SAGEMAKER_MUSICGEN_S3_BUCKET=your-s3-bucket
```

#### 3. Create S3 Bucket
```bash
aws s3 mb s3://your-musicgen-bucket --region us-east-1
```

## Basic Usage

### Generate Music with Lyria
```bash
# Simple generation with a single prompt
npm run as -- music generate --prompt "A salsa jazz tune"

# Multiple weighted prompts
npm run as -- music generate --prompt "techno:1.0,ambient:0.5"

# With custom duration
npm run as -- music generate --prompt "meditation music" --duration 60
```

### Generate Music with SageMaker
```bash
# Use SageMaker service
npm run as -- music generate --service sagemaker --prompt "80s pop track with bassy drums"

# Specify model size
npm run as -- music generate --service sagemaker --sagemaker-model musicgen-medium --prompt "jazz fusion"

# Override endpoint and bucket
npm run as -- music generate --service sagemaker \
  --sagemaker-endpoint my-custom-endpoint \
  --sagemaker-bucket my-bucket \
  --prompt "ambient soundscape"

# Long-form generation (90 seconds)
npm run as -- music generate --service sagemaker \
  --prompt "cinematic orchestral score" \
  --duration 90
```

### Check Service Availability
```bash
# Check all services
npm run as -- music check

# Check specific service
npm run as -- music check --service sagemaker
npm run as -- music check --service lyria
```

### List Example Prompts
```bash
# Show all example prompts
npm run as -- music list-prompts

# Service-specific examples
npm run as -- music list-prompts --service sagemaker
npm run as -- music list-prompts --service lyria
```

## Command Options

### Core Options
- `-p, --prompt <text>` - **Required**. Music generation prompt(s)
- `-s, --service <service>` - Music generation service: `lyria` or `sagemaker` (default: lyria)
- `-o, --output <path>` - Output file path (default: auto-generated in output/)
- `-d, --duration <seconds>` - Duration in seconds (default: 30)

### Musical Parameters (Lyria)
- `--bpm <number>` - Beats per minute (60-200)
- `--scale <scale>` - Musical scale (see scales below)
- `--guidance <number>` - How strictly to follow prompts (0.0-6.0, default: 4.0)
- `--density <number>` - Note density (0.0-1.0)
- `--brightness <number>` - Tonal brightness (0.0-1.0)

### Audio Control (Lyria)
- `--mute-bass` - Reduce/remove bass frequencies
- `--mute-drums` - Reduce/remove drums
- `--only-bass-drums` - Generate only bass and drums

### Generation Settings
- `--mode <mode>` - Generation mode: QUALITY, DIVERSITY, or VOCALIZATION (default: QUALITY)
- `--temperature <number>` - Sampling temperature (0.0-3.0, default: 1.1)
- `--seed <number>` - Random seed for reproducibility

### SageMaker-Specific Options
- `--sagemaker-model <model>` - Model size: `musicgen-small`, `musicgen-medium`, or `musicgen-large` (default: musicgen-large)
- `--sagemaker-endpoint <name>` - Override SageMaker endpoint name from environment
- `--sagemaker-bucket <name>` - Override S3 bucket name from environment

## Service Comparison

| Feature | Lyria RealTime | SageMaker MusicGen |
|---------|---------------|-------------------|
| **Status** | Experimental Preview | Production Ready |
| **Max Duration** | 30 seconds | 30+ seconds |
| **Model Sizes** | Single model | Small/Medium/Large |
| **Infrastructure** | Google Cloud | AWS |
| **Scaling** | Automatic | Configurable auto-scaling |
| **Latency** | Real-time (when available) | Asynchronous |
| **Cost Model** | API usage | EC2 instance hours |
| **Prompt Styles** | Weighted prompts | Text descriptions |
| **Audio Quality** | High | Varies by model |
| **Customization** | Limited | Full control |

## Prompt Format

### Single Prompt
```bash
--prompt "minimal techno"
```

### Weighted Prompts (Lyria)
Use the format `prompt:weight` to blend multiple styles:
```bash
--prompt "jazz:1.0,ambient:0.5,piano:0.3"
```

### Descriptive Prompts (SageMaker)
MusicGen works best with natural language descriptions:
```bash
--prompt "A cheerful country song with acoustic guitars"
--prompt "90s rock song with loud guitars and heavy drums"
--prompt "Lofi slow bpm electro chill with organic samples"
```

## Musical Scales (Lyria Only)

Available scale options for the `--scale` parameter:

| Scale Code | Musical Key |
|------------|-------------|
| `C_MAJOR_A_MINOR` | C major / A minor |
| `D_FLAT_MAJOR_B_FLAT_MINOR` | D♭ major / B♭ minor |
| `D_MAJOR_B_MINOR` | D major / B minor |
| `E_FLAT_MAJOR_C_MINOR` | E♭ major / C minor |
| `E_MAJOR_D_FLAT_MINOR` | E major / C♯ minor |
| `F_MAJOR_D_MINOR` | F major / D minor |
| `G_FLAT_MAJOR_E_FLAT_MINOR` | G♭ major / E♭ minor |
| `G_MAJOR_E_MINOR` | G major / E minor |
| `A_FLAT_MAJOR_F_MINOR` | A♭ major / F minor |
| `A_MAJOR_G_FLAT_MINOR` | A major / F♯ minor |
| `B_FLAT_MAJOR_G_MINOR` | B♭ major / G minor |
| `B_MAJOR_A_FLAT_MINOR` | B major / G♯ minor |
| `SCALE_UNSPECIFIED` | Let the model decide |

## Example Prompts

### Lyria Prompts
**Instruments**: 303 Acid Bass, 808 Hip Hop Beat, Accordion, Banjo, Cello, Flamenco Guitar, Harmonica, Piano, Violin

**Genres**: Acid Jazz, Chillout, Deep House, Drum & Bass, Dubstep, Minimal Techno, Synthpop, Trance

**Moods**: Ambient, Chill, Dreamy, Ethereal, Psychedelic, Danceable, Funky, Upbeat

### SageMaker MusicGen Prompts
**Simple Descriptions**:
- "80s pop track with bassy drums and synth"
- "90s rock song with loud guitars and heavy drums"
- "A cheerful country song with acoustic guitars"
- "Earthy tones, environmentally conscious, ukulele-infused"

**Complex Descriptions**:
- "Warm and vibrant weather on a sunny day, feeling the vibes of hip hop and synth"
- "Catchy funky beats with drums and bass, synthesized pop for an upbeat pop game"
- "Violins and synths that inspire awe at the finiteness of life and the universe"
- "Lofi slow bpm electro chill with organic samples"

## Usage Examples

### Ambient Meditation (Lyria)
```bash
npm run as -- music generate \
  --prompt "meditation,tibetan bowls,ambient:1.0,peaceful:0.8" \
  --duration 300 \
  --density 0.2 \
  --brightness 0.3
```

### Ambient Meditation (SageMaker)
```bash
npm run as -- music generate \
  --service sagemaker \
  --prompt "Peaceful meditation music with tibetan bowls and ambient textures" \
  --duration 60 \
  --temperature 0.8
```

### Dance Music (Lyria)
```bash
npm run as -- music generate \
  --prompt "techno:1.0,acid bass:0.5,303:0.3" \
  --bpm 128 \
  --density 0.8 \
  --mode QUALITY
```

### Dance Music (SageMaker)
```bash
npm run as -- music generate \
  --service sagemaker \
  --prompt "High energy techno track with acid bass and 303 synthesizer at 128 BPM" \
  --sagemaker-model musicgen-large \
  --guidance 3.5
```

### Jazz Session
```bash
# Lyria version
npm run as -- music generate \
  --prompt "jazz fusion,saxophone:0.8,piano:0.6,drums:0.4" \
  --bpm 90 \
  --scale F_MAJOR_D_MINOR

# SageMaker version
npm run as -- music generate \
  --service sagemaker \
  --prompt "Jazz fusion session with prominent saxophone, piano comping, and subtle drums in F major" \
  --duration 45
```

### Experimental Soundscape
```bash
# Lyria version
npm run as -- music generate \
  --prompt "experimental:1.0,glitch:0.5,ambient:0.3" \
  --mode DIVERSITY \
  --temperature 2.0

# SageMaker version
npm run as -- music generate \
  --service sagemaker \
  --sagemaker-model musicgen-medium \
  --prompt "Experimental glitch music with ambient textures and unexpected sonic elements" \
  --temperature 1.5
```

### Production Pipeline Example
```bash
# Generate base track with SageMaker
npm run as -- music generate \
  --service sagemaker \
  --sagemaker-model musicgen-large \
  --prompt "Cinematic orchestral base with strings and brass" \
  --duration 120 \
  --output base-track.wav

# Generate overlay with different prompt
npm run as -- music generate \
  --service sagemaker \
  --prompt "Ethereal choir and atmospheric pads" \
  --duration 120 \
  --output overlay-track.wav
```

## Output Format

Generated music files are saved as:
- **Format**: WAV (48kHz, 16-bit, stereo for Lyria; 32kHz, 16-bit, mono/stereo for MusicGen)
- **Location**: `output/` directory by default
- **Naming**: 
  - Lyria: `lyria-{timestamp}-{random}.wav`
  - SageMaker: `sagemaker-musicgen-{timestamp}-{random}.wav`

## Best Practices

### Effective Prompting
1. **Lyria**: Use weighted combinations of instruments, genres, and moods
2. **SageMaker**: Use natural language descriptions with specific details
3. **Both**: Be descriptive about mood, tempo, and instrumentation
4. **Iterate**: Start simple and add complexity gradually

### Service Selection
- **Use Lyria when**: You need real-time generation (when available), specific musical scales, or weighted prompt blending
- **Use SageMaker when**: You need production reliability, longer durations, different model sizes, or have existing AWS infrastructure

### Parameter Guidelines
- **Guidance** (0-6): Higher values = stricter prompt following
- **Temperature** (0-3): Lower = predictable, Higher = experimental
- **Model Size** (SageMaker): Small = fast/draft, Large = quality/final

## Cost Considerations

### Lyria
- Charged per API call
- No infrastructure costs
- Pay-as-you-go model

### SageMaker
- EC2 instance costs (ml.g5.xlarge recommended)
- S3 storage costs
- Data transfer costs
- Can use spot instances for cost savings
- Auto-scaling to zero when not in use

## Limitations

### Lyria
- **Instrumental Only**: No lyrics generation
- **Duration**: Maximum 30 seconds
- **Availability**: Limited SDK support currently

### SageMaker
- **Setup Required**: Needs endpoint deployment
- **Cold Start**: First generation after idle period is slower
- **Infrastructure**: Requires AWS account and permissions

## Troubleshooting

### Lyria Issues
```bash
# Verify API key
echo $GEMINI_API_KEY

# Check model availability
npm run as -- music check --service lyria
```

### SageMaker Issues
```bash
# Verify AWS credentials
aws sts get-caller-identity

# Check endpoint status
aws sagemaker describe-endpoint --endpoint-name $SAGEMAKER_MUSICGEN_ENDPOINT

# Test S3 access
aws s3 ls s3://$SAGEMAKER_MUSICGEN_S3_BUCKET

# Check service availability
npm run as -- music check --service sagemaker
```

### Common Problems

**SageMaker Endpoint Not Found**
- Ensure endpoint is deployed and InService
- Check endpoint name matches configuration
- Verify AWS region is correct

**S3 Access Denied**
- Check IAM permissions for S3 bucket
- Ensure bucket exists in the specified region
- Verify credentials have s3:PutObject and s3:GetObject permissions

**Generation Timeout**
- SageMaker: Increase invocation timeout
- Check instance type has sufficient resources
- Consider using a larger instance type for complex prompts

## Additional Resources

### Lyria
- [Lyria Technology Overview](https://deepmind.google/technologies/lyria/)
- [AI Studio Prompt DJ](https://aistudio.google.com/apps/bundled/promptdj)
- [Google AI Music Generation Docs](https://ai.google.dev/gemini-api/docs/music-generation)

### SageMaker MusicGen
- [AWS Blog: Inference AudioCraft MusicGen](https://aws.amazon.com/blogs/machine-learning/inference-audiocraft-musicgen-models-using-amazon-sagemaker/)
- [AudioCraft GitHub Repository](https://github.com/facebookresearch/audiocraft)
- [MusicGen Model Card](https://huggingface.co/facebook/musicgen-large)
- [SageMaker Async Inference Guide](https://docs.aws.amazon.com/sagemaker/latest/dg/async-inference.html)
- [Example Notebooks](https://github.com/aws-samples/inference-audiocraft-musicgen-on-amazon-sagemaker)