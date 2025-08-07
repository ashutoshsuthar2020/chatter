#!/bin/bash
# Test minikube driver detection and installation logic

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

echo "🚗 minikube Driver Detection Test"
echo "================================="
echo ""

# Show current system info
echo "🖥️  System Information:"
echo "   OS Type: $OSTYPE"
echo "   Architecture: $(uname -m)"

if command -v minikube &> /dev/null; then
    echo "   minikube Version: $(minikube version --short)"
    CURRENT_DRIVER=$(minikube config get driver 2>/dev/null || echo "auto")
    echo "   Current Driver: $CURRENT_DRIVER"
else
    echo "   minikube: Not installed"
fi

echo ""

# Test driver availability
echo "🔍 Driver Availability Check:"
echo ""

# Docker driver
if command -v docker &> /dev/null; then
    if docker ps &> /dev/null; then
        log_success "Docker: Available and running"
        echo "   Version: $(docker --version)"
    else
        log_warning "Docker: Installed but not running"
    fi
else
    log_error "Docker: Not installed"
fi

# Podman driver
if command -v podman &> /dev/null; then
    log_success "Podman: Available"
    echo "   Version: $(podman --version)"
else
    log_info "Podman: Not installed"
fi

# VirtualBox driver
if command -v VBoxManage &> /dev/null; then
    log_success "VirtualBox: Available"
    echo "   Version: $(VBoxManage --version | head -1)"
else
    log_info "VirtualBox: Not installed"
fi

# KVM2 driver
if command -v virsh &> /dev/null; then
    log_success "KVM2: Available"
    echo "   libvirt Version: $(virsh --version)"
else
    log_info "KVM2: Not installed"
fi

# docker-machine-driver-kvm2
if command -v docker-machine-driver-kvm2 &> /dev/null; then
    log_success "docker-machine-driver-kvm2: Available"
else
    log_info "docker-machine-driver-kvm2: Not installed"
fi

echo ""

# Show recommended installation order
echo "🎯 Driver Preference Order:"
echo ""

if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "   macOS Preferences:"
    echo "   1. Docker (primary)"
    echo "   2. HyperKit (fallback)"
    echo "   3. VirtualBox (compatibility)"
else
    echo "   Linux Preferences:"
    echo "   1. Docker (if available and running)"
    echo "   2. KVM2 (native Linux virtualization)"
    echo "   3. Podman (alternative container runtime)"
    echo "   4. VirtualBox (cross-platform)"
fi

echo ""

# Test what would be installed
echo "📦 Installation Simulation:"
echo ""

if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Detect Linux distribution
    if command -v apt-get &> /dev/null; then
        DISTRO="Ubuntu/Debian"
    elif command -v yum &> /dev/null; then
        DISTRO="RHEL/CentOS"
    elif command -v dnf &> /dev/null; then
        DISTRO="Fedora"
    else
        DISTRO="Unknown"
    fi
    
    echo "   Detected: $DISTRO"
    echo ""
    
    # Show what would be installed for missing drivers
    if ! command -v virsh &> /dev/null; then
        echo "   Would install KVM2:"
        if [[ "$DISTRO" == "Ubuntu/Debian" ]]; then
            echo "     sudo apt-get install -y qemu-kvm libvirt-daemon-system libvirt-clients bridge-utils"
        elif [[ "$DISTRO" == "RHEL/CentOS" ]] || [[ "$DISTRO" == "Fedora" ]]; then
            echo "     sudo dnf/yum install -y qemu-kvm libvirt virt-install bridge-utils"
        fi
    fi
    
    if ! command -v VBoxManage &> /dev/null && [[ "$DISTRO" == "Ubuntu/Debian" ]]; then
        echo "   Would install VirtualBox:"
        echo "     sudo apt-get install -y virtualbox virtualbox-ext-pack"
    fi
    
    if command -v virsh &> /dev/null && ! command -v docker-machine-driver-kvm2 &> /dev/null; then
        echo "   Would install docker-machine-driver-kvm2:"
        echo "     curl -LO https://storage.googleapis.com/minikube/releases/latest/docker-machine-driver-kvm2"
        echo "     sudo install docker-machine-driver-kvm2 /usr/local/bin/"
    fi
fi

echo ""

# Show minikube start command that would be used
echo "🚀 minikube Start Strategy:"
echo ""

if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "   macOS strategy:"
    if command -v docker &> /dev/null && docker ps &> /dev/null; then
        echo "     minikube start --driver=docker --cpus=2 --memory=4096 --disk-size=20g"
    else
        echo "     minikube start --driver=hyperkit --cpus=2 --memory=4096"
    fi
else
    echo "   Linux strategy (try in order):"
    DRIVERS_TO_TRY=("docker" "kvm2" "podman" "virtualbox")
    for driver in "${DRIVERS_TO_TRY[@]}"; do
        case $driver in
            "docker")
                if command -v docker &> /dev/null && docker ps &> /dev/null; then
                    log_success "     Would try: minikube start --driver=docker --cpus=2 --memory=4096"
                else
                    log_info "     Skip: docker (not available)"
                fi
                ;;
            "kvm2")
                if command -v virsh &> /dev/null; then
                    log_success "     Would try: minikube start --driver=kvm2 --cpus=2 --memory=4096"
                else
                    log_info "     Skip: kvm2 (not available)"
                fi
                ;;
            "podman")
                if command -v podman &> /dev/null; then
                    log_success "     Would try: minikube start --driver=podman --cpus=2 --memory=4096"
                else
                    log_info "     Skip: podman (not available)"
                fi
                ;;
            "virtualbox")
                if command -v VBoxManage &> /dev/null; then
                    log_success "     Would try: minikube start --driver=virtualbox --cpus=2 --memory=4096"
                else
                    log_info "     Skip: virtualbox (not available)"
                fi
                ;;
        esac
    done
fi

echo ""
echo "✅ Driver detection test complete!"
echo ""
echo "💡 The deploy.sh script will:"
echo "   • Install missing drivers automatically"
echo "   • Try drivers in optimal order"
echo "   • Configure resource allocation"
echo "   • Handle fallbacks gracefully"
