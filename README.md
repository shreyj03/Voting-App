# Real-Time Voting System

A production-grade, horizontally scalable real-time voting application built with Node.js, Redis, MongoDB, and React. Features atomic vote counting, WebSocket-powered live updates, and comprehensive rate limiting.

[![Live Demo](https://img.shields.io/badge/demo-live-success)](https://voting-app-xi-gray.vercel.app)
[![Backend](https://img.shields.io/badge/backend-render-blue)](https://voting-app-i3ap.onrender.com)

## Key Features

- **Real-time Updates**: Instant vote result synchronization across all connected clients using Socket.IO
- **Race-Condition Free**: Redis atomic operations (INCR, SADD) ensure data consistency under concurrent load
- **Scalable Architecture**: Tested with 200 concurrent users, 99.99% success rate
- **Rate Limiting**: Sliding-window algorithm prevents abuse (10 votes/minute per IP)
- **Data Durability**: Background sync job (Redis → MongoDB) every 30 seconds
- **Production Ready**: Deployed on Vercel (frontend) and Render (backend) with zero downtime

## 📊 Performance Metrics

| Metric | Value |
|--------|-------|
| **p95 Latency** | 1.89s |
| **Throughput** | 86 req/s |
| **Concurrent Users** | 200 |
| **Success Rate** | 99.99% |
| **Total Requests** | 28,563 |
| **Uptime** | 100% |

[Full Performance Report](PERFORMANCE.md)

## 🎓 Learning Highlights

This project demonstrates:
- **Distributed Systems**: Redis for caching, MongoDB for persistence
- **Real-time Communication**: WebSocket rooms for targeted broadcasts
- **Concurrency Control**: Atomic operations preventing race conditions
- **System Design**: Eventual consistency, horizontal scalability
- **Production DevOps**: CI/CD, monitoring, load testing

## Tech Stack

**Frontend:**
- React 18
- React Router
- Socket.IO Client
- Axios
- Vite

**Backend:**
- Node.js 18+
- Express
- Socket.IO
- Redis (ioredis)
- MongoDB (Mongoose)
- node-cron

**Infrastructure:**
- Vercel (Frontend CDN)
- Render (Backend)
- MongoDB Atlas (Database)
- Redis Cloud (Cache)

## 🔧 Local Development

### Prerequisites
- Node.js 18+
- MongoDB Atlas account
- Redis Cloud account

### Setup

1. **Clone repository:**
```bash
git clone https://github.com/shreyj03/Voting-App.git
cd Voting-App
```

2. **Backend setup:**
```bash
cd backend
npm install

# Create .env file
cat > .env << 'EOF'
PORT=3000
MONGODB_URI=your_mongodb_uri
REDIS_HOST=your_redis_host
REDIS_PORT=your_redis_port
REDIS_PASSWORD=your_redis_password
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=10
EOF

npm run dev
```

3. **Frontend setup:**
```bash
cd frontend
npm install

# Create .env file
echo "VITE_API_URL=http://localhost:3000/api" > .env
echo "VITE_SOCKET_URL=http://localhost:3000" >> .env

npm run dev
```

4. **Open:** http://localhost:5173

## 📡 API Endpoints

### Polls
- `POST /api/polls` - Create poll
- `GET /api/polls` - List active polls
- `GET /api/polls/:id` - Get poll details
- `GET /api/polls/:id/results` - Get vote results
- `POST /api/polls/:id/vote` - Cast vote

### Health
- `GET /health` - Service health check

## 🧪 Load Testing
```bash
cd load-tests
k6 run vote-load-test.js
```

Tests with 200 concurrent users over 5.5 minutes.

## 🔐 Security Features

- ✅ Rate limiting (10 votes/min per IP)
- ✅ Duplicate vote prevention (IP-based tracking)
- ✅ CORS protection
- ✅ Input validation
- ✅ Error handling with fail-safe defaults

## 👤 Author

**Shrey Jain**
- Boston University CS '26
- [GitHub](https://github.com/shreyj03)

**⭐ Star this repo if you found it helpful!**
EOF
