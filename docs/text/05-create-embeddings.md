# Create Embeddings

Generate vector embeddings from markdown files and store them in Cloudflare Vectorize for semantic search.

## Setup

Configure R2 & Vectorize:
```bash
npm run as -- config configure --service r2
```

## Creating Embeddings

```bash
# Create embeddings from the default 'content' directory
npm run as -- text embed --create

# Create embeddings from a specific directory
npm run as -- text embed --create "input/embed"

# Create embeddings from a custom path
npm run as -- text embed --create "/path/to/markdown/files"
```

## Querying Embeddings

```bash
# Query with a question
npm run as -- text embed --query "What's the deal with these show notes?"

# Query for specific topics
npm run as -- text embed --query "Tell me about machine learning topics discussed"

# Query for summaries
npm run as -- text embed --query "Summarize the main themes across all documents"
```

## Environment Variables

```bash
CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id
CLOUDFLARE_API_TOKEN=your-unified-api-token
VECTORIZE_INDEX_NAME=autoshow-cli-embeddings  # Optional
```

## Example Workflow

```bash
# 1. Configure credentials
npm run as -- config configure --service r2

# 2. Generate content
npm run as -- text --playlist "URL"

# 3. Create embeddings
npm run as -- text embed --create "content"

# 4. Query the knowledge base
npm run as -- text embed --query "What are the key topics discussed?"
```

## Models Used

- **Embeddings**: `@cf/baai/bge-m3` (1024 dimensions)
- **Text Generation**: `@cf/openai/gpt-oss-120b`
- **Vector Database**: Cloudflare Vectorize