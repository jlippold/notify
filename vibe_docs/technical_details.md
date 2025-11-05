# 🔧 Technical Details

_This document contains all technical decisions and implementation details._

## 💻 Technology Stack

### Frontend

[Framework, libraries, tools]

### Backend

[Language, framework, libraries]
- Node.js 20+, Express.js
- Push: AWS SNS Mobile Push using `@aws-sdk/client-sns`
- Database: PostgreSQL via `pg`

### Database

[Type, specific database, ORM]

### Infrastructure

[Hosting, deployment, CI/CD]
- AWS (SNS for push). Future: ECS/Lambda for hosting; RDS for Postgres

## 🏗️ Architecture

### System Architecture

[High-level architecture diagram/description]

### Design Patterns

[Patterns to be used]

### API Design

[REST, GraphQL, WebSocket, etc.]
- REST endpoints for device registration and notifications
  - POST `/push/register` – register/update device token → stores SNS EndpointArn in DB
  - POST `/push/send` – send to user/device/group/topic; supports badges, sounds, deep links
  - POST `/push/subscribe` – subscribe user/device to topic(s)
  - POST `/push/unsubscribe` – unsubscribe user/device from topic(s)
  - GET `/push/topics` – list available topics
  - POST `/topics/ensure` – ensure topic exists (dynamic create) by slug

Payload fields we support:
- iOS (APNS): `aps.alert`, `aps.badge`, `aps.sound`, `aps.category`, custom `link` field for deep links
- Android (FCM/GCM): `notification.title`, `notification.body`, `notification.sound`, `data.link`

Dynamic topic naming:
- `school:notification`
- `school:role:{guardian|student|staff}`
- `course:{course_id}:notification`
- `course:{course_id}:attendance`
- `course:{course_id}:grade`

Notification scenarios supported:
- Teacher → Guardians of a course (use `course:{course_id}:attendance|grade|notification` as appropriate, subscribe guardians tied to enrolled students)
- Teacher → Students in a course (subscribe enrolled students' devices to `course:{course_id}:notification`)
- School-wide by role (publish to `school:role:{guardian|student|staff}`)

Publishing helpers:
- ensureTopic(slug) → returns `sns_topic_arn` (lazy create + cache in DB)
- subscribeDeviceToTopic(deviceEndpointArn, topicArn) → returns subscription ARN
- publishToTopic(topicArn, payload) → handles APNS/FCM payload mapping (badges/sounds/link)

## 📁 Project Structure

### Directory Structure

```
[Project structure will be documented here]
server/
  app.js|server.js
  routes/push.js
  routes/auth.js
  routes/topics.js
  lib/snsClient.js
  lib/db.js
  models/device_endpoints.sql
  models/topics.sql
```

### Key Modules

[Main modules and their responsibilities]

## 🔒 Security

### Authentication Method

[How users will authenticate]
- App auth (e.g., JWT/OAuth). Registration endpoints require authenticated user to bind device → user
- For simple login: server-rendered form (email/password) with session cookie (Express-Session + bcrypt)

### Authorization Strategy

[How permissions are handled]
- Roles: 'School Admin', 'School Staff', 'Guardian', 'Student' drive default topic subscriptions and access
- Only 'School Admin' can publish to `school:notification` and `school:role:{guardian|student|staff}` topics

### Data Protection

[Encryption, sensitive data handling]
- Store only SNS EndpointArn and platform; avoid raw APNs/FCM secrets in DB
- Use IAM roles/SSM for secrets; do not hardcode credentials

## 🚀 Development Setup

### Prerequisites

[Required software, tools]

### Environment Variables

[Required environment configuration]

### Installation Steps

[Step-by-step setup instructions]

## 📊 Performance Considerations

### Expected Load

[Users, requests, data volume]
- Batch publish when possible; prefer topic-based fanout for broadcast

### Optimization Strategies

[Caching, lazy loading, etc.]

### Monitoring

[How performance will be monitored]
- CloudWatch metrics for SNS publishes, failures, throttling
