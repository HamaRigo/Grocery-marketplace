# Deploying Bakala Shop on Oracle Cloud Free Tier

Full stack (API + frontend + PostgreSQL + Redis + Elasticsearch) at zero cost, forever.

---

## What you get for free

| Resource | Always Free quota |
|---|---|
| VM | 1× Ampere A1 ARM — **4 OCPU + 24 GB RAM** |
| Storage | 200 GB block volume |
| Egress | 10 TB/month outbound |
| Cost | **$0, no expiry** |

---

## Step 1 — Create an Oracle Cloud account

1. Go to **https://cloud.oracle.com** → click **Start for free**
2. Fill in your details and add a credit card (used only for identity verification — you will not be charged)
3. Choose a **Home Region** closest to your users (you cannot change this later)
4. Wait for the welcome email — provisioning takes 5–10 minutes

---

## Step 2 — Create the VM instance

1. In the OCI Console, open the hamburger menu → **Compute → Instances → Create Instance**
2. **Name**: `bakala-prod`
3. **Image**: click *Change image* → select **Canonical Ubuntu 22.04** (Minimal)
4. **Shape**: click *Change shape*
   - Series: **Ampere**
   - Shape: **VM.Standard.A1.Flex**
   - Set **4 OCPUs** and **24 GB memory**
5. **SSH keys**: paste your public key (`~/.ssh/id_ed25519.pub`) or let OCI generate a pair and download the private key
6. **Boot volume**: 100 GB is fine (default)
7. **Startup script** — expand **Advanced Options → Initialization Script**, select **Paste cloud-init script**, and paste the entire contents of `scripts/cloud-init.sh`
   - The script installs Docker, opens ports, clones the repo, and registers a systemd service that brings the stack up automatically on every reboot
8. Click **Create** — the VM starts in ~2 minutes

Note the **Public IP address** shown on the instance detail page — you'll need it throughout this guide.

---

## Step 3 — Open firewall ports (Security List)

OCI blocks all inbound traffic by default.

1. In the instance detail page, click the **Subnet** link in the *Primary VNIC* section
2. Click the **Default Security List**
3. Under **Ingress Rules**, click **Add Ingress Rules** and add these four rows:

| Source CIDR | Protocol | Port | Description |
|---|---|---|---|
| 0.0.0.0/0 | TCP | 80 | HTTP / frontend |
| 0.0.0.0/0 | TCP | 443 | HTTPS (if you add SSL later) |
| 0.0.0.0/0 | TCP | 22 | SSH (already exists by default) |

Port 3000 (API) does **not** need to be public — nginx proxies it internally.

---

## Step 4 — Watch the startup script run (optional)

The cloud-init script starts automatically on first boot. You can tail its progress:

```bash
ssh ubuntu@<YOUR_VM_PUBLIC_IP>
sudo tail -f /var/log/bakala-init.log
```

When it finishes you will see:

```
════════════════════════════════════════════════
  Bootstrap complete. One manual step remains:
  ...
════════════════════════════════════════════════
==> [2026-06-23T...] Bakala bootstrap finished
```

Everything is installed (Docker, Compose, Git) and the `bakala` systemd service is registered. The stack will now start automatically on every reboot — you never need to SSH in for restarts.

---

## Step 5 — Configure secrets and start the stack

```bash
sudo mkdir -p /opt/bakala-shop
sudo chown ubuntu:ubuntu /opt/bakala-shop
git clone https://github.com/HamaRigo/Grocery-marketplace.git /opt/bakala-shop
cd /opt/bakala-shop
git checkout prod
```

### SSH in and create the production env file

```bash
ssh ubuntu@<YOUR_VM_PUBLIC_IP>
cd /opt/bakala-shop
cp .env.prod.example .env.prod
nano .env.prod
```

Replace every `CHANGE_ME` value. Generate strong secrets with:

```bash
openssl rand -base64 32   # for passwords
openssl rand -base64 48   # for JWT_SECRET (≥ 64 chars)
```

Minimum required values:

```env
POSTGRES_USER=bakala
POSTGRES_PASSWORD=<strong-password>
DATABASE_URL=postgres://bakala:<strong-password>@postgres:5432/bakala

REDIS_PASSWORD=<strong-password>
REDIS_URL=redis://:<strong-password>@redis:6379

ELASTICSEARCH_URL=http://elasticsearch:9200

FRONTEND_URL=http://<YOUR_VM_PUBLIC_IP>
JWT_SECRET=<64-char-secret>

PORT=3000
TRACKING_PORT=3001
DISCOVERY_PORT=3002
NODE_ENV=production
```

---

## Step 6 — Start the stack

```bash
sudo systemctl start bakala
```

`systemctl` delegates to `docker-compose.prod.yml`, which will:
1. Build all Docker images (10–15 min on first run)
2. Start PostgreSQL, Redis, and Elasticsearch
3. Run database migrations (one-shot container that exits 0)
4. Start the API + background services
5. Start the nginx frontend container

When it finishes, visit **http://\<YOUR_VM_PUBLIC_IP\>** — Bakala Shop is live.

Check service health:

```bash
# systemd status
sudo systemctl status bakala

# container-level status
docker compose -f docker-compose.prod.yml ps

# live logs
docker compose -f docker-compose.prod.yml logs -f api frontend
```

---

## Step 7 — Wire up GitHub Actions for auto-deploy

Every push to the `prod` branch will now build new images and SSH-deploy them automatically.

### 7a. Generate a dedicated deploy SSH key (on your local machine)

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/bakala_deploy
```

### 7b. Authorise the key on the VM

```bash
# On the VM:
echo "<contents of ~/.ssh/bakala_deploy.pub>" >> ~/.ssh/authorized_keys
```

### 7c. Add secrets to GitHub

Go to your repo → **Settings → Secrets and variables → Actions → New repository secret**

| Secret name | Value |
|---|---|
| `PROD_HOST` | Your VM public IP (e.g. `129.154.x.x`) |
| `PROD_USER` | `ubuntu` |
| `PROD_SSH_KEY` | Full contents of `~/.ssh/bakala_deploy` (private key) |

### 7d. Trigger a deployment

```bash
# From your local machine:
git checkout prod
git pull
# Make any change, commit, and push:
git push origin prod
```

The **Deploy to Production** workflow appears in GitHub → **Actions** tab.

---

## Step 8 — Add a custom domain + HTTPS (optional but recommended)

### 8a. Point your domain

Create an **A record** in your DNS provider:

```
yourdomain.com  →  <YOUR_VM_PUBLIC_IP>
```

### 8b. Install Certbot (Let's Encrypt)

```bash
sudo apt-get install -y certbot
```

Stop the frontend container briefly (to free port 80 for the ACME challenge):

```bash
docker compose -f docker-compose.prod.yml stop frontend
sudo certbot certonly --standalone -d yourdomain.com
docker compose -f docker-compose.prod.yml start frontend
```

Certificates land in `/etc/letsencrypt/live/yourdomain.com/`.

### 8c. Update nginx to terminate TLS

Edit `frontend/nginx.conf` — add a second server block:

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # ... paste the existing location blocks from the HTTP server block ...
}

server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}
```

Mount the certificates into the frontend container. In `docker-compose.prod.yml`, add under `frontend:`:

```yaml
volumes:
  - /etc/letsencrypt:/etc/letsencrypt:ro
ports:
  - '80:80'
  - '443:443'
```

Then update `FRONTEND_URL` in `.env.prod`:

```env
FRONTEND_URL=https://yourdomain.com
```

Redeploy:

```bash
./deploy.sh
```

### 8d. Auto-renew certificates

```bash
sudo crontab -e
```

Add:

```cron
0 3 * * * certbot renew --quiet --pre-hook "docker compose -f /opt/bakala-shop/docker-compose.prod.yml stop frontend" --post-hook "docker compose -f /opt/bakala-shop/docker-compose.prod.yml start frontend"
```

---

## Useful commands

```bash
# View all service statuses
docker compose -f docker-compose.prod.yml ps

# Tail logs for a specific service
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f frontend

# Restart a single service without downtime
docker compose -f docker-compose.prod.yml restart api

# Run a DB migration manually
docker compose -f docker-compose.prod.yml run --rm migrate

# Enter a psql shell
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U bakala -d bakala

# Clear Redis cache
docker compose -f docker-compose.prod.yml exec redis \
  redis-cli -a <REDIS_PASSWORD> FLUSHDB

# Pull latest prod changes and redeploy
cd /opt/bakala-shop && git pull origin prod && ./deploy.sh
```

---

## Architecture on the VM

```
Internet
    │ :80 / :443
    ▼
┌─────────────────────────────────────────────────┐
│  Docker network (bakala_default)                │
│                                                 │
│  nginx:80 (frontend)                            │
│   ├─ /  →  React SPA (static files)             │
│   ├─ /api routes  →  api:3000 (Fastify)         │
│   └─ /tracking/ws  →  api:3000 (WebSocket)      │
│                                                 │
│  api:3000 (Fastify)                             │
│   ├─ postgres:5432                              │
│   ├─ redis:6379                                 │
│   └─ elasticsearch:9200                         │
│                                                 │
│  notifications-svc  │  tracking-svc             │
│  discovery-svc      │  (background workers)     │
└─────────────────────────────────────────────────┘
```

Total RAM usage at idle: ~3–4 GB (well within the 24 GB free quota).
