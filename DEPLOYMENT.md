# Production Deployment Guide — NKB Formulation Management System

This document outlines the deployment instructions for running the **NKB Formulation Management System** on a single production Node.js server (such as a Hostinger VPS or Ubuntu VPS instance).

---

## Architecture Overview

In production mode (`NODE_ENV=production`), the single Express.js backend process serves both:
1. All RESTful API endpoints under `/api/v1/*`.
2. The compiled Vite React SPA static assets from the `dist/` folder for any non-API web request.

---

## Server Environment Requirements

- **Operating System**: Ubuntu 22.04 LTS / 24.04 LTS (or Debian 12 / RHEL)
- **Node.js**: v18+ LTS (v20+ or v22+ recommended)
- **Database**: MySQL 8.0+ (or MariaDB 10.6+)
- **Process Manager**: PM2
- **Reverse Proxy**: Nginx (optional, with SSL via Certbot)

---

## Step-by-Step Hostinger VPS Deployment Instructions

### Step 1: Install Node.js & System Dependencies

```bash
# Update package repositories
sudo apt update && sudo apt upgrade -y

# Install Node.js v20 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs build-essential git

# Verify Node.js and npm versions
node -v
npm -v

# Install PM2 globally
sudo npm install -g pm2
```

### Step 2: Install and Configure MySQL Database

```bash
# Install MySQL Server
sudo apt install -y mysql-server

# Secure installation
sudo mysql_secure_installation

# Create Database and User
sudo mysql -u root -p
```

Inside MySQL shell:
```sql
CREATE DATABASE nkb_formulation_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'nkb_user'@'localhost' IDENTIFIED BY 'Your_Strong_Production_Password_Here';
GRANT ALL PRIVILEGES ON nkb_formulation_db.* TO 'nkb_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

### Step 3: Clone Codebase & Install Dependencies

```bash
# Navigate to application directory
cd /var/www
git clone <your-repository-url> nkb-formulation-system
cd nkb-formulation-system

# Install Node dependencies
npm install --production=false
```

---

### Step 4: Configure Environment Variables

Create `.env` file in the root project folder:

```bash
nano .env
```

Add production settings:
```ini
PORT=5000
NODE_ENV=production

# Database Client & Credentials
DB_CLIENT=mysql2
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=nkb_user
DB_PASSWORD=Your_Strong_Production_Password_Here
DB_NAME=nkb_formulation_db

# Security Secrets
JWT_ACCESS_SECRET=your_production_jwt_access_secret_key_change_me
JWT_REFRESH_SECRET=your_production_jwt_refresh_secret_key_change_me
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Default Super Admin Setup
DEFAULT_ADMIN_EMAIL=admin@nkb.com
DEFAULT_ADMIN_PASSWORD=Admin@123456
```

---

### Step 5: Execute Database Migrations & Initial Seed Data

```bash
# Run 25 database migrations
npm run migrate:latest

# Seed initial roles, permissions, system settings, and sample data
npm run seed:run

# Ensure Super Admin account exists
npm run seed:admin
```

---

### Step 6: Build React Frontend Production Bundle

```bash
# Compile Vite frontend into dist/
npm run build
```

---

### Step 7: Launch Application using PM2

```bash
# Start backend server with PM2
pm2 start server/index.js --name "nkb-formulation-system"

# Save PM2 process list and configure auto-restart on server reboot
pm2 save
pm2 startup
```

---

### Step 8: Configure Nginx Reverse Proxy (Optional with SSL)

```bash
# Install Nginx
sudo apt install -y nginx

# Edit Nginx site configuration
sudo nano /etc/nginx/sites-available/nkb-formulation
```

Nginx configuration block:
```nginx
server {
    listen 80;
    server_name formulation.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/nkb-formulation /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

Install Certbot for SSL (HTTPS):
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d formulation.yourdomain.com
```

---

## Daily Database Backup Documentation

To configure automated daily backups for MySQL:

```bash
sudo mkdir -p /var/backups/nkb_db
sudo nano /usr/local/bin/backup_nkb_db.sh
```

Backup Script:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/nkb_db"
DATE=$(date +%Y-%m-%d_%H%M%S)
DB_USER="nkb_user"
DB_PASS="Your_Strong_Production_Password_Here"
DB_NAME="nkb_formulation_db"

mysqldump -u ${DB_USER} -p${DB_PASS} ${DB_NAME} | gzip > ${BACKUP_DIR}/nkb_db_${DATE}.sql.gz
find ${BACKUP_DIR} -type f -name "*.sql.gz" -mtime +30 -delete
```

Make executable and add to crontab:
```bash
sudo chmod +x /usr/local/bin/backup_nkb_db.sh
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup_nkb_db.sh") | crontab -
```

---
