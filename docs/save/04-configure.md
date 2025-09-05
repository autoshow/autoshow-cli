# Configuration Management

## Commands

### Check Configuration Status
```bash
npm run as -- config
```

### Interactive Setup
```bash
npm run as -- config configure
```

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

## Required Credentials

### Amazon S3
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY` 
- `AWS_REGION` (optional, defaults to `us-east-1`)

### Cloudflare R2 & Vectorize
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_EMAIL`
- `CLOUDFLARE_GLOBAL_API_KEY`

## Usage After Configuration

### S3 Storage
```bash
npm run as -- text --video "URL" --save s3
npm run as -- text --rss "FEED" --save s3
```

### R2 Storage & Vectorize
```bash
npm run as -- text --video "URL" --save r2
npm run as -- text embed --create
npm run as -- text embed --query "What topics were covered?"
```