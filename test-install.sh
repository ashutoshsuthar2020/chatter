#!/bin/bash
# Test script to demonstrate the software installation function

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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

log_step() {
    echo -e "\n${BLUE}🔄 $1${NC}"
    echo "============================================"
}

# Test the software checking part of the install function
test_software_detection() {
    log_step "Testing Software Detection"
    
    echo "🖥️  Operating System: $OSTYPE"
    echo ""
    
    # Check each tool
    tools=("brew" "docker" "kubectl" "helm" "minikube")
    
    for tool in "${tools[@]}"; do
        if command -v "$tool" &> /dev/null; then
            case $tool in
                "brew")
                    version=$(brew --version | head -1)
                    ;;
                "docker")
                    version=$(docker --version)
                    ;;
                "kubectl")
                    version=$(kubectl version --client --short 2>/dev/null)
                    ;;
                "helm")
                    version=$(helm version --short 2>/dev/null)
                    ;;
                "minikube")
                    version=$(minikube version --short 2>/dev/null)
                    ;;
            esac
            log_success "$tool is installed: $version"
        else
            log_warning "$tool is NOT installed - would be installed by deploy.sh"
        fi
    done
    
    echo ""
    log_step "Docker Status Check"
    if docker ps &> /dev/null; then
        log_success "Docker is running"
        log_info "Docker containers: $(docker ps --format "table {{.Names}}\t{{.Status}}" | wc -l) running"
    else
        log_warning "Docker is not running - would need to be started"
    fi
    
    echo ""
    log_step "Minikube Status Check"
    if minikube status &>/dev/null; then
        log_success "Minikube is running"
        log_info "Minikube IP: $(minikube ip)"
    else
        log_warning "Minikube is not running - would be started by deploy.sh"
    fi
    
    echo ""
    log_info "The deploy.sh script would automatically install any missing tools!"
}

test_software_detection
