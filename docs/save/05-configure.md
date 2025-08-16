# Configuration Management - Check and Setup Cloud Storage Credentials

## Overview

AutoShow provides two commands for managing cloud storage configurations:

- **`npm run as -- config`** - Check current configuration status and test credentials
- **`npm run as -- config configure`** - Interactive setup wizard for configuring services

These commands help you set up and validate credentials for Amazon S3, Cloudflare R2, and Backblaze B2 cloud storage services.

## Commands Overview

### Config Command (Status Check)

The `config` command analyzes your current configuration, tests credentials, and provides detailed status reports:

```bash
# Check all cloud storage configurations
npm run as -- config
```

**What it does:**
- Reads credentials from environment variables and .env file
- Tests each service's credentials by making API calls
- Reports configuration status and any issues
- Provides setup guidance for unconfigured or broken services

### Configure Command (Interactive Setup)

The `configure` command provides an interactive wizard to set up cloud storage services:

```bash
# Interactive setup wizard
npm run as -- config configure

# Configure specific service
npm run as -- config configure --service s3
npm run as -- config configure --service r2
npm run as -- config configure --service b2
npm run as -- config configure --service all

# Test current configuration without changes
npm run as -- config configure --test
```

## Interactive Configuration Process

### Step-by-Step Setup

When you run `npm run as -- config configure`, you'll see:

1. **Current Status Check** - Shows which services are already configured
2. **Service Selection Menu** - Choose which service(s) to configure
3. **Interactive Prompts** - Guided setup for each service
4. **Real-time Validation** - Credentials are tested as you enter them
5. **Automatic .env Updates** - Valid credentials are saved automatically

### Example Session

```bash
$ npm run as -- config configure

🔧 AutoShow Cloud Storage Configuration

Current Configuration Status:
S3: ✗ Not configured
R2: ✓ Configured
B2: ✗ Not configured

Choose services to configure:
1. Amazon S3
2. Cloudflare R2
3. Backblaze B2
4. All services
5. Exit

Enter your choice (1-5): 1

=== Amazon S3 Configuration ===

S3 Setup Requirements:
• AWS Access Key ID (starts with AKIA)
• AWS Secret Access Key (40 characters)
• AWS Region (optional, defaults to us-east-1)
• AWS CLI must be installed

Enter your AWS Access Key ID: AKIA2K7L4QXEXAMPLE
Enter your AWS Secret Access Key: lk0X8bQ9example...
Enter your AWS Region (default: us-east-1): us-west-2

Testing S3 credentials...
S3 credentials validated successfully!
Account ID: 123456789012

Save S3 credentials to .env file? (y/n): y
S3 configuration saved successfully!

Next steps:
• Use --save s3 in text commands to upload to S3
• Customize bucket names with --s3-bucket-prefix
• See docs/save/02-s3.md for more details
```

## Service-Specific Configuration

### Amazon S3 Configuration

**Required Information:**
- AWS Access Key ID (20 characters, starts with `AKIA`)
- AWS Secret Access Key (40 characters)
- AWS Region (optional, defaults to `us-east-1`)

**Validation Process:**
- Checks Access Key ID format
- Validates Secret Access Key length
- Tests credentials with `aws sts get-caller-identity`
- Verifies account access and permissions

**Environment Variables Set:**
```bash
AWS_ACCESS_KEY_ID=AKIA2K7L4QXEXAMPLE
AWS_SECRET_ACCESS_KEY=lk0X8bQ9...
AWS_REGION=us-west-2
```

### Cloudflare R2 Configuration

**Required Information:**
- Cloudflare Account ID (32-character hex string)
- R2 Access Key ID (32 characters)
- R2 Secret Access Key

**Validation Process:**
- Validates Account ID format (32-character hex)
- Checks Access Key ID length (must be 32 characters)
- Tests credentials with R2 API endpoint
- Verifies bucket listing permissions

**Environment Variables Set:**
```bash
CLOUDFLARE_ACCOUNT_ID=c6494d4164a5eb0cd3848193bd552d68
AWS_PROFILE=r2
```

**Additional Setup Required:**
The configure command will prompt you to also run:
```bash
aws configure --profile r2
```

### Backblaze B2 Configuration

**Required Information:**
- B2 Application Key ID (NOT Master Application Key)
- B2 Application Key
- B2 Region (optional, defaults to `us-west-004`)

**Validation Process:**
- Checks Key ID format and length
- Validates region against known B2 regions
- Tests credentials with B2 S3-compatible API
- Verifies required capabilities (listBuckets, writeFiles, readFiles)

**Environment Variables Set:**
```bash
B2_APPLICATION_KEY_ID=005d2f4eee1e3540000000002
B2_APPLICATION_KEY=K005fXQ6ym9...
B2_REGION=us-west-004
```

## Command Options

### Configure Command Options

```bash
# Configure specific service
npm run as -- config configure --service s3     # Amazon S3 only
npm run as -- config configure --service r2     # Cloudflare R2 only
npm run as -- config configure --service b2     # Backblaze B2 only
npm run as -- config configure --service all    # All services

# Test existing configuration
npm run as -- config configure --test           # Same as 'config' command

# Reset configuration (planned feature)
npm run as -- config configure --reset          # Remove all credentials
```

### Config Command (No Options)

The config command has no options and always checks all services:

```bash
npm run as -- config
```

## Configuration Status Output

### Example Status Report

```bash
Configuration Summary:
════════════════════════════════════════════════════════════════════════════════
✓ Amazon S3
  Configured: Yes
  Tested: Yes ✓
  Settings:
    Access Key ID: AKIA2K**************
    Secret Access Key: lk0X************************************
    Region: us-west-2
    Profile: Default

✓ Cloudflare R2
  Configured: Yes
  Tested: Yes ✓
  Settings:
    Account ID: c6494d41************************
    AWS Profile: r2

✗ Backblaze B2
  Configured: No
  Tested: No ✗
  Settings:
    Key ID: Not set
    Application Key: Not set
    Region: us-west-004 (default)
  Issues:
    • B2_APPLICATION_KEY_ID environment variable is not set
    • B2_APPLICATION_KEY environment variable is not set
```

## Troubleshooting

### Common Issues and Solutions

#### AWS S3 Issues

**"The config profile () could not be found"**
- Install AWS CLI: `brew install awscli` (macOS) or equivalent
- Run `aws configure` to set up default profile

**"Access key ID not found or invalid"**
- Verify the Access Key ID is correct (20 chars, starts with AKIA)
- Check if the key was deleted or rotated in AWS Console

**"Secret access key is incorrect"**
- Verify the Secret Access Key (40 characters)
- Generate a new access key pair if needed

#### Cloudflare R2 Issues

**"Credential access key has length 20, should be 32"**
- You're using AWS credentials instead of R2 credentials
- Create R2-specific API tokens at the Cloudflare dashboard

**"Invalid CLOUDFLARE_ACCOUNT_ID format"**
- Account ID must be exactly 32 hexadecimal characters
- Find it in your Cloudflare dashboard URL

**"R2 access key ID is invalid or not found"**
- Create new R2 API tokens with proper permissions
- Ensure tokens have Admin Read & Write permissions

#### Backblaze B2 Issues

**"B2 application key ID is invalid, expired, or revoked"**
- Don't use the Master Application Key
- Create a new Application Key with specific capabilities
- Check if the key was revoked in B2 console

**"B2 application key lacks required permissions"**
- Ensure key has: listBuckets, writeFiles, readFiles capabilities
- Create a new key with proper permissions

**"Invalid B2 region"**
- Valid regions: `us-west-004`, `us-east-005`, `eu-central-003`
- Check Backblaze B2 documentation for current regions

### Getting Help

If configuration issues persist:

1. **Check Documentation:**
   - [S3 Setup Guide](./02-s3.md)
   - [R2 Setup Guide](./03-r2.md)
   - [B2 Setup Guide](./04-b2.md)

2. **Verify Prerequisites:**
   - AWS CLI installed and working
   - Valid credentials from each service provider
   - Network connectivity to service endpoints

3. **Manual Verification:**
   ```bash
   # Test AWS CLI
   aws sts get-caller-identity
   
   # Test R2 with specific profile
   aws s3 ls --profile r2 --endpoint-url https://ACCOUNT.r2.cloudflarestorage.com
   
   # Test B2 with custom endpoint
   aws s3 ls --endpoint-url https://s3.us-west-004.backblazeb2.com
   ```

## Security Best Practices

### Credential Management

1. **Use Restricted Keys:**
   - S3: Create IAM users with minimal S3 permissions
   - R2: Use R2-specific API tokens (not Cloudflare Global API Key)
   - B2: Use Application Keys (not Master Application Key)

2. **Environment Variables:**
   - Never commit `.env` files to version control
   - Use separate credentials for different environments
   - Rotate credentials regularly

3. **Permissions:**
   - Grant only necessary permissions for bucket operations
   - Use bucket-specific restrictions when possible
   - Monitor usage through service dashboards

### Automated Setup

For CI/CD or automated deployments, you can configure services programmatically:

```bash
# Set environment variables
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
export B2_APPLICATION_KEY_ID="your-key-id"
export B2_APPLICATION_KEY="your-app-key"

# Test configuration
npm run as -- config configure --test
```

## Integration with AutoShow Commands

Once configured, use the `--save` option with any text processing command:

```bash
# Save to S3
npm run as -- text --video "URL" --save s3

# Save to R2
npm run as -- text --rss "FEED" --save r2

# Save to B2
npm run as -- text --file "PATH" --save b2

# Custom bucket prefix
npm run as -- text --video "URL" --save s3 --s3-bucket-prefix "my-content"
```

## Configuration File Location

All credentials are stored in the `.env` file in your project root:

```bash
# View current configuration
cat .env

# Edit manually if needed
nano .env
```

The configure command automatically updates this file when you save credentials through the interactive setup process.