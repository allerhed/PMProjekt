#!/usr/bin/env bash
# deploy/setup.sh — Initial setup for Azure VM (Ubuntu 24.04, B1s)
# Run once: scp deploy/setup.sh azureuser@<VM_IP>:~ && ssh azureuser@<VM_IP> 'bash setup.sh'
set -euo pipefail

echo "=== Azure VM Setup ==="

# 1. Swap space (critical for B1s 1GB RAM)
if [ ! -f /swapfile ]; then
  echo "Creating 2GB swap..."
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  sudo sysctl vm.swappiness=10
  echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
else
  echo "Swap already exists, skipping."
fi

# 2. Docker
if ! command -v docker &>/dev/null; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
  sudo systemctl enable docker
else
  echo "Docker already installed."
fi

# 3. Docker Compose plugin (comes with Docker now, but verify)
docker compose version || {
  echo "ERROR: docker compose plugin not found"; exit 1;
}

# 4. App directory
sudo mkdir -p /opt/app
sudo chown "$USER:$USER" /opt/app
echo "App directory: /opt/app"

# 5. Copy production files
echo ""
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "  1. Copy files to the VM:"
echo "     scp docker-compose.prod.yml .env azureuser@<VM_IP>:/opt/app/"
echo "     scp -r database/ azureuser@<VM_IP>:/opt/app/database/"
echo "  2. Create .env on the VM with production values (see .env.example)"
echo "  3. Log in to ACR: docker login taskproofacr.azurecr.io -u taskproofacr -p <password>"
echo "  4. Start services: cd /opt/app && docker compose -f docker-compose.prod.yml up -d"
