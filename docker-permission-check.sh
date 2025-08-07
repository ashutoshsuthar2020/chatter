#!/bin/bash
# Docker Permission Diagnostic Tool for Ubuntu

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

echo "🐳 Docker Permission Diagnostic Tool"
echo "===================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed"
    echo "Install Docker first with the deploy.sh script"
    exit 1
fi

log_success "Docker is installed: $(docker --version)"
echo ""

# Check Docker daemon status
log_info "Checking Docker daemon status..."
if sudo systemctl is-active docker &> /dev/null; then
    log_success "Docker daemon is running"
else
    log_error "Docker daemon is not running"
    echo "Start it with: sudo systemctl start docker"
    exit 1
fi

echo ""

# Test Docker access without sudo
log_info "Testing Docker access without sudo..."
if docker ps &> /dev/null; then
    log_success "Docker works without sudo - permissions are correct!"
    echo ""
    echo "Your Docker setup is working correctly for minikube."
    exit 0
else
    log_warning "Docker requires sudo - permission issue detected"
fi

echo ""

# Test Docker access with sudo
log_info "Testing Docker access with sudo..."
if sudo docker ps &> /dev/null; then
    log_success "Docker works with sudo - daemon is accessible"
else
    log_error "Docker doesn't work even with sudo - daemon issue"
    exit 1
fi

echo ""

# Check user groups
log_info "Checking user group membership..."
CURRENT_USER=$(whoami)
echo "Current user: $CURRENT_USER"

if groups | grep -q docker; then
    log_success "User is in docker group"
    log_warning "But permissions are not active in current session"
else
    log_warning "User is NOT in docker group"
fi

echo ""

# Show solutions
echo "🔧 Solutions (choose one):"
echo ""

echo "1. 🚪 Log out and back in (RECOMMENDED)"
echo "   - This activates docker group membership"
echo "   - Most reliable solution"
echo "   - Then re-run deploy.sh"

echo ""

echo "2. 🔄 Apply group in current session"
echo "   - Run: newgrp docker"
echo "   - Then re-run deploy.sh"
echo "   - Works for current terminal only"

echo ""

echo "3. 🏗️  Use alternative minikube driver"
echo "   - KVM2 (fastest): requires virtualization"
echo "   - VirtualBox (compatible): works on most systems"
echo "   - Podman (alternative): container-based like Docker"

echo ""

echo "4. 🔧 Manual group addition (if not in group)"
if ! groups | grep -q docker; then
    echo "   Run: sudo usermod -aG docker $CURRENT_USER"
    echo "   Then log out and back in"
else
    echo "   ✅ Already in group - just need to activate"
fi

echo ""

# Test alternative drivers
echo "🚗 Alternative Driver Availability:"
echo ""

# KVM2
if command -v virsh &> /dev/null; then
    log_success "KVM2: Available"
    if groups | grep -q libvirt; then
        echo "   Permissions: ✅ Ready"
    else
        echo "   Permissions: ⚠️  Need libvirt group"
    fi
else
    log_info "KVM2: Not installed"
    echo "   Install: sudo apt-get install qemu-kvm libvirt-daemon-system"
fi

# VirtualBox
if command -v VBoxManage &> /dev/null; then
    log_success "VirtualBox: Available"
    echo "   Status: ✅ Ready"
else
    log_info "VirtualBox: Not installed"
    echo "   Install: sudo apt-get install virtualbox"
fi

# Podman
if command -v podman &> /dev/null; then
    log_success "Podman: Available"
    echo "   Status: ✅ Ready"
else
    log_info "Podman: Not installed"
    echo "   Install: sudo apt-get install podman"
fi

echo ""
echo "💡 Recommendation:"
if groups | grep -q docker; then
    echo "   Log out and back in to activate docker group membership"
else
    echo "   1. Add to group: sudo usermod -aG docker $CURRENT_USER"
    echo "   2. Log out and back in"
    echo "   3. Re-run deploy.sh"
fi

echo ""
echo "If you can't log out/in, deploy.sh will offer to use alternative drivers."
