# Save to Cloud Storage - Upload Output Files to S3, R2, or B2

## Overview

The `--save` option allows you to automatically upload generated markdown files to cloud storage after processing. Currently supported services include:
- **S3** - Amazon S3
- **R2** - Cloudflare R2 (S3-compatible)
- **B2** - Backblaze B2 (S3-compatible)

For detailed setup and configuration instructions for each service, see:
- [Amazon S3 Setup](./02-s3.md)
- [Cloudflare R2 Setup](./03-r2.md)
- [Backblaze B2 Setup](./04-b2.md)

## Basic Usage

Add the `--save` option to any text processing command to automatically upload the output files:

```bash
# Process a video and save to S3
npm run as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" --save s3

# Process a video and save to R2
npm run as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" --save r2

# Process a video and save to B2
npm run as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" --save b2

# Process an RSS feed and save to B2
npm run as -- text --rss "https://feeds.transistor.fm/fsjam-podcast" \
  --last 3 \
  --save b2

# Process a local file and save to S3
npm run as -- text --file "content/examples/audio.mp3" --claude --save s3
```

## Automatic Bucket Management

The system automatically handles bucket creation and configuration for S3, R2, and B2:

### Bucket Naming Convention

Buckets are named using the following pattern:
```
{prefix}-{accountId}-{region}
```

- **Default prefix**: `autoshow`
- **Account ID**: 
  - For S3: Your AWS account ID (automatically detected)
  - For R2: Your Cloudflare account ID (from CLOUDFLARE_ACCOUNT_ID env var)
  - For B2: First 12 characters of your B2 Application Key ID
- **Region**: 
  - For S3: From `AWS_REGION` environment variable (defaults to `us-east-1`)
  - For R2: Always `auto`
  - For B2: From `B2_REGION` environment variable (defaults to `us-west-004`)

Example bucket names:
- S3: `autoshow-123456789012-us-west-2`
- R2: `autoshow-c6494d4164a5eb0cd3848193bd552d68-auto`
- B2: `autoshow-004b49da91f6-us-west-004`

### Custom Bucket Prefix

You can customize the bucket prefix using the `--s3-bucket-prefix` option (works for S3, R2, and B2):

```bash
# S3 with custom prefix
npm run as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" \
  --save s3 \
  --s3-bucket-prefix "my-podcast"

# R2 with custom prefix
npm run as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" \
  --save r2 \
  --s3-bucket-prefix "my-content"

# B2 with custom prefix
npm run as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" \
  --save b2 \
  --s3-bucket-prefix "my-archive"
```

This would create buckets named:
- S3: `my-podcast-123456789012-us-west-2`
- R2: `my-content-c6494d4164a5eb0cd3848193bd552d68-auto`
- B2: `my-archive-004b49da91f6-us-west-004`

## File Organization

Files are organized with the following structure for S3, R2, and B2:
```
bucket-name/
└── {sessionId}/
    ├── 2025-01-15-video-title-chatgpt-shownotes.md
    ├── 2025-01-15-video-title-claude-shownotes.md
    ├── 2025-01-15-video-title-prompt.md
    └── 2025-01-15-video-title-metadata.json
```

Files are automatically organized by:
- **Session ID**: Unique timestamp for each processing session
- **Filename**: Original filename from processing

## Bucket Configuration

When a new bucket is created, it's automatically configured with:

1. **Versioning**: Enabled to track file changes
2. **Public Access Block**: All public access blocked for security (S3 only)
3. **Lifecycle Policy**: Files automatically deleted after 90 days to manage costs

## Examples

### Process Multiple Videos from a Playlist

```bash
# Save to S3
npm run as -- text --playlist "https://www.youtube.com/playlist?list=PLCVnrVv4KhXPz0SoAVu8Rc1emAdGPbSbr" \
  --whisper large-v3-turbo \
  --chatgpt gpt-4o-mini \
  --save s3

# Save to R2 (ensure R2 profile and account ID are set)
export AWS_PROFILE=r2
export CLOUDFLARE_ACCOUNT_ID=c6494d4164a5eb0cd3848193bd552d68
npm run as -- text --playlist "https://www.youtube.com/playlist?list=PLCVnrVv4KhXPz0SoAVu8Rc1emAdGPbSbr" \
  --whisper large-v3-turbo \
  --chatgpt gpt-4o-mini \
  --save r2

# Save to B2
npm run as -- text --playlist "https://www.youtube.com/playlist?list=PLCVnrVv4KhXPz0SoAVu8Rc1emAdGPbSbr" \
  --whisper large-v3-turbo \
  --chatgpt gpt-4o-mini \
  --save b2
```

### Process RSS Feed with Custom Bucket

```bash
# S3 with custom bucket prefix
npm run as -- text --rss "https://ajcwebdev.substack.com/feed" \
  --last 5 \
  --deepgram \
  --claude claude-3-5-haiku-latest \
  --save s3 \
  --s3-bucket-prefix "podcast-archives"

# R2 with custom bucket prefix
export AWS_PROFILE=r2
export CLOUDFLARE_ACCOUNT_ID=c6494d4164a5eb0cd3848193bd552d68
npm run as -- text --rss "https://ajcwebdev.substack.com/feed" \
  --last 5 \
  --deepgram \
  --claude claude-3-5-haiku-latest \
  --save r2 \
  --s3-bucket-prefix "cloudflare-archives"

# B2 with custom bucket prefix
npm run as -- text --rss "https://ajcwebdev.substack.com/feed" \
  --last 5 \
  --deepgram \
  --claude claude-3-5-haiku-latest \
  --save b2 \
  --s3-bucket-prefix "backblaze-archives"
```

### Process Channel Videos with Date Filter

```bash
# Save to S3
npm run as -- text --channel "https://www.youtube.com/@ajcwebdev" \
  --date 2025-01-01 2025-01-15 \
  --whisper large-v3-turbo \
  --gemini \
  --save s3

# Save to R2
export AWS_PROFILE=r2
export CLOUDFLARE_ACCOUNT_ID=c6494d4164a5eb0cd3848193bd552d68
npm run as -- text --channel "https://www.youtube.com/@ajcwebdev" \
  --date 2025-01-01 2025-01-15 \
  --whisper large-v3-turbo \
  --gemini \
  --save r2

# Save to B2
npm run as -- text --channel "https://www.youtube.com/@ajcwebdev" \
  --date 2025-01-01 2025-01-15 \
  --whisper large-v3-turbo \
  --gemini \
  --save b2
```

## Output URLs

After successful upload, the console will display the appropriate URLs for each uploaded file:

### S3 URLs
```
Successfully uploaded to S3: https://autoshow-123456789012-us-west-2.s3.amazonaws.com/1755334409936/video-title-chatgpt-shownotes.md
```

### R2 URLs
```
Successfully uploaded to R2: https://c6494d4164a5eb0cd3848193bd552d68.r2.cloudflarestorage.com/autoshow-c6494d4164a5eb0cd3848193bd552d68-auto/1755334409936/video-title-chatgpt-shownotes.md
```

### B2 URLs
```
Successfully uploaded to B2: https://s3.us-west-004.backblazeb2.com/autoshow-004b49da91f6-us-west-004/1755334409936/video-title-chatgpt-shownotes.md
```

These URLs can be used to:
- Share processed content
- Access files from other applications
- Integrate with content management systems

## Cost Considerations

### S3 Costs
- **Storage costs**: S3 charges for storage used
- **Request costs**: Minimal charges for PUT requests
- **Data transfer**: Egress charges apply when files are downloaded
- **Automatic cleanup**: Files are deleted after 90 days by default to minimize costs

### R2 Costs
- **Storage costs**: R2 charges for storage used
- **Request costs**: Minimal charges for operations
- **Data transfer**: No egress fees (major advantage over S3)
- **Automatic cleanup**: Files are deleted after 90 days by default to minimize costs

### B2 Costs
- **Storage costs**: B2 charges for storage used (competitive pricing)
- **Request costs**: Class B transactions for uploads (very low cost)
- **Data transfer**: First 1GB per day is free, then usage-based pricing
- **Automatic cleanup**: Files are deleted after 90 days by default to minimize costs

## Best Practices

1. **Use descriptive prefixes**: Choose bucket prefixes that identify your project or organization
2. **Monitor costs**: Regularly check your storage usage in the AWS Console, Cloudflare Dashboard, or Backblaze B2 Console
3. **Set up alerts**: Configure billing alerts for unexpected charges
4. **Review lifecycle policies**: Adjust the 90-day deletion policy based on your retention needs
5. **Use versioning**: Keep versioning enabled to recover from accidental overwrites
6. **Choose the right service**: 
   - Use **S3** when you need deep AWS ecosystem integration
   - Use **R2** when you want to minimize egress costs
   - Use **B2** when you want competitive storage pricing and good performance
7. **Separate credentials**: Use separate credentials/profiles for each service to avoid conflicts
8. **Test access**: Verify your credentials work before processing large batches

## Security Notes

- All buckets are created with appropriate security defaults
- S3 buckets have public access blocked by default
- R2 buckets are private by default
- B2 buckets are private by default and support S3-compatible ACLs
- Files are not publicly accessible without explicit credentials
- Use IAM policies (S3), API tokens (R2), or Application Keys (B2) to restrict access to specific users or applications
- Consider enabling encryption for sensitive content
- Keep your credentials secure and never commit them to version control
- B2 Application Keys can be restricted to specific buckets for additional security

## Service Comparison

| Feature | S3 | R2 | B2 |
|---------|----|----|----| 
| **Storage Cost** | $$$ | $$ | $ |
| **Egress Cost** | High | Free | 1GB/day free |
| **Request Cost** | $$ | $ | $ |
| **Global Presence** | Excellent | Good | Good |
| **Ecosystem Integration** | Excellent | Good | Good |
| **Setup Complexity** | Low | Medium | Medium |
| **Best For** | AWS-heavy workflows | High-traffic apps | Cost-conscious users |