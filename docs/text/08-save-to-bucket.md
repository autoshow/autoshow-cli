# Save to Cloud Storage - Upload Output Files to S3 or R2

## Overview

The `--save` option allows you to automatically upload generated markdown files to cloud storage after processing. Currently supported services include:
- **S3** - Amazon S3
- **R2** - Cloudflare R2 (S3-compatible)

## Prerequisites

### For S3

Before using the `--save s3` option, ensure you have:

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

### For R2

Before using the `--save r2` option, ensure you have:

1. **AWS CLI installed** (R2 is S3-compatible and uses the AWS CLI)

2. **Create R2 API Token**:
   - Go to [Cloudflare Dashboard > R2 > API Tokens](https://dash.cloudflare.com/?to=/:account/r2/api-tokens)
   - Click "Create API token"
   - Choose permissions (Admin Read & Write recommended)
   - Copy your Access Key ID (32 characters) and Secret Access Key
   - Note: R2 tokens are different from regular AWS credentials

3. **Configure AWS CLI with R2 credentials**:
   ```bash
   # Create a profile specifically for R2
   aws configure --profile r2
   ```
   When prompted, enter:
   - AWS Access Key ID: Your R2 Access Key ID (32 characters)
   - AWS Secret Access Key: Your R2 Secret Access Key
   - Default region name: auto
   - Default output format: json

4. **Set environment variables**:
   ```bash
   export AWS_PROFILE=r2
   export CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id
   ```
   
   You can find your Cloudflare Account ID in the Cloudflare dashboard URL or on the R2 overview page.

## Basic Usage

Add the `--save` option to any text processing command to automatically upload the output files:

```bash
# Process a video and save to S3
npm run as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" --save s3

# Process a video and save to R2
npm run as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" --save r2

# Process an RSS feed and save to R2
npm run as -- text --rss "https://feeds.transistor.fm/fsjam-podcast" \
  --last 3 \
  --save r2

# Process a local file and save to S3
npm run as -- text --file "content/examples/audio.mp3" --claude --save s3
```

## Automatic Bucket Management

The system automatically handles bucket creation and configuration for both S3 and R2:

### Bucket Naming Convention

Buckets are named using the following pattern:
```
{prefix}-{accountId}-{region}
```

- **Default prefix**: `autoshow`
- **Account ID**: 
  - For S3: Your AWS account ID (automatically detected)
  - For R2: Your Cloudflare account ID (from CLOUDFLARE_ACCOUNT_ID env var)
- **Region**: 
  - For S3: From `AWS_REGION` environment variable (defaults to `us-east-1`)
  - For R2: Always `auto`

Example bucket names:
- S3: `autoshow-123456789012-us-west-2`
- R2: `autoshow-c6494d4164a5eb0cd3848193bd552d68-auto`

### Custom Bucket Prefix

You can customize the bucket prefix using the `--s3-bucket-prefix` option (works for both S3 and R2):

```bash
# S3 with custom prefix
npm run as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" \
  --save s3 \
  --s3-bucket-prefix "my-podcast"

# R2 with custom prefix
npm run as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" \
  --save r2 \
  --s3-bucket-prefix "my-content"
```

This would create buckets named:
- S3: `my-podcast-123456789012-us-west-2`
- R2: `my-content-c6494d4164a5eb0cd3848193bd552d68-auto`

## File Organization

Files are organized with the following structure for both S3 and R2:
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

## Troubleshooting

### R2-Specific Issues

#### Invalid Credential Length Error
If you get "Credential access key has length 20, should be 32":
- You're using AWS credentials instead of R2 credentials
- Create R2-specific API tokens at https://dash.cloudflare.com/?to=/:account/r2/api-tokens
- Configure a separate AWS CLI profile for R2 with the correct credentials

#### Missing Account ID
If R2 upload fails with missing account ID:
```bash
# Set your Cloudflare account ID
export CLOUDFLARE_ACCOUNT_ID=c6494d4164a5eb0cd3848193bd552d68
```

#### Testing R2 Access
```bash
# Test R2 access with your configured profile
aws s3 ls --profile r2 --endpoint-url https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com

# List buckets
aws s3api list-buckets --profile r2 --endpoint-url https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
```

### Permission Errors

If you encounter permission errors, ensure your credentials have the required permissions:

```bash
# Test your credentials
aws sts get-caller-identity

# Test S3 access
aws s3 ls

# Test R2 access (with profile)
aws s3 ls --profile r2 --endpoint-url https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
```

### Region Issues

For S3, if bucket creation fails, ensure you have the correct region configured:

```bash
# Set region explicitly for S3
export AWS_REGION=us-west-2

# Or include in command
AWS_REGION=us-west-2 npm run as -- text --video "URL" --save s3
```

For R2, the region is always 'auto' and is handled automatically.

### Bucket Already Exists

If you get a "bucket already exists" error with a custom prefix, try a different prefix:

```bash
# S3
npm run as -- text --video "URL" --save s3 --s3-bucket-prefix "unique-prefix-2025"

# R2
npm run as -- text --video "URL" --save r2 --s3-bucket-prefix "unique-r2-prefix-2025"
```

## Best Practices

1. **Use descriptive prefixes**: Choose bucket prefixes that identify your project or organization
2. **Monitor costs**: Regularly check your storage usage in the AWS Console or Cloudflare Dashboard
3. **Set up alerts**: Configure billing alerts for unexpected charges
4. **Review lifecycle policies**: Adjust the 90-day deletion policy based on your retention needs
5. **Use versioning**: Keep versioning enabled to recover from accidental overwrites
6. **Choose the right service**: Use R2 when you need to minimize egress costs, use S3 when you need broader AWS ecosystem integration
7. **Separate profiles**: Use separate AWS CLI profiles for S3 and R2 to avoid credential conflicts

## Security Notes

- All buckets are created with appropriate security defaults
- S3 buckets have public access blocked by default
- R2 buckets are private by default
- Files are not publicly accessible without explicit credentials
- Use IAM policies (S3) or API tokens (R2) to restrict access to specific users or applications
- Consider enabling encryption for sensitive content
- Keep your R2 API tokens secure and never commit them to version control

## Integration Examples

### Access from AWS CLI

#### S3
```bash
# List uploaded files
aws s3 ls s3://autoshow-123456789012-us-west-2/

# Download a specific file
aws s3 cp s3://autoshow-123456789012-us-west-2/1755334409936/video.md ./local-file.md

# Sync entire session folder
aws s3 sync s3://autoshow-123456789012-us-west-2/1755334409936/ ./local-folder/
```

#### R2
```bash
# List uploaded files
aws s3 ls s3://autoshow-c6494d4164a5eb0cd3848193bd552d68-auto/ \
  --profile r2 \
  --endpoint-url https://c6494d4164a5eb0cd3848193bd552d68.r2.cloudflarestorage.com

# Download a specific file
aws s3 cp s3://autoshow-c6494d4164a5eb0cd3848193bd552d68-auto/1755334409936/video.md ./local-file.md \
  --profile r2 \
  --endpoint-url https://c6494d4164a5eb0cd3848193bd552d68.r2.cloudflarestorage.com

# Sync entire session folder
aws s3 sync s3://autoshow-c6494d4164a5eb0cd3848193bd552d68-auto/1755334409936/ ./local-folder/ \
  --profile r2 \
  --endpoint-url https://c6494d4164a5eb0cd3848193bd552d68.r2.cloudflarestorage.com
```

### Generate Pre-signed URLs

For temporary sharing without credentials:

#### S3
```bash
# Generate a pre-signed URL valid for 1 hour
aws s3 presign s3://autoshow-123456789012-us-west-2/1755334409936/video.md --expires-in 3600
```

#### R2
```bash
# Generate a pre-signed URL valid for 1 hour
aws s3 presign s3://autoshow-c6494d4164a5eb0cd3848193bd552d68-auto/1755334409936/video.md \
  --profile r2 \
  --endpoint-url https://c6494d4164a5eb0cd3848193bd552d68.r2.cloudflarestorage.com \
  --expires-in 3600
```