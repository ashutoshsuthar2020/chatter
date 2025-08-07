#!/bin/bash
# deploy.sh - Comprehensive Chat App Deployment Script
# Updated: August 2025

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="chat-app"
HELM_RELEASE="chat-app"
CHART_PATH="./helm/chat-app"
SERVER_IMAGE="myrepo/chat-server:latest"
CLIENT_IMAGE="myrepo/chat-client:latest"

# Function to install software if not present
install_software() {
    log_step "Checking and Installing Required Software"
    
    # Detect OS and setup package manager
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macOS"
        # Check if Homebrew is installed (for macOS)
        if ! command -v brew &> /dev/null; then
            log_warning "Homebrew not found. Installing Homebrew..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            # Add Homebrew to PATH for this session
            echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
            eval "$(/opt/homebrew/bin/brew shellenv)"
            log_success "Homebrew installed successfully"
        else
            log_success "Homebrew is already installed"
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="Linux"
        # Detect Linux distribution
        if command -v apt-get &> /dev/null; then
            DISTRO="Ubuntu/Debian"
            log_info "Detected Ubuntu/Debian system"
            # Update package list
            log_info "Updating package list..."
            sudo apt-get update -qq
        elif command -v yum &> /dev/null; then
            DISTRO="RHEL/CentOS"
            log_info "Detected RHEL/CentOS system"
        elif command -v dnf &> /dev/null; then
            DISTRO="Fedora"
            log_info "Detected Fedora system"
        else
            DISTRO="Unknown"
            log_warning "Unknown Linux distribution, will attempt generic installation"
        fi
    else
        OS="Unknown"
        log_warning "Unknown operating system: $OSTYPE"
    fi
    
    log_info "Operating System: $OS"
    if [[ "$OS" == "Linux" ]]; then
        log_info "Distribution: $DISTRO"
    fi
    
    # Check and install Docker
    if ! command -v docker &> /dev/null; then
        log_warning "Docker not found. Installing Docker..."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            log_info "Installing Docker Desktop for macOS..."
            brew install --cask docker
            log_warning "Please start Docker Desktop manually and then re-run this script"
            log_info "You can start Docker Desktop from Applications or run: open -a Docker"
            exit 1
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            if [[ "$DISTRO" == "Ubuntu/Debian" ]]; then
                log_info "Installing Docker for Ubuntu/Debian..."
                # Install prerequisites
                sudo apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release
                
                # Add Docker's official GPG key
                sudo mkdir -p /etc/apt/keyrings
                curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
                
                # Add Docker repository
                echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
                
                # Update and install Docker
                sudo apt-get update
                sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
                
                # Add user to docker group
                sudo usermod -aG docker $USER
                
                # Start and enable Docker service
                sudo systemctl start docker
                sudo systemctl enable docker
                
                log_success "Docker installed successfully"
                log_warning "Please log out and back in for group permissions, or run: newgrp docker"
            else
                log_info "Installing Docker using generic script..."
                curl -fsSL https://get.docker.com -o get-docker.sh
                sudo sh get-docker.sh
                sudo usermod -aG docker $USER
                log_warning "Please log out and back in, then re-run this script"
                exit 1
            fi
        fi
    else
        log_success "Docker is already installed"
    fi
    
    # Check and install kubectl
    if ! command -v kubectl &> /dev/null; then
        log_warning "kubectl not found. Installing kubectl..."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            brew install kubectl
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            if [[ "$DISTRO" == "Ubuntu/Debian" ]]; then
                log_info "Installing kubectl for Ubuntu/Debian..."
                # Add Kubernetes GPG key
                sudo mkdir -p /etc/apt/keyrings
                curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.28/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
                
                # Add Kubernetes repository
                echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.28/deb/ /' | sudo tee /etc/apt/sources.list.d/kubernetes.list
                
                # Update and install kubectl
                sudo apt-get update
                sudo apt-get install -y kubectl
            else
                # Generic Linux installation
                log_info "Installing kubectl (generic Linux)..."
                curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
                sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
                rm kubectl
            fi
        fi
        log_success "kubectl installed successfully"
    else
        log_success "kubectl is already installed"
    fi
    
    # Check and install Helm
    if ! command -v helm &> /dev/null; then
        log_warning "Helm not found. Installing Helm..."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            brew install helm
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            if [[ "$DISTRO" == "Ubuntu/Debian" ]]; then
                log_info "Installing Helm for Ubuntu/Debian..."
                # Add Helm GPG key
                curl https://baltocdn.com/helm/signing.asc | gpg --dearmor | sudo tee /usr/share/keyrings/helm.gpg > /dev/null
                
                # Add Helm repository
                echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/helm.gpg] https://baltocdn.com/helm/stable/debian/ all main" | sudo tee /etc/apt/sources.list.d/helm-stable-debian.list
                
                # Update and install Helm
                sudo apt-get update
                sudo apt-get install -y helm
            elif [[ "$DISTRO" == "RHEL/CentOS" ]]; then
                log_info "Installing Helm for RHEL/CentOS..."
                curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
                chmod 700 get_helm.sh
                ./get_helm.sh
                rm get_helm.sh
            elif [[ "$DISTRO" == "Fedora" ]]; then
                log_info "Installing Helm for Fedora..."
                sudo dnf install -y helm
            else
                # Generic installation using script
                log_info "Installing Helm (generic method)..."
                curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
                chmod 700 get_helm.sh
                ./get_helm.sh
                rm get_helm.sh
            fi
        fi
        log_success "Helm installed successfully"
    else
        log_success "Helm is already installed"
    fi
    
    # Check and install minikube
    if ! command -v minikube &> /dev/null; then
        log_warning "minikube not found. Installing minikube..."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            brew install minikube
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            if [[ "$DISTRO" == "Ubuntu/Debian" ]]; then
                log_info "Installing minikube for Ubuntu/Debian..."
                # Download and install minikube
                curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube_latest_amd64.deb
                sudo dpkg -i minikube_latest_amd64.deb
                rm minikube_latest_amd64.deb
            elif [[ "$DISTRO" == "RHEL/CentOS" ]]; then
                log_info "Installing minikube for RHEL/CentOS..."
                curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-latest.x86_64.rpm
                sudo rpm -Uvh minikube-latest.x86_64.rpm
                rm minikube-latest.x86_64.rpm
            elif [[ "$DISTRO" == "Fedora" ]]; then
                log_info "Installing minikube for Fedora..."
                curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-latest.x86_64.rpm
                sudo rpm -Uvh minikube-latest.x86_64.rpm
                rm minikube-latest.x86_64.rpm
            else
                # Generic installation
                log_info "Installing minikube (generic method)..."
                curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
                sudo install minikube-linux-amd64 /usr/local/bin/minikube
                rm minikube-linux-amd64
            fi
        fi
        log_success "minikube installed successfully"
        
        # Start minikube if not running
        log_info "Starting minikube..."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            minikube start --driver=docker
        else
            # For Linux, check if we should use docker or podman
            if command -v docker &> /dev/null && docker ps &> /dev/null; then
                minikube start --driver=docker
            elif command -v podman &> /dev/null; then
                minikube start --driver=podman
            else
                # Fallback to VirtualBox or none driver
                minikube start
            fi
        fi
        log_success "minikube started successfully"
    else
        log_success "minikube is already installed"
    fi
    
    # Verify Docker is running
    if ! docker ps &> /dev/null; then
        log_error "Docker is installed but not running. Please start Docker and try again."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            log_info "On macOS, you can start Docker by running: open -a Docker"
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            log_info "On Linux, you can start Docker by running:"
            log_info "  sudo systemctl start docker"
            log_info "  sudo systemctl enable docker"
            log_info "If you just installed Docker, you may need to:"
            log_info "  1. Log out and back in (or run: newgrp docker)"
            log_info "  2. Make sure your user is in the docker group: sudo usermod -aG docker \$USER"
        fi
        exit 1
    fi
    
    # Additional check for Linux: ensure user is in docker group
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if ! groups | grep -q docker; then
            log_warning "User not in docker group. Adding to docker group..."
            sudo usermod -aG docker $USER
            log_warning "Please log out and back in for group changes to take effect"
            log_info "Or run: newgrp docker"
        fi
    fi
    
    log_success "All required software is installed and ready"
    
    # Show installed versions
    log_info "Installed software versions:"
    if [[ "$OSTYPE" == "darwin"* ]] && command -v brew &> /dev/null; then
        echo "  Homebrew: $(brew --version | head -1)"
    fi
    echo "  Docker: $(docker --version)"
    echo "  kubectl: $(kubectl version --client --short 2>/dev/null)"
    echo "  Helm: $(helm version --short 2>/dev/null)"
    echo "  minikube: $(minikube version --short 2>/dev/null)"
}

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

# Function to check prerequisites
check_prerequisites() {
    log_step "Verifying Prerequisites"
    
    # Check minikube
    if ! minikube status &>/dev/null; then
        log_warning "Minikube is not running. Attempting to start..."
        if minikube start --driver=docker; then
            log_success "Minikube started successfully"
        else
            log_error "Failed to start minikube. Please check your Docker installation"
            exit 1
        fi
    else
        log_success "Minikube is running ($(minikube version --short))"
    fi
    
    # Check Docker
    if ! docker --version &>/dev/null; then
        log_error "Docker is not available. Please ensure Docker is installed and running"
        exit 1
    fi
    DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | sed 's/,//')
    log_success "Docker is available (v$DOCKER_VERSION)"
    
    # Verify Docker is actually running
    if ! docker ps &>/dev/null; then
        log_error "Docker is installed but not running. Please start Docker and try again"
        exit 1
    fi
    
    # Check kubectl
    if ! kubectl config current-context &>/dev/null; then
        log_error "kubectl is not configured or cannot connect to cluster"
        exit 1
    fi
    KUBECTL_VERSION=$(kubectl version --client --short | cut -d' ' -f3)
    log_success "kubectl is configured ($KUBECTL_VERSION)"
    
    # Check Helm
    if ! helm version &>/dev/null; then
        log_error "Helm is not available"
        exit 1
    fi
    HELM_VERSION=$(helm version --short)
    log_success "Helm is available ($HELM_VERSION)"
    
    # Check minikube IP accessibility
    MINIKUBE_IP=$(minikube ip)
    log_info "Minikube cluster IP: $MINIKUBE_IP"
}

# Function to build Docker images
build_images() {
    log_step "Building Docker Images"
    
    # Build server image
    log_info "Building server image..."
    cd server
    if docker build -t myrepo/chat-server:latest . &>../build-server.log; then
        log_success "Server image built successfully"
        log_info "Server image size: $(docker images myrepo/chat-server:latest --format "{{.Size}}")"
    else
        log_error "Server build failed! Check build-server.log"
        cat ../build-server.log
        exit 1
    fi
    
    # Build client image
    log_info "Building client image..."
    cd ../client
    if docker build -t myrepo/chat-client:latest . &>../build-client.log; then
        log_success "Client image built successfully"
        log_info "Client image size: $(docker images myrepo/chat-client:latest --format "{{.Size}}")"
    else
        log_error "Client build failed! Check build-client.log"
        cat ../build-client.log
        exit 1
    fi
    
    cd ..
    
    # Load images into minikube
    log_info "Loading images into minikube..."
    minikube image load myrepo/chat-server:latest
    minikube image load myrepo/chat-client:latest
    
    # Verify images in minikube
    if minikube image ls | grep -q myrepo; then
        log_success "Images loaded into minikube successfully"
    else
        log_error "Failed to load images into minikube"
        exit 1
    fi
}

# Function to deploy dependencies
deploy_dependencies() {
    log_step "Deploying Dependencies (Redis & MongoDB)"
    
    # Create namespace
    kubectl create namespace chat-app --dry-run=client -o yaml | kubectl apply -f -
    log_success "Namespace chat-app ready"
    
    # Deploy Redis
    log_info "Deploying Redis..."
    kubectl create deployment redis --image=redis:7-alpine --namespace=chat-app 2>/dev/null || log_warning "Redis deployment already exists"
    kubectl expose deployment redis --port=6379 --target-port=6379 --name=redis-master --namespace=chat-app 2>/dev/null || log_warning "Redis service already exists"
    
    # Deploy MongoDB
    log_info "Deploying MongoDB..."
    kubectl create deployment mongodb --image=mongo:7 --namespace=chat-app 2>/dev/null || log_warning "MongoDB deployment already exists"
    kubectl expose deployment mongodb --port=27017 --target-port=27017 --namespace=chat-app 2>/dev/null || log_warning "MongoDB service already exists"
    
    # Wait for dependencies
    log_info "Waiting for dependencies to be ready..."
    if kubectl wait --for=condition=available --timeout=300s deployment/redis -n chat-app; then
        log_success "Redis is ready"
    else
        log_error "Redis failed to become ready"
        kubectl logs -n chat-app -l app=redis --tail=20
        exit 1
    fi
    
    if kubectl wait --for=condition=available --timeout=300s deployment/mongodb -n chat-app; then
        log_success "MongoDB is ready"
    else
        log_error "MongoDB failed to become ready"
        kubectl logs -n chat-app -l app=mongodb --tail=20
        exit 1
    fi
    
    # Verify dependencies
    log_info "Verifying dependencies..."
    REDIS_PODS=$(kubectl get pods -n chat-app -l app=redis --no-headers | grep Running | wc -l)
    MONGODB_PODS=$(kubectl get pods -n chat-app -l app=mongodb --no-headers | grep Running | wc -l)
    
    if [ "$REDIS_PODS" -gt 0 ] && [ "$MONGODB_PODS" -gt 0 ]; then
        log_success "All dependencies are running"
    else
        log_error "Dependencies not ready. Redis: $REDIS_PODS, MongoDB: $MONGODB_PODS"
        exit 1
    fi
}

# Function to deploy chat application
deploy_chat_app() {
    log_step "Deploying Chat Application"
    
    # Get minikube IP
    MINIKUBE_IP=$(minikube ip)
    log_info "Minikube IP: $MINIKUBE_IP"
    
    # Check if deployment exists
    if helm list -n $NAMESPACE | grep -q $HELM_RELEASE; then
        log_info "Upgrading existing deployment..."
        HELM_ACTION="upgrade"
    else
        log_info "Installing new deployment..."
        HELM_ACTION="install"
    fi
    
    # Deploy with Helm and NodePort configuration
    if helm $HELM_ACTION $HELM_RELEASE $CHART_PATH \
        --namespace $NAMESPACE \
        --create-namespace \
        --set server.service.type=NodePort \
        --set client.service.type=NodePort \
        --set server.image.repository=myrepo/chat-server \
        --set server.image.tag=latest \
        --set client.image.repository=myrepo/chat-client \
        --set client.image.tag=latest \
        --timeout 10m \
        --wait 2>&1 | tee deployment.log; then
        log_success "Helm deployment successful"
    else
        log_error "Helm deployment failed! Check deployment.log"
        cat deployment.log
        exit 1
    fi
}

# Function to configure external access
configure_external_access() {
    log_step "Configuring External Access"
    
    # Wait for NodePort assignment
    log_info "Waiting for NodePort assignment..."
    sleep 10
    
    # Get NodePorts
    CLIENT_NODEPORT=$(kubectl get service chat-app-client -n $NAMESPACE -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo "")
    SERVER_NODEPORT=$(kubectl get service chat-app-server -n $NAMESPACE -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo "")
    MINIKUBE_IP=$(minikube ip)
    
    if [ -n "$CLIENT_NODEPORT" ] && [ -n "$SERVER_NODEPORT" ]; then
        log_success "Service URLs configured:"
        log_info "Client UI: http://$MINIKUBE_IP:$CLIENT_NODEPORT"
        log_info "Server API: http://$MINIKUBE_IP:$SERVER_NODEPORT"
        
        # Update deployment with correct API URL
        log_info "Updating API URL in deployment..."
        if helm upgrade $HELM_RELEASE $CHART_PATH \
            --namespace $NAMESPACE \
            --set server.service.type=NodePort \
            --set client.service.type=NodePort \
            --set global.reactAppApiUrl="http://$MINIKUBE_IP:$SERVER_NODEPORT" \
            --timeout 5m \
            --reuse-values; then
            log_success "API URL updated successfully"
        else
            log_warning "Failed to update API URL, but deployment may still work"
        fi
    else
        log_warning "Could not retrieve NodePort assignments. Services may not be ready yet."
    fi
}

# Function to perform health checks
perform_health_checks() {
    log_step "Performing Health Checks"
    
    # Function to check pod health
    check_pod_health() {
        local component=$1
        log_info "Checking $component pods..."
        
        # Get pod status
        kubectl get pods -n chat-app -l app.kubernetes.io/component=$component --no-headers
        
        # Check ready pods
        READY_PODS=$(kubectl get pods -n chat-app -l app.kubernetes.io/component=$component --no-headers | awk '{print $2}' | grep -c "1/1" || echo "0")
        TOTAL_PODS=$(kubectl get pods -n chat-app -l app.kubernetes.io/component=$component --no-headers | wc -l)
        
        if [ "$READY_PODS" -gt 0 ]; then
            log_success "$component: $READY_PODS/$TOTAL_PODS pods ready"
            return 0
        else
            log_error "$component: No pods ready ($READY_PODS/$TOTAL_PODS)"
            return 1
        fi
    }
    
    # Check server health
    if check_pod_health "server"; then
        log_info "Server logs (last 5 lines):"
        kubectl logs -n chat-app -l app.kubernetes.io/component=server --tail=5 | sed 's/^/  /'
    else
        log_warning "Server issues detected. Recent logs:"
        kubectl logs -n chat-app -l app.kubernetes.io/component=server --tail=10 | sed 's/^/  /'
    fi
    
    # Check client health
    if check_pod_health "client"; then
        log_info "Client logs (last 5 lines):"
        kubectl logs -n chat-app -l app.kubernetes.io/component=client --tail=5 | sed 's/^/  /'
    else
        log_warning "Client issues detected. Recent logs:"
        kubectl logs -n chat-app -l app.kubernetes.io/component=client --tail=10 | sed 's/^/  /'
    fi
    
    # Test connectivity
    log_info "Testing connectivity..."
    CLIENT_NODEPORT=$(kubectl get service chat-app-client -n chat-app -o jsonpath='{.spec.ports[0].nodePort}')
    SERVER_NODEPORT=$(kubectl get service chat-app-server -n chat-app -o jsonpath='{.spec.ports[0].nodePort}')
    MINIKUBE_IP=$(minikube ip)
    
    # Test server health endpoint
    if curl -s -m 10 "http://$MINIKUBE_IP:$SERVER_NODEPORT/health" &>/dev/null; then
        log_success "Server health endpoint accessible"
    else
        log_warning "Server health endpoint not accessible"
    fi
    
    # Test client accessibility
    if curl -s -m 10 -I "http://$MINIKUBE_IP:$CLIENT_NODEPORT/" &>/dev/null; then
        log_success "Client UI accessible"
    else
        log_warning "Client UI not accessible"
    fi
}

# Function to show final status
show_final_status() {
    log_step "Deployment Summary"
    
    MINIKUBE_IP=$(minikube ip)
    CLIENT_NODEPORT=$(kubectl get service chat-app-client -n chat-app -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo "N/A")
    SERVER_NODEPORT=$(kubectl get service chat-app-server -n chat-app -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo "N/A")
    
    echo "🎉 Chat Application Deployment Complete!"
    echo ""
    echo "📱 Access URLs:"
    echo "   Client UI:  http://$MINIKUBE_IP:$CLIENT_NODEPORT"
    echo "   Server API: http://$MINIKUBE_IP:$SERVER_NODEPORT"
    echo ""
    echo "🔧 Management Commands:"
    echo "   View pods:      kubectl get pods -n chat-app"
    echo "   View logs:      kubectl logs -n chat-app -l app.kubernetes.io/component=server -f"
    echo "   Scale server:   kubectl scale deployment chat-app-server --replicas=5 -n chat-app"
    echo "   Uninstall:      helm uninstall chat-app -n chat-app"
    echo ""
    
    # Quick status check
    echo "📊 Current Status:"
    kubectl get pods -n chat-app --no-headers | awk '{print "   " $1 ": " $3}' 
    echo ""
    
    # Open browser suggestion
    if [ "$CLIENT_NODEPORT" != "N/A" ]; then
        echo "🌐 Open in browser: http://$MINIKUBE_IP:$CLIENT_NODEPORT"
    fi
}

# Function to diagnose issues
diagnose_issues() {
    log_step "Diagnostic Information"
    
    echo "🩺 Quick Diagnostics:"
    echo ""
    
    echo "1. Pod Status:"
    kubectl get pods -n chat-app -o wide
    echo ""
    
    echo "2. Service Information:"
    kubectl get services -n chat-app
    echo ""
    
    echo "3. Recent Events (last 5):"
    kubectl get events -n chat-app --sort-by='.lastTimestamp' | tail -5
    echo ""
    
    echo "4. Resource Usage:"
    kubectl top pods -n chat-app 2>/dev/null || echo "   Metrics not available"
    echo ""
    
    # Offer to collect detailed logs
    read -p "📋 Collect detailed logs? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        collect_detailed_logs
    fi
}

# Function to collect detailed logs
collect_detailed_logs() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local log_dir="logs_$timestamp"
    mkdir -p "$log_dir"
    
    log_info "Collecting detailed logs to $log_dir/"
    
    # Application logs
    kubectl logs -n chat-app -l app.kubernetes.io/component=server --tail=100 > "$log_dir/server.log" 2>&1
    kubectl logs -n chat-app -l app.kubernetes.io/component=client --tail=100 > "$log_dir/client.log" 2>&1
    
    # Infrastructure logs
    kubectl get events -n chat-app --sort-by='.lastTimestamp' > "$log_dir/events.log"
    kubectl get all -n chat-app -o wide > "$log_dir/resources.log"
    kubectl describe pods -n chat-app > "$log_dir/pod-details.log"
    
    # Configuration
    kubectl get configmap chat-app-config -n chat-app -o yaml > "$log_dir/configmap.yaml" 2>&1
    helm get values chat-app -n chat-app > "$log_dir/helm-values.yaml" 2>&1
    
    log_success "Logs collected in $log_dir/"
}

# Main execution
main() {
    echo "🚀 Chat Application Kubernetes Deployment"
    echo "========================================="
    echo ""
    
    # Install required software if not present
    install_software
    
    # Run all deployment phases
    check_prerequisites
    build_images
    deploy_dependencies
    deploy_chat_app
    configure_external_access
    perform_health_checks
    show_final_status
    
    # Offer diagnostics if there were any warnings
    if grep -q "⚠️" deployment.log 2>/dev/null || kubectl get pods -n chat-app --no-headers | grep -v Running &>/dev/null; then
        echo ""
        log_warning "Some issues detected. Run diagnostics?"
        read -p "🔍 Run diagnostics? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            diagnose_issues
        fi
    fi
    
    echo ""
    log_success "Deployment script completed!"
}

# Run main function
main "$@"
