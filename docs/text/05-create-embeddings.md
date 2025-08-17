# Create Embeddings

Generate vector embeddings from markdown files in the `content` directory and store them in Cloudflare Vectorize for semantic search and retrieval using the `bge-m3` embedding model and `gpt-oss-120b` for text generation.

## Prerequisites

Before using the embeddings commands, ensure you have the following environment variables set:

```bash
# Required Cloudflare credentials
CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id
CLOUDFLARE_API_TOKEN=your-cloudflare-api-token

# Optional (defaults to 'autoshow-cli-embeddings')
VECTORIZE_INDEX_NAME=autoshow-cli-embeddings
```

## Setup Cloudflare Credentials

### Step 1: Get Your Account ID

1. Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Copy your Account ID from the right sidebar or from the URL
3. Add it to your `.env` file:
   ```bash
   CLOUDFLARE_ACCOUNT_ID=your-32-character-account-id
   ```

### Step 2: Create an API Token

You can create an API token either manually through the dashboard (recommended) or using the CLI helper.

#### Option A: Manual Token Creation (Recommended)

1. Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click "Create Token"
3. Choose "Custom token" template
4. Configure the token:
   - **Token name**: `Vectorize API Token`
   - **Permissions**: Add these permissions:
     - Account → Vectorize → Read
     - Account → Vectorize → Write  
     - Account → Workers Scripts → Edit
     - Account → Workers KV Storage → Edit
     - Account → Workers Routes → Edit
     - Account → Account Analytics → Read
   - **Account Resources**: Include → Your Account
   - **Client IP Address Filtering**: Leave blank
   - **TTL**: No expiry
5. Click "Continue to summary" → "Create Token"
6. **Important**: Copy the token immediately (shown only once!)
7. Add it to your `.env` file:
   ```bash
   CLOUDFLARE_API_TOKEN=your-api-token
   ```

#### Option B: CLI Helper (Alternative)

First, add your global API key to `.env`:
```bash
CLOUDFLARE_EMAIL=your-email@example.com
CLOUDFLARE_GLOBAL_API_KEY=your-global-api-key
```

Then use the CLI helper:
```bash
# List available permissions
npm run as -- text cloudflare list-permissions

# Create a token with Vectorize permissions
npm run as -- text cloudflare create-vectorize-token
```

### Step 3: Test Your Token

Verify your token works:
```bash
npm run as -- text cloudflare test-token
```

Expected output:
```
✅ Token is valid!
- Token ID: abc123...
- Status: active
✅ Token has access to Vectorize API!
```

## Creating Embeddings

Generate embeddings from all markdown files in a directory and upload them to Cloudflare Vectorize:

```bash
# Create embeddings from the default 'content' directory
npm run as -- text embed --create

# Create embeddings from a specific directory
npm run as -- text embed --create "content/embed"

# Create embeddings from a custom path
npm run as -- text embed --create "/path/to/markdown/files"
```

This command will:
1. Scan the specified directory recursively for all `.md` files
2. Generate vector embeddings using Cloudflare Workers AI `@cf/baai/bge-m3` model (1024 dimensions)
3. Create a Vectorize index if it doesn't exist
4. Upload the vectors to your Cloudflare Vectorize index
5. Store metadata including filename and content excerpt for each vector

## Querying Embeddings

Search through your embeddings using natural language queries:

```bash
# Query with a question
npm run as -- text embed --query "What's the deal with these show notes? Answer in the voice of Jerry Seinfeld."

# Query for specific topics
npm run as -- text embed --query "Tell me about machine learning topics discussed"

# Query for summaries
npm run as -- text embed --query "Summarize the main themes across all documents"
```

The query command will:
1. Convert your question into a vector embedding using `bge-m3`
2. Search Cloudflare Vectorize for the most similar vectors
3. Retrieve the associated document content
4. Use Cloudflare Workers AI `gpt-oss-120b` to generate an answer based on the retrieved context

## Features

- **Fully Cloudflare-based**: Uses Cloudflare Workers AI for both embeddings and text generation
- **Automatic Index Management**: Creates and configures Vectorize indexes automatically
- **Batch Processing**: Embeddings are created and uploaded in batches for efficiency
- **Metadata Storage**: Each vector includes metadata with filename and content excerpts
- **Semantic Search**: Uses cosine similarity to find the most relevant documents
- **Context-Aware Responses**: Combines retrieved documents with `gpt-oss-120b` for intelligent answers
- **Progress Tracking**: Displays progress for large document sets
- **Error Handling**: Comprehensive error messages and troubleshooting guidance

## Models Used

- **Embeddings**: `@cf/baai/bge-m3` (1024 dimensions, multilingual)
- **Text Generation**: `@cf/openai/gpt-oss-120b` (128k context window)
- **Vector Database**: Cloudflare Vectorize (cosine similarity)

## Limits

- Maximum 10,000 characters of content stored per vector metadata
- Batch upload size of 100 vectors at a time to Vectorize
- Returns top 5 most relevant documents by default
- Vectorize index dimensions: 1024 (matches bge-m3 output)

## Troubleshooting

### Common Issues

#### 1. Authentication Errors
```bash
# Test your credentials
npm run as -- text cloudflare test-token
```

If the test fails:
- Verify `CLOUDFLARE_ACCOUNT_ID` is correct (32-character hex string)
- Ensure `CLOUDFLARE_API_TOKEN` has proper permissions
- Try creating a new token with the required permissions

#### 2. Index Not Found
```
Error: Vectorize index 'autoshow-cli-embeddings' does not exist
```

The index will be created automatically when you run `--create`. If you see this error during queries, create embeddings first:
```bash
npm run as -- text embed --create
```

#### 3. Permission Denied
```
❌ Token does NOT have access to Vectorize API
```

Your token is missing Vectorize permissions. Create a new token:
```bash
npm run as -- text cloudflare create-vectorize-token
```

#### 4. Rate Limits
The system includes automatic batching to avoid API rate limits. If you encounter rate limits:
- Reduce batch sizes in the code
- Add delays between requests
- Check your Cloudflare plan limits

#### 5. Network Issues
- Check your internet connection
- Verify Cloudflare services are operational
- Try again after a brief delay

### Debugging Commands

```bash
# List all available permissions for your account
npm run as -- text cloudflare list-permissions

# Test token validity and permissions
npm run as -- text cloudflare test-token

# Create a new token with proper permissions
npm run as -- text cloudflare create-vectorize-token --name "My Vectorize Token"
```

## Example Workflow

```bash
# 1. Set up credentials (first time only)
# Add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN to .env

# 2. Test your setup
npm run as -- text cloudflare test-token

# 3. Generate show notes for multiple videos
npm run as -- text --playlist "https://www.youtube.com/playlist?list=PLCVnrVv4KhXPz0SoAVu8Rc1emAdGPbSbr"

# 4. Create embeddings from the generated content
npm run as -- text embed --create "content"

# 5. Query the knowledge base
npm run as -- text embed --query "What are the key topics discussed across all episodes?"

# 6. Ask specific questions
npm run as -- text embed --query "How do the speakers approach problem-solving in software development?"
```

## Cost Considerations

### Cloudflare Workers AI Pricing
- **Embeddings** (`bge-m3`): $0.012 per million input tokens
- **Text Generation** (`gpt-oss-120b`): $0.35 per million input tokens, $0.75 per million output tokens
- **Vectorize**: Storage and query costs apply

### Optimization Tips
- Process files in batches to minimize API calls
- Use concise content for embeddings to reduce token usage
- Store frequently queried content in your index
- Monitor usage through Cloudflare dashboard

## Security Best Practices

1. **API Token Security**:
   - Never commit tokens to version control
   - Use environment variables only
   - Rotate tokens periodically
   - Limit token permissions to minimum required

2. **Content Security**:
   - Review content before creating embeddings
   - Be mindful of sensitive information in metadata
   - Use appropriate content filtering

3. **Access Control**:
   - Limit token scope to specific accounts/resources
   - Monitor API usage for unusual activity
   - Use IP restrictions if working from fixed locations

## Advanced Configuration

### Custom Index Names
```bash
# Use a custom index name
VECTORIZE_INDEX_NAME=my-custom-index npm run as -- text embed --create
```

### Environment Variables Reference
```bash
# Required
CLOUDFLARE_ACCOUNT_ID=your-32-char-account-id
CLOUDFLARE_API_TOKEN=your-api-token

# Optional
VECTORIZE_INDEX_NAME=autoshow-cli-embeddings  # Default index name

# For token creation (optional)
CLOUDFLARE_EMAIL=your-email@example.com
CLOUDFLARE_GLOBAL_API_KEY=your-global-key
```

### Integration with Other Services

The embeddings system integrates seamlessly with the AutoShow pipeline:
1. Generate transcripts and show notes using various LLM services
2. Create embeddings from the generated markdown files
3. Query across all your processed content
4. Build knowledge bases from your media consumption

This creates a powerful workflow for content analysis, research, and knowledge management.