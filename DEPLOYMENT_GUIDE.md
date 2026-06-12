# Deployment Guide: Next.js Office Claim on Oracle Cloud (Ubuntu + PM2)

This guide walks you through deploying your Next.js application on an Oracle Cloud Infrastructure (OCI) Compute Instance running Ubuntu, using PM2 as the process manager and Nginx as a reverse proxy.

---

## Prerequisites

Before starting, make sure your Ubuntu server has:
1. **Node.js (v22+)**
2. **PostgreSQL** database (running locally or hosted externally)
3. **Git**
4. **PM2** globally installed

### Install Node.js (via NodeSource) and PM2:
Run the following on your Ubuntu terminal:
```bash
# Update Ubuntu package lists
sudo apt update && sudo apt upgrade -y

# Install Node.js v22 LTS (Prisma streams requires Node >= 22)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Verify versions
node -v
npm -v

# Install PM2 globally
sudo npm install -g pm2
```

---

## 1. Setup Application & Environment

### Clone the Repository and Set Permissions:
Directories outside `/home/` (like `/opt/` or `/var/www/`) require root permission. Set directory ownership to your user (`ubuntu`) to avoid EACCES permission errors:
```bash
# Create directory
sudo mkdir -p /opt/office-claim

# Assign ownership to the current Ubuntu user
sudo chown -R $USER:$USER /opt/office-claim

# Clone the repository
git clone https://github.com/skding/OfficeClaimApp.git /opt/office-claim
cd /opt/office-claim
```

### Install Dependencies:
```bash
npm install
```

### Setup Environment Variables:
Copy the `.env.example` file and configure it:
```bash
cp .env.example .env
nano .env
```
Fill out the variables:
- **`DATABASE_URL`**: Your production PostgreSQL URL (e.g. `postgresql://user:password@host:5432/database?schema=public`).
- **`JWT_SECRET`**: Generate a strong random key (e.g., run `openssl rand -base64 32`).
- **Google Cloud Document AI** credentials (optional, if OCR is needed).

## 2. Sync Database & Build

### Create Database:
If the database specified in your `DATABASE_URL` (e.g. `claims_db`) does not exist yet, Prisma will attempt to create it. If the connection user does not have database creation privileges, PostgreSQL returns a `permission denied to create database` error.

To fix this, create the database manually on your Ubuntu server using the default `postgres` superuser:
```bash
# Create the database manually
sudo -u postgres createdb claims_db

# (Optional) If you are using a custom user, grant them permissions:
# sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE claims_db TO your_db_user;"
```

### Run Database Migrations:
Push the Prisma schema (which includes the `isArchived` field) to update your PostgreSQL database structure:
```bash
npx prisma db push
```
*(Optional)* Seed default accounts and admin/staff users:
```bash
node prisma/seed.js
```

### Build the Application:
Compile the Next.js production build:
```bash
npm run build
```

---

## 3. Run with PM2

To keep the application running continuously in the background and restart it on crash or server reboot, start it with PM2.

### Start the Process:
```bash
pm2 start npm --name "office-claim" -- start
```
*Alternatively, if you want to run on a custom port (e.g. 5000):*
```bash
pm2 start npm --name "office-claim" --run-script start -- -p 5000
```

### Configure PM2 Startup:
Generate and configure the startup script so PM2 launches the app when the Ubuntu server reboots:
```bash
pm2 startup
```
*Note: Copy the command printed in the terminal output, paste it, and run it (it will look like `sudo env PATH=... pm2 startup systemd -u ubuntu ...`).*

Save the current running list of processes:
```bash
pm2 save
```

---

## 4. OCI Networking & Ubuntu Firewall (Crucial)

Oracle Cloud instances running Ubuntu block all external incoming ports by default (except port 22/SSH). You **must** open your port both in the Ubuntu host firewall and the Oracle Cloud console.

### Option A: Open Ubuntu Firewall (Host Side)
If you are running the app directly on port `3000` (or `5000`), allow incoming connections:
```bash
# Using ufw (if active)
sudo ufw allow 3000/tcp

# OR using iptables (Standard Oracle Cloud Ubuntu template)
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT
sudo netfilter-persistent save
```

### Option B: Oracle Cloud Console Security List (Cloud Side)
1. Go to your **Oracle Cloud Console**.
2. Navigate to **Networking** > **Virtual Cloud Networks**.
3. Select the VCN associated with your instance, then click on the **Security List** (usually *Default Security List for...*).
4. Click **Add Ingress Rules**.
5. Set:
   - **Source Type**: `CIDR`
   - **Source CIDR**: `0.0.0.0/0` (allows public traffic)
   - **IP Protocol**: `TCP`
   - **Source Port Range**: *Leave blank*
   - **Destination Port Range**: `3000` (or `80` if using Nginx)
6. Click **Add Ingress Rules**.

---

## 5. Nginx Reverse Proxy & SSL (Recommended)

Instead of exposing port `3000` directly, it is highly recommended to route public HTTP/HTTPS traffic through Nginx.

### Install Nginx:
```bash
sudo apt install -y nginx
```

### Configure Nginx:
Create a new configuration file:
```bash
sudo nano /etc/nginx/sites-available/office-claim
```
Add the following layout (replacing `your-domain.com` with your actual domain or server IP):
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 20M; # For large PDF uploads
    }
}
```

Enable the configuration and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/office-claim /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default # Remove default config
sudo nginx -t # Test configuration
sudo systemctl restart nginx
```
*Remember to open port `80` in your Ubuntu iptables/ufw firewall and OCI Security List.*

### Install SSL Certificate (Let's Encrypt):
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## 6. PM2 Useful Commands

- **Check status**: `pm2 status`
- **View logs**: `pm2 logs office-claim`
- **Restart application**: `pm2 restart office-claim`
- **Stop application**: `pm2 stop office-claim`
