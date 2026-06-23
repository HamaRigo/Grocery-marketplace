#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Bakala Shop — OCI startup script
#
# Paste the contents of this file into:
#   OCI Console → Create Instance → Advanced Options → Initialization Script
#
# Runs as root on first boot.  Everything below is idempotent, so it is also
# safe to re-run manually later:
#   sudo bash /var/lib/cloud/instance/scripts/part-001
#
# What it does:
#   1. Updates the system and installs Docker + Git
#   2. Opens ports 80 and 443 in Ubuntu's iptables rules
#   3. Clones the prod branch to /opt/bakala-shop
#   4. Installs a systemd service so the Docker stack restarts on every reboot
#   5. Starts the stack if .env.prod already exists, otherwise prints next steps
#
# After the script finishes, SSH in and run:
#   cp /opt/bakala-shop/.env.prod.example /opt/bakala-shop/.env.prod
#   nano /opt/bakala-shop/.env.prod        # fill in secrets
#   sudo systemctl start bakala
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# All output goes to a log you can read later with: sudo cat /var/log/bakala-init.log
exec > >(tee -a /var/log/bakala-init.log) 2>&1
echo "==> [$(date -u)] Bakala bootstrap started"

# ── 1. System update ──────────────────────────────────────────────────────────
export DEBIAN_FRONTEND=noninteractive
apt-get update  -y
apt-get upgrade -y
apt-get install -y git curl iptables-persistent netfilter-persistent

# ── 2. Docker Engine (skipped if already installed) ───────────────────────────
if ! command -v docker &>/dev/null; then
  echo "==> Installing Docker..."
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker
usermod -aG docker ubuntu

# ── 3. Docker Compose plugin (skipped if already installed) ───────────────────
COMPOSE_BIN=/usr/local/lib/docker/cli-plugins/docker-compose
if [ ! -f "$COMPOSE_BIN" ]; then
  echo "==> Installing Docker Compose plugin..."
  ARCH=$(uname -m)   # aarch64 on OCI ARM instances
  mkdir -p /usr/local/lib/docker/cli-plugins
  curl -SL \
    "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-${ARCH}" \
    -o "$COMPOSE_BIN"
  chmod +x "$COMPOSE_BIN"
fi
echo "    docker compose $(docker compose version --short)"

# ── 4. Firewall: open ports 80 and 443 ───────────────────────────────────────
# OCI instances run Ubuntu's iptables on top of the OCI Security List rules.
# Both layers must allow a port for traffic to reach the container.
open_port() {
  local port=$1
  iptables -C INPUT -m state --state NEW -p tcp --dport "$port" -j ACCEPT 2>/dev/null \
    || iptables -I INPUT 6 -m state --state NEW -p tcp --dport "$port" -j ACCEPT
}
open_port 80
open_port 443
netfilter-persistent save
echo "==> Firewall: ports 80 and 443 open"

# ── 5. Clone / update the repo ────────────────────────────────────────────────
REPO_URL="https://github.com/HamaRigo/Grocery-marketplace.git"
REPO_DIR="/opt/bakala-shop"

if [ ! -d "$REPO_DIR/.git" ]; then
  echo "==> Cloning repo to $REPO_DIR..."
  git clone "$REPO_URL" "$REPO_DIR"
else
  echo "==> Updating existing repo..."
  git -C "$REPO_DIR" fetch origin prod
fi

git -C "$REPO_DIR" checkout prod
git -C "$REPO_DIR" reset --hard origin/prod
chown -R ubuntu:ubuntu "$REPO_DIR"
chmod +x "$REPO_DIR/deploy.sh"
echo "==> Repo ready at $REPO_DIR (branch: prod)"

# ── 6. Systemd service — auto-start on every reboot ──────────────────────────
cat > /etc/systemd/system/bakala.service << 'SERVICE'
[Unit]
Description=Bakala Shop (Docker Compose)
Documentation=https://github.com/HamaRigo/Grocery-marketplace
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/bakala-shop

# Start: bring the full stack up in detached mode
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yml up -d

# Stop: graceful shutdown (30 s timeout per container)
ExecStop=/usr/bin/docker compose -f docker-compose.prod.yml down --timeout 30

# If the stack crashes, try restarting after 10 s
Restart=on-failure
RestartSec=10s

# Give containers 5 minutes to become healthy before systemd gives up
TimeoutStartSec=300

User=ubuntu

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable bakala.service
echo "==> systemd: bakala.service installed and enabled"

# ── 7. First-run: start the stack only if .env.prod exists ───────────────────
ENV_FILE="$REPO_DIR/.env.prod"

if [ -f "$ENV_FILE" ]; then
  if grep -q "CHANGE_ME" "$ENV_FILE"; then
    echo ""
    echo "!! WARNING: $ENV_FILE still contains CHANGE_ME placeholders."
    echo "   Fill them in, then run:  sudo systemctl start bakala"
  else
    echo "==> .env.prod found — starting the stack..."
    sudo -u ubuntu bash "$REPO_DIR/deploy.sh"
  fi
else
  echo ""
  echo "════════════════════════════════════════════════════════════"
  echo "  Bootstrap complete. One manual step remains:"
  echo ""
  echo "  1. SSH into the VM:"
  echo "       ssh ubuntu@$(curl -s ifconfig.me)"
  echo ""
  echo "  2. Create the production env file:"
  echo "       cp $ENV_FILE.example $ENV_FILE"
  echo "       nano $ENV_FILE"
  echo ""
  echo "  3. Start the stack:"
  echo "       sudo systemctl start bakala"
  echo ""
  echo "  Logs: sudo journalctl -u bakala -f"
  echo "════════════════════════════════════════════════════════════"
fi

echo "==> [$(date -u)] Bakala bootstrap finished"
