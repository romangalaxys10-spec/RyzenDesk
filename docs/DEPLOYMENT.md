# 🚀 Production Deployment Guide

This guide covers production deployment strategies for RyzenDesk across Docker, Cloud Run, and traditional VPS environments.

---

## 🐳 Option 1: Docker Deployment (Recommended)

### 1. Build and Run Container
```bash
# Build the production image
docker build -t ryzendesk:latest .

# Run container mounting a data volume for local resilience
docker run -d \
  --name ryzendesk-app \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  --env-file .env \
  --restart unless-stopped \
  ryzendesk:latest
```

### 2. Docker Compose
Use the included `docker-compose.yml`:
```yaml
version: '3.8'

services:
  ryzendesk:
    build: .
    container_name: ryzendesk
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - SESSION_SECRET=${SESSION_SECRET}
      - GITHUB_TOKEN=${GITHUB_TOKEN}
      - GITHUB_REPO=${GITHUB_REPO}
      - GITHUB_BRANCH=main
      - GITHUB_DB_PATH=data/helpdesk-db.json
    volumes:
      - ./data:/app/data
```
Run with:
```bash
docker compose up -d
```

---

## ☁️ Option 2: Cloud Run / Container Platforms

RyzenDesk runs cleanly on serverless container platforms such as **Google Cloud Run**:

```bash
# Deploy with gcloud
gcloud run deploy ryzendesk \
  --source . \
  --platform managed \
  --region europe-west3 \
  --allow-unauthenticated \
  --set-env-vars="SESSION_SECRET=your-secret,GITHUB_TOKEN=ghp_...,GITHUB_REPO=romangalaxys10-spec/RyzenDesk"
```

Because Cloud Run instances are ephemeral, configuring `GITHUB_TOKEN` and `GITHUB_REPO` ensures that your tickets and database persist reliably across container cold-starts and redeployments.

---

## 🔄 Automated Codebase Deployment

To push all updates made to your codebase back to your GitHub repository:
```bash
npm run deploy
```
Or execute the automated shell script:
```bash
./scripts/deploy.sh
```
