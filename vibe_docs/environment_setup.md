## Tech Stack
- Language: Node.js 20+
- Framework: Express.js
- Database: PostgreSQL 14+
- Cloud: AWS
- Push: AWS SNS Mobile Push (APNs for iOS, FCM for Android)
- SDKs: @aws-sdk/client-sns, pg, dotenv (optional)
 - Auth: express-session, bcrypt (for simple form login)

## Prerequisites
- Node.js 20+ (recommended via nvm)
- PostgreSQL 14+
- AWS account with IAM permissions for SNS and Secrets/Parameter Store (optional)
- APNs key (iOS) and Firebase project (Android) to configure SNS platform applications

## Setup Instructions
1. Initialize project (if new)
```bash
mkdir server && cd server
npm init -y
npm install express pg @aws-sdk/client-sns dotenv
```

2. Configure PostgreSQL
- Create a database and user; note connection URL (e.g., postgres://user:pass@localhost:5432/app_db)

3. Configure AWS SNS Mobile Push
- Create Platform Applications in AWS SNS:
  - APNs (iOS): upload APNs auth key or certificate
  - FCM (Android): use Firebase server key
- Note each PlatformApplication ARN (APNS, FCM)
 - (Optional) Create SNS Topics for broadcast audiences and record their ARNs

4. Environment variables
Create `.env` (or use AWS SSM/Secrets Manager):
```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgres://USER:PASS@localhost:5432/DB
AWS_REGION=us-east-1
SNS_APNS_PLATFORM_ARN=arn:aws:sns:us-east-1:123456789012:app/APNS/app-name
SNS_FCM_PLATFORM_ARN=arn:aws:sns:us-east-1:123456789012:app/GCM/app-name
SESSION_SECRET=replace-with-strong-secret
```

## How to Run
### Development
```bash
# from project root
node server.js
# or with ts-node if TypeScript
```

### Testing
```bash
# example unit test runner
npm test
```

### Production Build
```bash
# if TypeScript or bundling is used; otherwise run node directly
npm run build
npm run start
```

## Environment Variables
- NODE_ENV: development|production
- PORT: Express port
- DATABASE_URL: PostgreSQL connection string
- AWS_REGION: AWS region for SNS
- SNS_APNS_PLATFORM_ARN: SNS PlatformApplication ARN for iOS
- SNS_FCM_PLATFORM_ARN: SNS PlatformApplication ARN for Android

## Troubleshooting
- InvalidPlatformToken: refresh device token on client, update endpoint in SNS
- EndpointDisabled: re-enable or recreate endpoint; update DB record
- Auth/Credentials: verify APNs key and Firebase server key in SNS configuration
- Permissions: ensure IAM role/user has sns:CreatePlatformEndpoint, sns:Publish
 - Topics: ensure sns:CreateTopic, sns:Subscribe, sns:Unsubscribe permissions when using topics
