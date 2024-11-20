# NotifyHub 🚀

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)
![Express](https://img.shields.io/badge/Express-4.x-000000)
![Next.js](https://img.shields.io/badge/Next.js-14.0-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![MongoDB](https://img.shields.io/badge/MongoDB-6.0-green)
![Redis](https://img.shields.io/badge/Redis-7.0-red)


Enterprise-grade notification service powering multi-channel communications with advanced tracking, analytics, and scalability features.

## ✨ Core Features

### 📬 Multi-channel Notification System
- **Email Service**
  - ✅ SendGrid integration with fallback providers
  - ✅ HTML & Plain text support
  - ✅ Attachment handling up to 10MB
  - ✅ Dynamic templating with Handlebars
  - ✅ Email authentication (SPF, DKIM, DMARC)

- **SMS Capabilities**
  - ✅ Multiple provider support (Twilio, MessageBird)
  - ✅ Automatic failover between providers
  - ✅ International number formatting
  - ✅ Character counting & message splitting
  - 🚧 MMS support

- **Push Notifications**
  - ✅ Firebase Cloud Messaging (FCM)
  - ✅ Apple Push Notification Service (APNS)
  - ✅ Rich push notifications
  - 🚧 Web push notifications

- **Webhook System**
  - ✅ Configurable retry policies
  - ✅ Signature verification
  - ✅ Rate limiting
  - 🚧 Batch webhooks

### 📊 Advanced Analytics & Tracking
- **Delivery Insights**
  - ✅ Real-time delivery status
  - ✅ Bounce tracking & management
  - ✅ Click & open tracking
  - ✅ Engagement metrics

- **Performance Monitoring**
  - ✅ Custom Prometheus metrics
  - ✅ Grafana dashboards
  - ✅ Latency tracking
  - ✅ Error rate monitoring
  - ✅ Queue health metrics

### 🎨 Template Management
- ✅ Version control for templates
- ✅ A/B testing capabilities
- ✅ Dynamic content blocks
- ✅ Template categories & tagging
- ✅ Preview functionality
- 🚧 Template migration tools

### 🔄 Queue Processing
- ✅ Distributed Redis-based queue
- ✅ Priority queuing
- ✅ Dead letter queues
- ✅ Rate limiting per channel
- ✅ Automatic retry with backoff
- ✅ Queue monitoring & alerts

## 🛠 Tech Stack

### Backend
![Node.js](https://img.shields.io/badge/Node.js-18.x-43853d)
![Express](https://img.shields.io/badge/Express-4.x-000000)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-007acc)

### Frontend
![Next.js](https://img.shields.io/badge/Next.js-14.x-000000)
![React](https://img.shields.io/badge/React-18.x-61dafb)
![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-Latest-000000)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-38bdf8)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-007acc)

### Database & Caching
![MongoDB](https://img.shields.io/badge/MongoDB-6.x-47a248)
![Redis](https://img.shields.io/badge/Redis-7.x-dc382d)

### Monitoring & Logging
![Prometheus](https://img.shields.io/badge/Prometheus-Latest-e6522c)
![Grafana](https://img.shields.io/badge/Grafana-Latest-f46800)
![Winston](https://img.shields.io/badge/Winston-Latest-5a9d00)

### Testing
![Jest](https://img.shields.io/badge/Jest-29.x-c21325)
![Supertest](https://img.shields.io/badge/Supertest-Latest-000000)

### DevOps
![Docker](https://img.shields.io/badge/Docker-Latest-2496ed)
![Docker Compose](https://img.shields.io/badge/Docker%20Compose-Latest-2496ed)

## 🚀 Getting Started

### Prerequisites
- Node.js 16+
- Docker and Docker Compose
- SendGrid API Key
- MongoDB 6.0+
- Redis 7.0+

### Environment Configuration
Create a `.env` file in the root directory:

```env
# Application
NODE_ENV=development
PORT=3000
BASE_URL=http://localhost:3000
LOG_LEVEL=debug

# Database
MONGODB_URI=mongodb://mongodb:27017/notify-hub
MONGODB_POOL_SIZE=10

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_TLS=false

# Email Configuration
SENDGRID_API_KEY=your_sendgrid_api_key
EMAIL_FROM=notifications@yourdomain.com
EMAIL_FROM_NAME=Notify Hub
SMTP_FALLBACK_HOST=smtp.mailtrap.io
SMTP_FALLBACK_PORT=2525
SMTP_FALLBACK_USER=
SMTP_FALLBACK_PASS=

# SMS Configuration
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
MESSAGEBIRD_API_KEY=

# Push Notifications
FCM_SERVER_KEY=
APNS_KEY_ID=
APNS_TEAM_ID=
APNS_KEY_FILE=

# Security
JWT_SECRET=your-secret-key
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100

# Monitoring
PROMETHEUS_METRICS_PATH=/metrics
GRAFANA_ADMIN_PASSWORD=admin
```

### Installation & Running

1. Clone the repository:
```bash
git clone https://github.com/yourusername/notify-hub.git
cd notify-hub
```

2. Install dependencies:
```bash
npm install
```

3. Start the services:
```bash
docker-compose up -d
```

4. Access the services:
- API: http://localhost:3000
- Admin Dashboard: http://localhost:3000/admin
- Grafana: http://localhost:3001
- Prometheus: http://localhost:9090

### Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suites
npm run test:unit         # Unit tests
npm run test:integration  # Integration tests
npm run test:e2e         # End-to-end tests

# Run tests in watch mode
npm run test:watch
```

## 📚 API Documentation

### Notification Endpoints

#### Create Notification
```http
POST /api/v1/notifications
```
```json
{
  "channel": "email",
  "template": "welcome-email",
  "recipient": "user@example.com",
  "data": {
    "name": "John Doe",
    "verificationLink": "https://..."
  },
  "options": {
    "priority": "high",
    "scheduledFor": "2024-03-21T15:00:00Z"
  }
}
```

#### Get Notification Status
```http
GET /api/v1/notifications/:id
```

#### Batch Notifications
```http
POST /api/v1/notifications/batch
```

### Template Endpoints

#### Create Template
```http
POST /api/v1/templates
```

#### Update Template
```http
PUT /api/v1/templates/:id
```

### Analytics Endpoints

#### Get Delivery Stats
```http
GET /api/v1/analytics/delivery
```

#### Get Engagement Metrics
```http
GET /api/v1/analytics/engagement
```

## 🏗 Architecture

### Queue System
- Dedicated queues for each channel
- Priority-based processing
- Dead letter queue handling
- Retry mechanisms with exponential backoff
- Rate limiting per channel and recipient

### Monitoring Stack
- Custom Prometheus metrics
- Grafana dashboards for:
  - Queue health
  - Delivery rates
  - Error rates
  - System resources
  - Channel performance

### High Availability
- Horizontal scaling support
- Redis Sentinel for queue HA
- MongoDB replica sets
- Load balancing ready

## 📈 Performance

- Handles 1000+ notifications/second
- 99.9% uptime SLA
- Average delivery time < 5 seconds
- Automatic scaling based on queue size

## 🔒 Security

- JWT authentication
- Rate limiting
- Input validation
- CORS configuration
- Security headers
- Audit logging
- Data encryption at rest

## License & Copyright

![License](https://img.shields.io/badge/License-Proprietary-red.svg)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Dhiyaneshwaran-blue.svg)](https://www.linkedin.com/in/dhiyaneshwaran-radhakrishnan/)
[![GitHub](https://img.shields.io/badge/GitHub-DhiyaneshwaranR-black.svg)](https://github.com/DhiyaneshwaranR)


Copyright © 2024 Dhiyaneshwaran Radhakrishnan. All rights reserved.

This project is proprietary software. No part of this project may be copied, reproduced, or distributed without express written permission from the copyright holder. This includes, but is not limited to:

- Source code
- Documentation
- Design elements
- Architecture
- Configuration files

This software is provided for demonstration and portfolio purposes only. Viewing and assessment of the code is permitted, but reproduction or use of any part of the codebase is prohibited.

### Permissions
✅ View source code for assessment purposes
✅ Fork repository for review purposes
❌ Commercial use
❌ Modification
❌ Distribution
❌ Private use
❌ Patent use

### Additional Terms
- This project may not be used as a template for other projects
- Screenshots and code snippets may be used in portfolios with proper attribution
- Concepts and ideas demonstrated in this project may be independently implemented, but direct code copying is prohibited

### Contact Information
For inquiries regarding this project:
- Email: rdhiyan@zohomail.in
- LinkedIn: [Dhiyaneshwaran Radhakrishnan](https://www.linkedin.com/in/dhiyaneshwaran-radhakrishnan/)
- GitHub: [DhiyaneshwaranR](https://github.com/DhiyaneshwaranR)

**Note:** If you find this project interesting, please consider starring the repository and following me on GitHub, but remember that this code is not for reproduction or reuse.