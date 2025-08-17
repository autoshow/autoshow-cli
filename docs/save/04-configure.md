# Configuration Management

## Commands

### Check Configuration Status
```bash
npm run as -- config
```

Displays current configuration status for all cloud storage services.

### Interactive Setup
```bash
npm run as -- config configure
```

Launches interactive wizard to configure cloud storage services.

### Configure Specific Service
```bash
npm run as -- config configure --service s3
npm run as -- config configure --service r2
npm run as -- config configure --service all
```

### Test Configuration
```bash
npm run as -- config configure --test
```

Tests existing configuration without making changes.

## Interactive Setup Process

1. Shows current configuration status
2. Select service(s) to configure
3. Enter credentials when prompted
4. Credentials are validated automatically
5. Save to `.env` file

## Example Session

```bash
$ npm run as -- config configure

🔧 AutoShow Cloud Storage Configuration

Current Configuration Status:
S3: ✗ Not configured
R2: ✗ Not configured

Choose services to configure:
1. Amazon S3
2. Cloudflare R2
3. All services
4. Exit

Enter your choice (1-4): 2

=== Cloudflare R2 Configuration ===

Enter your Cloudflare Account ID: c6494d4164a5eb0cd3848193bd552d68
Enter your Cloudflare Email: user@example.com
Enter your Cloudflare Global API Key: ********************************

Testing R2 credentials...
R2 credentials validated successfully!

Save R2 credentials to .env file? (y/n): y
R2 configuration saved successfully!
```

## Required Credentials

### Amazon S3
- AWS Access Key ID (20 characters, starts with `AKIA`)
- AWS Secret Access Key (40 characters)
- AWS Region (optional, defaults to `us-east-1`)

### Cloudflare R2
- Cloudflare Account ID (32-character hex string)
- Cloudflare Email
- Cloudflare Global API Key (37 characters)

## Using After Configuration

Once configured, use the `--save` option with any text command:

```bash
npm run as -- text --video "URL" --save s3
npm run as -- text --rss "FEED" --save r2
```