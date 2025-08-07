#!/bin/bash
# Test architecture detection for different platforms

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

echo "🏗️  Architecture Detection Test"
echo "==============================="
echo ""

# Show current system info
echo "🖥️  System Information:"
echo "   OS Type: $OSTYPE"
echo "   uname -m: $(uname -m)"
echo "   uname -p: $(uname -p 2>/dev/null || echo 'N/A')"

# Test Debian/Ubuntu architecture detection
if command -v dpkg &> /dev/null; then
    DPKG_ARCH=$(dpkg --print-architecture)
    echo "   dpkg --print-architecture: $DPKG_ARCH"
fi

echo ""

# Test architecture mapping for different tools
echo "📦 Architecture Mapping Tests:"
echo ""

# Get current architecture
CURRENT_ARCH=$(uname -m)
echo "🔍 Current architecture: $CURRENT_ARCH"
echo ""

# Test minikube architecture mapping
echo "🚢 minikube package selection:"
if command -v dpkg &> /dev/null; then
    DPKG_ARCH=$(dpkg --print-architecture)
    echo "   Debian/Ubuntu method (dpkg): $DPKG_ARCH"
    
    case $DPKG_ARCH in
        "amd64")
            echo "   → Would download: minikube_latest_amd64.deb"
            ;;
        "arm64")
            echo "   → Would download: minikube_latest_arm64.deb"
            ;;
        *)
            echo "   → Would fall back to generic: minikube-linux-$(uname -m)"
            ;;
    esac
fi

# Test generic method
echo "   Generic method (uname -m): $CURRENT_ARCH"
case $CURRENT_ARCH in
    "x86_64")
        MINIKUBE_ARCH="amd64"
        ;;
    "aarch64"|"arm64")
        MINIKUBE_ARCH="arm64"
        ;;
    "armv7l")
        MINIKUBE_ARCH="arm"
        ;;
    *)
        MINIKUBE_ARCH=$CURRENT_ARCH
        ;;
esac
echo "   → Would download: minikube-linux-$MINIKUBE_ARCH"

echo ""

# Test kubectl architecture mapping
echo "⚙️  kubectl binary selection:"
case $CURRENT_ARCH in
    "x86_64")
        KUBECTL_ARCH="amd64"
        ;;
    "aarch64"|"arm64")
        KUBECTL_ARCH="arm64"
        ;;
    "armv7l")
        KUBECTL_ARCH="arm"
        ;;
    *)
        KUBECTL_ARCH=$CURRENT_ARCH
        ;;
esac
echo "   → Would download: kubectl binary for linux/$KUBECTL_ARCH"

echo ""

# Test RPM architecture mapping for RHEL/CentOS/Fedora
echo "📦 RPM package selection:"
case $CURRENT_ARCH in
    "x86_64")
        RPM_ARCH="x86_64"
        ;;
    "aarch64")
        RPM_ARCH="aarch64"
        ;;
    *)
        RPM_ARCH=$CURRENT_ARCH
        ;;
esac
echo "   → Would download: minikube-latest.$RPM_ARCH.rpm"

echo ""

# Test actual URLs (without downloading)
echo "🌐 Testing URL availability (HEAD requests):"
echo ""

# Test minikube URLs
if command -v curl &> /dev/null; then
    echo "   Testing minikube URLs..."
    
    # Test Debian packages
    for arch in amd64 arm64; do
        url="https://storage.googleapis.com/minikube/releases/latest/minikube_latest_${arch}.deb"
        if curl -s -I "$url" | grep -q "200 OK"; then
            log_success "Available: minikube_latest_${arch}.deb"
        else
            log_warning "Not found: minikube_latest_${arch}.deb"
        fi
    done
    
    # Test generic binaries
    for arch in amd64 arm64 arm; do
        url="https://storage.googleapis.com/minikube/releases/latest/minikube-linux-${arch}"
        if curl -s -I "$url" | grep -q "200 OK"; then
            log_success "Available: minikube-linux-${arch}"
        else
            log_warning "Not found: minikube-linux-${arch}"
        fi
    done
    
    echo ""
    echo "   Testing kubectl URLs..."
    
    # Get latest Kubernetes version
    K8S_VERSION=$(curl -L -s https://dl.k8s.io/release/stable.txt 2>/dev/null || echo "v1.28.0")
    
    for arch in amd64 arm64 arm; do
        url="https://dl.k8s.io/release/${K8S_VERSION}/bin/linux/${arch}/kubectl"
        if curl -s -I "$url" | grep -q "200 OK"; then
            log_success "Available: kubectl for linux/${arch}"
        else
            log_warning "Not found: kubectl for linux/${arch}"
        fi
    done
else
    log_warning "curl not available, skipping URL tests"
fi

echo ""
echo "✅ Architecture detection test complete!"
echo ""
echo "💡 The deploy.sh script will now automatically:"
echo "   • Detect your system architecture"
echo "   • Download the correct packages/binaries"
echo "   • Fall back to generic methods if needed"
