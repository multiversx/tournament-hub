# Tournament Hub - Deployment Plan

## Overview
This deployment plan covers the complete deployment of the Tournament Hub solution, which consists of:
- **Frontend**: React/TypeScript dApp with MultiversX wallet integration
- **Backend**: Python FastAPI game server with CryptoBubbles game engine
- **Smart Contract**: Rust MultiversX smart contract for tournament management
- **Infrastructure**: Production-ready deployment configuration

## Prerequisites

### Development Environment
- Node.js 18+ and npm/yarn
- Python 3.8+ and pip
- Rust and Cargo
- MultiversX CLI tools
- Git

### Production Environment
- Cloud provider account (AWS, Google Cloud, Azure, or DigitalOcean)
- Domain name for production
- SSL certificates
- Database (PostgreSQL recommended for production)

## Phase 1: Smart Contract Deployment

### 1.1 Prepare Smart Contract
```bash
cd tournament-hub-sc

# Build the contract
cargo build --target wasm32-unknown-unknown --release

# Generate ABI
cargo run --bin meta -- build
```

### 1.2 Deploy to Devnet (Testing)
```bash
# Configure for devnet
export MX_CHAIN_ID="D"
export MX_GATEWAY="https://devnet-gateway.multiversx.com"
export MX_EXPLORER="https://devnet-explorer.multiversx.com"

# Deploy contract
mxpy contract deploy --bytecode=output/tournament-hub.wasm \
    --gas-limit=60000000 \
    --recall-nonce \
    --send \
    --outfile=deploy-devnet.json
```

### 1.3 Deploy to Testnet (Staging)
```bash
# Configure for testnet
export MX_CHAIN_ID="T"
export MX_GATEWAY="https://testnet-gateway.multiversx.com"
export MX_EXPLORER="https://testnet-explorer.multiversx.com"

# Deploy contract
mxpy contract deploy --bytecode=output/tournament-hub.wasm \
    --gas-limit=60000000 \
    --recall-nonce \
    --send \
    --outfile=deploy-testnet.json
```

### 1.4 Deploy to Mainnet (Production)
```bash
# Configure for mainnet
export MX_CHAIN_ID="1"
export MX_GATEWAY="https://gateway.multiversx.com"
export MX_EXPLORER="https://explorer.multiversx.com"

# Deploy contract
mxpy contract deploy --bytecode=output/tournament-hub.wasm \
    --gas-limit=60000000 \
    --recall-nonce \
    --send \
    --outfile=deploy-mainnet.json
```

### 1.5 Update Frontend Configuration
After each deployment, update the contract address in:
- `tournament-hub-frontend/src/config/contract.ts`
- `tournament-hub-frontend/src/config/config.devnet.ts`
- `tournament-hub-frontend/src/config/config.testnet.ts`
- `tournament-hub-frontend/src/config/config.mainnet.ts`

## Phase 2: Backend Game Server Deployment

### 2.1 Prepare Backend for Production
```bash
cd tournament-hub-game-server

# Create production requirements
cat > requirements.prod.txt << EOF
fastapi==0.104.1
uvicorn[standard]==0.24.0
requests==2.31.0
cryptography==41.0.7
pynacl==1.5.0
multiversx-sdk==1.0.0
gunicorn==21.2.0
python-dotenv==1.0.0
psycopg2-binary==2.9.9
redis==5.0.1
EOF

# Create production Dockerfile
cat > Dockerfile << EOF
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.prod.txt .
RUN pip install --no-cache-dir -r requirements.prod.txt

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start the application
CMD ["gunicorn", "main:app", "--bind", "0.0.0.0:8000", "--workers", "4", "--worker-class", "uvicorn.workers.UvicornWorker"]
EOF
```

### 2.2 Environment Configuration
Create environment files for different stages:

```bash
# .env.dev
cat > .env.dev << EOF
ENVIRONMENT=development
DATABASE_URL=postgresql://user:password@localhost:5432/tournament_hub_dev
REDIS_URL=redis://localhost:6379/0
MULTIVERSX_NETWORK=devnet
MULTIVERSX_GATEWAY=https://devnet-gateway.multiversx.com
CONTRACT_ADDRESS=erd1qqqqqqqqqqqqqpgqtmcuh307t6kky677ernjj9ulk64zq74w9l5qxyhdn7
PRIVATE_KEY=your_private_key_here
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
EOF

# .env.prod
cat > .env.prod << EOF
ENVIRONMENT=production
DATABASE_URL=postgresql://user:password@your-db-host:5432/tournament_hub_prod
REDIS_URL=redis://your-redis-host:6379/0
MULTIVERSX_NETWORK=mainnet
MULTIVERSX_GATEWAY=https://gateway.multiversx.com
CONTRACT_ADDRESS=erd1qqqqqqqqqqqqqpgqtmcuh307t6kky677ernjj9ulk64zq74w9l5qxyhdn7
PRIVATE_KEY=your_production_private_key_here
CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com
EOF
```

### 2.3 Docker Compose for Local Development
```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  game-server:
    build: .
    ports:
      - "8000:8000"
    environment:
      - ENVIRONMENT=development
    env_file:
      - .env.dev
    volumes:
      - .:/app
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: tournament_hub_dev
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### 2.4 Production Deployment Options

#### Option A: Cloud Run (Google Cloud)
```bash
# Build and deploy to Cloud Run
gcloud builds submit --tag gcr.io/YOUR_PROJECT/tournament-hub-game-server
gcloud run deploy tournament-hub-game-server \
    --image gcr.io/YOUR_PROJECT/tournament-hub-game-server \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --set-env-vars ENVIRONMENT=production \
    --set-env-vars MULTIVERSX_NETWORK=mainnet
```

#### Option B: AWS ECS
```bash
# Create ECR repository
aws ecr create-repository --repository-name tournament-hub-game-server

# Build and push image
docker build -t tournament-hub-game-server .
docker tag tournament-hub-game-server:latest YOUR_ACCOUNT.dkr.ecr.REGION.amazonaws.com/tournament-hub-game-server:latest
docker push YOUR_ACCOUNT.dkr.ecr.REGION.amazonaws.com/tournament-hub-game-server:latest
```

#### Option C: DigitalOcean App Platform
```bash
# Deploy using doctl
doctl apps create --spec app.yaml
```

## Phase 3: Frontend Deployment

### 3.1 Prepare Frontend for Production
```bash
cd tournament-hub-frontend

# Create production environment variables
cat > .env.production << EOF
VITE_ENVIRONMENT=production
VITE_API_URL=https://your-game-server-domain.com
VITE_MULTIVERSX_NETWORK=mainnet
VITE_CONTRACT_ADDRESS=erd1qqqqqqqqqqqqqpgqtmcuh307t6kky677ernjj9ulk64zq74w9l5qxyhdn7
EOF

# Create production Dockerfile
cat > Dockerfile << EOF
FROM node:18-alpine as builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
EXPOSE 443

CMD ["nginx", "-g", "daemon off;"]
EOF

# Create nginx configuration
cat > nginx.conf << EOF
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    server {
        listen 80;
        server_name your-domain.com www.your-domain.com;
        
        # Redirect HTTP to HTTPS
        return 301 https://\$server_name\$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name your-domain.com www.your-domain.com;

        # SSL configuration
        ssl_certificate /etc/ssl/certs/your-domain.crt;
        ssl_certificate_key /etc/ssl/private/your-domain.key;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;

        root /usr/share/nginx/html;
        index index.html;

        # Handle React Router
        location / {
            try_files \$uri \$uri/ /index.html;
        }

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # API proxy to game server
        location /api/ {
            proxy_pass https://your-game-server-domain.com/;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
    }
}
EOF
```

### 3.2 Production Deployment Options

#### Option A: Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

#### Option B: Netlify
```bash
# Build the project
npm run build

# Deploy to Netlify
netlify deploy --prod --dir=build
```

#### Option C: AWS S3 + CloudFront
```bash
# Build the project
npm run build

# Sync to S3
aws s3 sync build/ s3://your-bucket-name --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"
```

#### Option D: Docker Deployment
```bash
# Build and run Docker container
docker build -t tournament-hub-frontend .
docker run -d -p 80:80 -p 443:443 tournament-hub-frontend
```

## Phase 4: Infrastructure Setup

### 4.1 Domain and SSL Setup
```bash
# Purchase domain (e.g., tournament-hub.com)
# Configure DNS records:
# A record: @ -> Your server IP
# CNAME record: www -> @

# SSL certificate setup (Let's Encrypt)
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

### 4.2 Database Setup (PostgreSQL)
```bash
# Install PostgreSQL
sudo apt-get install postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql
CREATE DATABASE tournament_hub_prod;
CREATE USER tournament_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE tournament_hub_prod TO tournament_user;
\q

# Run migrations (if any)
psql -h localhost -U tournament_user -d tournament_hub_prod -f migrations.sql
```

### 4.3 Redis Setup
```bash
# Install Redis
sudo apt-get install redis-server

# Configure Redis for production
sudo nano /etc/redis/redis.conf

# Set password
requirepass your_redis_password

# Enable persistence
save 900 1
save 300 10
save 60 10000

# Restart Redis
sudo systemctl restart redis
```

### 4.4 Monitoring and Logging
```bash
# Install monitoring tools
sudo apt-get install htop iotop nethogs

# Setup log rotation
sudo nano /etc/logrotate.d/tournament-hub

# Add configuration
/path/to/your/app/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
}
```

## Phase 5: CI/CD Pipeline

### 5.1 GitHub Actions Workflow
```yaml
# .github/workflows/deploy.yml
name: Deploy Tournament Hub

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: tournament-hub-frontend/package-lock.json
      
      - name: Install frontend dependencies
        run: cd tournament-hub-frontend && npm ci
      
      - name: Run frontend tests
        run: cd tournament-hub-frontend && npm test
      
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install backend dependencies
        run: cd tournament-hub-game-server && pip install -r requirements.txt
      
      - name: Run backend tests
        run: cd tournament-hub-game-server && python -m pytest

  deploy-smart-contract:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Rust
        uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
          target: wasm32-unknown-unknown
      
      - name: Build smart contract
        run: |
          cd tournament-hub-sc
          cargo build --target wasm32-unknown-unknown --release
          cargo run --bin meta -- build
      
      - name: Deploy to testnet
        run: |
          # Add deployment script here
          echo "Deploying to testnet..."

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Docker Buildx
        uses: docker/setup-buildx-action@v2
      
      - name: Login to Docker Hub
        uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}
      
      - name: Build and push backend image
        uses: docker/build-push-action@v4
        with:
          context: ./tournament-hub-game-server
          push: true
          tags: your-username/tournament-hub-game-server:latest
      
      - name: Deploy to production
        run: |
          # Add deployment script here
          echo "Deploying backend to production..."

  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: tournament-hub-frontend/package-lock.json
      
      - name: Install dependencies
        run: cd tournament-hub-frontend && npm ci
      
      - name: Build frontend
        run: cd tournament-hub-frontend && npm run build
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: ./tournament-hub-frontend
```

## Phase 6: Security and Performance

### 6.1 Security Measures
```bash
# Firewall setup
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 8000  # Game server port

# Fail2ban setup
sudo apt-get install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Regular security updates
sudo apt-get update && sudo apt-get upgrade -y
```

### 6.2 Performance Optimization
```bash
# Nginx optimization
sudo nano /etc/nginx/nginx.conf

# Add to http block:
worker_processes auto;
worker_connections 1024;
keepalive_timeout 65;
client_max_body_size 10M;

# Enable gzip compression
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
```

### 6.3 Backup Strategy
```bash
# Database backup script
cat > /opt/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="tournament_hub_prod"

mkdir -p $BACKUP_DIR
pg_dump -h localhost -U tournament_user $DB_NAME > $BACKUP_DIR/db_backup_$DATE.sql

# Keep only last 7 days of backups
find $BACKUP_DIR -name "db_backup_*.sql" -mtime +7 -delete
EOF

chmod +x /opt/backup-db.sh

# Add to crontab
echo "0 2 * * * /opt/backup-db.sh" | crontab -
```

## Phase 7: Testing and Validation

### 7.1 Pre-deployment Testing
```bash
# Smart contract testing
cd tournament-hub-sc
cargo test

# Backend testing
cd tournament-hub-game-server
python -m pytest tests/

# Frontend testing
cd tournament-hub-frontend
npm test
npm run build
```

### 7.2 Post-deployment Validation
```bash
# Health checks
curl -f https://your-domain.com/api/health
curl -f https://your-game-server-domain.com/health

# Contract interaction test
# Test tournament creation, joining, and game completion

# Performance testing
ab -n 1000 -c 10 https://your-domain.com/
```

## Phase 8: Monitoring and Maintenance

### 8.1 Application Monitoring
```bash
# Install monitoring tools
sudo apt-get install prometheus node-exporter grafana

# Setup Prometheus configuration
sudo nano /etc/prometheus/prometheus.yml

# Add targets:
scrape_configs:
  - job_name: 'tournament-hub-backend'
    static_configs:
      - targets: ['localhost:8000']
```

### 8.2 Log Management
```bash
# Setup centralized logging
sudo apt-get install rsyslog

# Configure log forwarding
sudo nano /etc/rsyslog.conf

# Add:
*.* @your-log-server:514
```

## Deployment Checklist

### Pre-deployment
- [ ] Smart contract tested on devnet
- [ ] Backend API tested locally
- [ ] Frontend builds successfully
- [ ] Environment variables configured
- [ ] SSL certificates obtained
- [ ] Domain DNS configured
- [ ] Database schema ready
- [ ] Backup strategy in place

### Deployment
- [ ] Smart contract deployed to target network
- [ ] Contract address updated in frontend config
- [ ] Backend deployed and accessible
- [ ] Frontend deployed and accessible
- [ ] SSL certificates installed
- [ ] Database migrations run
- [ ] Monitoring tools configured

### Post-deployment
- [ ] Health checks passing
- [ ] End-to-end testing completed
- [ ] Performance benchmarks met
- [ ] Security scan completed
- [ ] Documentation updated
- [ ] Team notified of deployment

## Rollback Plan

### Emergency Rollback Steps
1. **Frontend**: Revert to previous deployment
2. **Backend**: Rollback Docker image or restore from backup
3. **Smart Contract**: Deploy previous version (if critical)
4. **Database**: Restore from latest backup

### Rollback Commands
```bash
# Frontend rollback (Vercel)
vercel rollback

# Backend rollback (Docker)
docker pull your-username/tournament-hub-game-server:previous
docker-compose down
docker-compose up -d

# Database rollback
pg_restore -h localhost -U tournament_user -d tournament_hub_prod backup_file.sql
```

## Cost Estimation

### Monthly Costs (Estimated)
- **Domain**: $10-15/year
- **SSL Certificate**: Free (Let's Encrypt)
- **VPS/Cloud Server**: $20-50/month
- **Database**: $10-30/month
- **CDN**: $10-50/month
- **Monitoring**: $10-30/month
- **Total**: $60-175/month

## Timeline

### Week 1: Smart Contract
- Deploy to devnet
- Testing and validation
- Deploy to testnet

### Week 2: Backend
- Setup production environment
- Deploy game server
- Configure monitoring

### Week 3: Frontend
- Deploy frontend application
- Configure CDN and SSL
- End-to-end testing

### Week 4: Production
- Deploy to mainnet
- Performance optimization
- Security audit
- Go live

## Support and Maintenance

### Regular Maintenance Tasks
- Weekly security updates
- Monthly performance reviews
- Quarterly backup testing
- Annual SSL certificate renewal

### Support Contacts
- **Technical Issues**: Your team
- **Infrastructure**: Cloud provider support
- **Domain/SSL**: Domain registrar
- **MultiversX**: MultiversX community/forum

This deployment plan provides a comprehensive roadmap for deploying your Tournament Hub solution to production. Adjust the specific details based on your chosen cloud provider and requirements. 