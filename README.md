# notify-hub

Enterprise-grade notification service supporting multiple channels, real-time tracking, and analytics.

## Features
- Multi-channel notification dispatch
  - ✅ Email notifications with SendGrid
  - ✅ SMS notifications
  - 🚧 Push notifications
  - 🚧 Webhook notifications
- Real-time delivery tracking
  - ✅ Email tracking (delivery, opens, clicks)
  - ✅ SMS delivery status
  - 🚧 Push notification delivery status
- Template management
  - ✅ Basic HTML email templates with Handlebars
  - ✅ Action button support
  - 🚧 Template versioning
- Analytics dashboard
  - ✅ Basic Prometheus metrics
  - ✅ Grafana dashboard setup
  - 🚧 Advanced analytics
- Queue Processing
  - ✅ Redis-based queue system
  - ✅ Worker implementation
  - ✅ Retry mechanism
- Testing
  - ✅ Unit test framework setup
  - ✅ Test utilities and helpers
  - ✅ SendGrid sandbox testing
  - 🚧 Integration tests
  - 🚧 E2E tests
- Infrastructure
  - ✅ Docker containerization
  - ✅ MongoDB for persistence
  - ✅ Redis for queues
  - ✅ Prometheus for metrics
  - ✅ Grafana for visualization

## Tech Stack
- Backend: Node.js, Express, TypeScript
- Database: MongoDB, Redis
- Monitoring: Prometheus, Grafana
- Email Provider: SendGrid
- Testing: Jest, Supertest
- DevOps: Docker, Docker Compose
- Frontend: React,TypeScript, Material-UI

## Getting Started

### Prerequisites
- Node.js 16+
- Docker and Docker Compose
- SendGrid API Key

### Environment Setup
Create a `.env` file in the root directory:
```env
# App
NODE_ENV=development
PORT=3000
BASE_URL=http://localhost:3000

# MongoDB
MONGODB_URI=mongodb://mongodb:27017/notify-hub

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# SendGrid
SENDGRID_API_KEY=your_sendgrid_api_key
EMAIL_FROM=notifications@yourdomain.com
EMAIL_FROM_NAME=Notify Hub
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
- Grafana: http://localhost:3001
- Prometheus: http://localhost:9090

### Running Tests

1. Run all tests:
```bash
npm test
```

2. Run with coverage:
```bash
npm run test:coverage
```

3. Run specific test suites:
```bash
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
```

## Documentation

### API Endpoints

#### Notifications
- POST /api/v1/notifications
  - Create a new notification
- GET /api/v1/notifications/:id
  - Get notification status

### Queue Architecture
The service uses Redis-based queues for each notification channel:
- email:queue
- sms:queue
- push:queue
- webhook:queue

Each queue is processed by its respective worker implementation.

### Monitoring
- Basic metrics are exposed at `/api/v1/metrics`
- Grafana dashboards are available for:
  - Queue monitoring
  - Notification delivery rates
  - Error rates

### Testing
Refer to [testing-coverage.md](./testing-coverage.md) for detailed information about:
- Test coverage
- Testing strategies
- Running tests
- CI/CD integration
