#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  Eventora EC2 Deployment Script
#  Run this on a fresh Amazon Linux 2023 or Ubuntu 22.04 EC2
# ═══════════════════════════════════════════════════════════

set -e

echo "🚀 Eventora EC2 Deployment"
echo "═══════════════════════════"

# ── Detect OS ───────────────────────────────────────────────
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo "❌ Cannot detect OS"
    exit 1
fi

# ── Install Docker ──────────────────────────────────────────
echo "📦 Installing Docker..."

if [ "$OS" = "amzn" ]; then
    # Amazon Linux 2023
    sudo dnf update -y
    sudo dnf install -y docker git
    sudo systemctl start docker
    sudo systemctl enable docker
    sudo usermod -aG docker $USER

    # Install Docker Compose plugin
    sudo mkdir -p /usr/local/lib/docker/cli-plugins
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep '"tag_name"' | cut -d'"' -f4)
    sudo curl -SL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-$(uname -m)" \
        -o /usr/local/lib/docker/cli-plugins/docker-compose
    sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

elif [ "$OS" = "ubuntu" ]; then
    # Ubuntu 22.04+
    sudo apt-get update -y
    sudo apt-get install -y ca-certificates curl gnupg git
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
        sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    sudo usermod -aG docker $USER
else
    echo "❌ Unsupported OS: $OS (use Amazon Linux 2023 or Ubuntu 22.04)"
    exit 1
fi

echo "✅ Docker installed"

# ── Clone repo (if not already in it) ──────────────────────
if [ ! -f "docker-compose.yml" ]; then
    echo "📥 Cloning Eventora..."
    git clone https://github.com/sheel-todkar/Eventora.git
    cd Eventora
fi

# ── Create server/.env ─────────────────────────────────────
if [ ! -f "server/.env" ]; then
    echo ""
    echo "⚙️  Setting up environment variables..."
    echo "   (Press Enter to use defaults shown in brackets)"
    echo ""

    read -p "MongoDB Atlas URI (mongodb+srv://...): " MONGO_URI
    read -p "Frontend URL for CORS [http://EC2-IP]: " CLIENT_URL
    read -p "JWT Secret [eventora_jwt_secret_2026]: " JWT_SECRET
    JWT_SECRET=${JWT_SECRET:-eventora_jwt_secret_2026}
    read -p "Email (Gmail): " EMAIL_USER
    read -p "Email App Password: " EMAIL_PASS
    read -p "Razorpay Key ID [rzp_test_placeholder]: " RAZORPAY_KEY_ID
    RAZORPAY_KEY_ID=${RAZORPAY_KEY_ID:-rzp_test_placeholder}
    read -p "Razorpay Key Secret [placeholder_secret]: " RAZORPAY_KEY_SECRET
    RAZORPAY_KEY_SECRET=${RAZORPAY_KEY_SECRET:-placeholder_secret}

    cat > server/.env <<EOF
PORT=5000
MONGO_URI=${MONGO_URI}
JWT_SECRET=${JWT_SECRET}
EMAIL_USER=${EMAIL_USER}
EMAIL_PASS=${EMAIL_PASS}
RAZORPAY_KEY_ID=${RAZORPAY_KEY_ID}
RAZORPAY_KEY_SECRET=${RAZORPAY_KEY_SECRET}
REDIS_URL=redis://redis:6379
NODE_ENV=production
CLIENT_URL=${CLIENT_URL}
EOF

    echo "✅ server/.env created"
else
    echo "✅ server/.env already exists"
fi

# ── Build and start ────────────────────────────────────────
echo ""
echo "🔨 Building and starting containers..."
sudo docker compose up -d --build

echo ""
echo "═══════════════════════════════════════════════════════"
echo "✅ Deployment complete!"
echo ""
echo "   🌐 App:     http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo '<your-ec2-ip>')"
echo "   📊 Health:  http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo '<your-ec2-ip>')/api/health"
echo ""
echo "   Useful commands:"
echo "   docker compose ps          — check container status"
echo "   docker compose logs -f     — view live logs"
echo "   docker compose restart     — restart all services"
echo "   docker compose down        — stop all services"
echo "   docker compose up -d --build — rebuild and restart"
echo "═══════════════════════════════════════════════════════"
