#!/bin/bash
# Test Ubuntu detection and installation logic

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

echo "🧪 Testing Platform Detection Logic"
echo "=================================="
echo ""

# Show current OS
echo "🖥️  Current OS: $OSTYPE"

# Test OS detection logic
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macOS"
    log_info "Detected macOS system"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="Linux"
    log_info "Detected Linux system"
    
    # Test distribution detection
    if command -v apt-get &> /dev/null; then
        DISTRO="Ubuntu/Debian"
        log_success "Would use apt-get for package installation"
    elif command -v yum &> /dev/null; then
        DISTRO="RHEL/CentOS"
        log_success "Would use yum for package installation"
    elif command -v dnf &> /dev/null; then
        DISTRO="Fedora"
        log_success "Would use dnf for package installation"
    else
        DISTRO="Unknown"
        log_warning "Would fall back to generic installation methods"
    fi
    
    echo "   Distribution type: $DISTRO"
else
    OS="Unknown"
    log_warning "Unknown operating system detected"
fi

echo ""
echo "📦 Installation Method Detection:"

# Show what would be installed for each tool
tools=("docker" "kubectl" "helm" "minikube")

for tool in "${tools[@]}"; do
    echo ""
    echo "🔧 $tool installation method:"
    
    if command -v "$tool" &> /dev/null; then
        log_success "$tool is already installed"
        continue
    fi
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        case $tool in
            "docker")
                echo "   Would run: brew install --cask docker"
                ;;
            *)
                echo "   Would run: brew install $tool"
                ;;
        esac
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        case $tool in
            "docker")
                if command -v apt-get &> /dev/null; then
                    echo "   Would install Docker CE from official Docker repository"
                    echo "   Steps: Add GPG key → Add repository → apt-get install docker-ce"
                else
                    echo "   Would use: curl -fsSL https://get.docker.com | sh"
                fi
                ;;
            "kubectl")
                if command -v apt-get &> /dev/null; then
                    echo "   Would install from official Kubernetes repository"
                    echo "   Steps: Add GPG key → Add repository → apt-get install kubectl"
                else
                    echo "   Would download binary from dl.k8s.io"
                fi
                ;;
            "helm")
                if command -v apt-get &> /dev/null; then
                    echo "   Would install from official Helm repository"
                    echo "   Steps: Add GPG key → Add repository → apt-get install helm"
                elif command -v dnf &> /dev/null; then
                    echo "   Would run: dnf install helm"
                else
                    echo "   Would use official Helm installation script"
                fi
                ;;
            "minikube")
                if command -v apt-get &> /dev/null; then
                    echo "   Would install: minikube_latest_amd64.deb package"
                elif command -v yum &> /dev/null || command -v dnf &> /dev/null; then
                    echo "   Would install: minikube-latest.x86_64.rpm package"
                else
                    echo "   Would download binary from storage.googleapis.com"
                fi
                ;;
        esac
    fi
done

echo ""
echo "✅ Platform detection test complete!"
echo ""
echo "💡 The deploy.sh script will automatically handle installation for your platform"
