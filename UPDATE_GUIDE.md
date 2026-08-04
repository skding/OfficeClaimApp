# Oracle Cloud Application Update Guide

This guide walks you through updating your deployed **Office Claim** Next.js application on an Oracle Cloud Infrastructure (OCI) Ubuntu server using Git, Prisma, and PM2.

---

## 🛠️ Step-by-Step Update Process

### 1. SSH into your Oracle Cloud Server
Open your terminal or SSH client and connect to your instance:
```bash
ssh ubuntu@<YOUR_SERVER_IP>
```

### 2. Navigate to Application Directory
```bash
cd /opt/office-claim
```

### 3. Pull the Latest Code from GitHub
Fetch the latest commits from the `main` branch:
```bash
git pull origin main
```

### 4. Install Dependencies (If package.json changed)
```bash
npm install
```

### 5. Push Database Schema Changes
Apply any new Prisma schema updates (such as `isStaffArchived` or status changes) to PostgreSQL:
```bash
npx prisma db push
```

### 6. Generate Prisma Client
Ensure the Prisma Client TypeScript/JavaScript definitions are synced:
```bash
npx prisma generate
```

### 7. Rebuild the Production Next.js Bundle
Compile the Next.js application for production:
```bash
npm run build
```

### 8. Restart PM2 Process Manager
Reload the app seamlessly via PM2:
```bash
pm2 restart office-claim
```

---

## 🔍 Verification & Useful Commands

- **Check Application Status**:
  ```bash
  pm2 status
  ```

- **View Live Server Logs**:
  ```bash
  pm2 logs office-claim --lines 50
  ```

- **Restart Nginx (if reverse proxy config changed)**:
  ```bash
  sudo systemctl restart nginx
  ```
