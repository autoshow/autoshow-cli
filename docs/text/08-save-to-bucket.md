# Save to Cloud Storage - Upload Output Files to S3

## Overview

The `--save` option allows you to automatically upload generated markdown files to cloud storage after processing. Currently, S3 is supported with R2 and B2 compatibility coming soon.

## Prerequisites

Before using the `--save` option, ensure you have:

1. **AWS CLI installed and configured** with appropriate credentials:
   ```bash
   aws configure
   ```

2. **Required AWS permissions** for S3 operations:
   - `s3:CreateBucket`
   - `s3:PutObject`
   - `s3:PutBucketVersioning`
   - `s3:PutBucketLifecycleConfiguration`
   - `s3:PutBucketPublicAccessBlock`
   - `s3:HeadBucket`
   - `sts:GetCallerIdentity`

## Basic Usage

Add the `--save s3` option to any text processing command to automatically upload the output files to S3:

```bash
# Process a video and save to S3
npm run as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" \
  --chatgpt \
  --save s3

# Process an RSS feed and save to S3
npm run as -- text --rss "https://feeds.transistor.fm/fsjam-podcast" \
  --last 3 \
  --save s3

# Process a local file and save to S3
npm run as -- text --file "content/audio.mp3" \
  --claude \
  --save s3
```

## Automatic Bucket Management

The system automatically handles S3 bucket creation and configuration:

### Bucket Naming Convention

Buckets are named using the following pattern:
```
{prefix}-{accountId}-{region}
```

- **Default prefix**: `autoshow`
- **Account ID**: Your AWS account ID (automatically detected)
- **Region**: The AWS region from `AWS_REGION` environment variable (defaults to `us-east-1`)

Example bucket name: `autoshow-123456789012-us-west-2`

### Custom Bucket Prefix

You can customize the bucket prefix using the `--s3-bucket-prefix` option:

```bash
npm run as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" \
  --save s3 \
  --s3-bucket-prefix "my-podcast"
```

This would create a bucket named: `my-podcast-123456789012-us-west-2`

## File Organization

Files are organized in S3 with the following structure:
```
s3://bucket-name/
└── autoshow-output/
    └── YYYY-MM-DD/
        ├── 2025-01-15-video-title-chatgpt-shownotes.md
        ├── 2025-01-15-video-title-claude-shownotes.md
        └── 2025-01-15-video-title-prompt.md
```

Files are automatically organized by:
- **Date folder**: Current date in ISO format (YYYY-MM-DD)
- **Filename**: Original filename from processing

## Bucket Configuration

When a new bucket is created, it's automatically configured with:

1. **Versioning**: Enabled to track file changes
2. **Public Access Block**: All public access blocked for security
3. **Lifecycle Policy**: Files automatically deleted after 90 days to manage costs

## Examples

### Process Multiple Videos from a Playlist

```bash
npm run as -- text --playlist "https://www.youtube.com/playlist?list=PLCVnrVv4KhXPz0SoAVu8Rc1emAdGPbSbr" \
  --whisper large-v3-turbo \
  --chatgpt gpt-4o-mini \
  --save s3
```

### Process RSS Feed with Custom Bucket

```bash
npm run as -- text --rss "https://ajcwebdev.substack.com/feed" \
  --last 5 \
  --deepgram \
  --claude claude-3-5-haiku-latest \
  --save s3 \
  --s3-bucket-prefix "podcast-archives"
```

### Process Channel Videos with Date Filter

```bash
npm run as -- text --channel "https://www.youtube.com/@ajcwebdev" \
  --date 2025-01-01 2025-01-15 \
  --whisper large-v3-turbo \
  --gemini \
  --save s3
```

## Output URLs

After successful upload, the console will display the S3 URLs for each uploaded file:

```
Successfully uploaded to S3: https://autoshow-123456789012-us-west-2.s3.amazonaws.com/autoshow-output/2025-01-15/video-title-chatgpt-shownotes.md
```

These URLs can be used to:
- Share processed content
- Access files from other applications
- Integrate with content management systems

## Cost Considerations

- **Storage costs**: S3 charges for storage used
- **Request costs**: Minimal charges for PUT requests
- **Data transfer**: Egress charges apply when files are downloaded
- **Automatic cleanup**: Files are deleted after 90 days by default to minimize costs

## Troubleshooting

### Permission Errors

If you encounter permission errors, ensure your AWS credentials have the required S3 permissions:

```bash
# Test your credentials
aws sts get-caller-identity

# Test S3 access
aws s3 ls
```

### Region Issues

If bucket creation fails, ensure you have the correct region configured:

```bash
# Set region explicitly
export AWS_REGION=us-west-2

# Or include in command
AWS_REGION=us-west-2 npm run as -- text --video "URL" --save s3
```

### Bucket Already Exists

If you get a "bucket already exists" error with a custom prefix, try a different prefix:

```bash
npm run as -- text --video "URL" --save s3 --s3-bucket-prefix "unique-prefix-2025"
```

## Future Support

Support for additional storage providers is planned:

- **R2 (Cloudflare)**: S3-compatible API support coming soon
- **B2 (Backblaze)**: S3-compatible API support coming soon

To use these services when available:

```bash
# Future R2 support
npm run as -- text --video "URL" --save r2

# Future B2 support  
npm run as -- text --video "URL" --save b2
```

## Best Practices

1. **Use descriptive prefixes**: Choose bucket prefixes that identify your project or organization
2. **Monitor costs**: Regularly check your S3 usage in the AWS Console
3. **Set up alerts**: Configure AWS billing alerts for unexpected charges
4. **Review lifecycle policies**: Adjust the 90-day deletion policy based on your retention needs
5. **Use versioning**: Keep versioning enabled to recover from accidental overwrites

## Security Notes

- All buckets are created with public access blocked by default
- Files are not publicly accessible without explicit credentials
- Use IAM policies to restrict access to specific users or applications
- Consider enabling S3 encryption for sensitive content

## Integration Examples

### Access from AWS CLI

```bash
# List uploaded files
aws s3 ls s3://autoshow-123456789012-us-west-2/autoshow-output/

# Download a specific file
aws s3 cp s3://autoshow-123456789012-us-west-2/autoshow-output/2025-01-15/video.md ./local-file.md

# Sync entire date folder
aws s3 sync s3://autoshow-123456789012-us-west-2/autoshow-output/2025-01-15/ ./local-folder/
```

### Generate Pre-signed URLs

For temporary sharing without credentials:

```bash
# Generate a pre-signed URL valid for 1 hour
aws s3 presign s3://autoshow-123456789012-us-west-2/autoshow-output/2025-01-15/video.md --expires-in 3600
```