#!/bin/bash
# cleanup.sh - Comprehensive Chat App Cleanup Script
# This script undoes everything done by deploy.sh
# Updated: August 2025

set -e  # Exit on any error

# Configuration (matching deploy.sh)
NAMESPACE="chat-app"
HELM_RELEASE="chat-app"
CHART_PATH="./helm/chat-app"
SERVER_IMAGE="myrepo/chat-server:latest"
CLIENT_IMAGE="myrepo/chat-client:latest"

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

# Function to show current status
show_current_status() {
    log_step "Current Deployment Status"
    
    # Check if minikube is running
    if ! minikube status &>/dev/null; then
        log_warning "Minikube is not running"
        return
    fi
    
    # Check namespace
    if kubectl get namespace $NAMESPACE &>/dev/null; then
        log_info "Namespace '$NAMESPACE' exists"
        
        # Show Helm releases
        if helm list -n $NAMESPACE | grep -q $HELM_RELEASE; then
            log_info "Helm release '$HELM_RELEASE' found"
            helm list -n $NAMESPACE
        else
            log_info "No Helm releases found in namespace"
        fi
        
        # Show resources
        echo ""
        log_info "Current resources in namespace:"
        kubectl get all -n $NAMESPACE 2>/dev/null || log_info "No resources found"
        
    else
        log_info "Namespace '$NAMESPACE' does not exist"
    fi
    
    # Check Docker images
    echo ""
    log_info "Docker images:"
    docker images | grep -E "(myrepo/chat|$SERVER_IMAGE|$CLIENT_IMAGE)" || log_info "No chat app images found"
}

# Function to cleanup Kubernetes resources
cleanup_kubernetes() {
    log_step "Cleaning Up Kubernetes Resources"
    
    # Check if namespace exists
    if ! kubectl get namespace $NAMESPACE &>/dev/null; then
        log_info "Namespace '$NAMESPACE' does not exist, skipping Kubernetes cleanup"
        return
    fi
    
    # Uninstall Helm release
    if helm list -n $NAMESPACE | grep -q $HELM_RELEASE; then
        log_info "Uninstalling Helm release '$HELM_RELEASE'..."
        if helm uninstall $HELM_RELEASE -n $NAMESPACE; then
            log_success "Helm release uninstalled successfully"
        else
            log_warning "Failed to uninstall Helm release, continuing with manual cleanup"
        fi
    else
        log_info "No Helm release '$HELM_RELEASE' found"
    fi
    
    # Wait a moment for Helm cleanup to complete
    sleep 5
    
    # Force cleanup of any remaining resources
    log_info "Cleaning up any remaining resources..."
    
    # Delete deployments
    kubectl delete deployments --all -n $NAMESPACE --timeout=60s 2>/dev/null || true
    
    # Delete services
    kubectl delete services --all -n $NAMESPACE --timeout=60s 2>/dev/null || true
    
    # Delete configmaps (except system ones)
    kubectl delete configmaps --all -n $NAMESPACE --timeout=60s 2>/dev/null || true
    
    # Delete secrets (except system ones)
    kubectl delete secrets --all -n $NAMESPACE --timeout=60s 2>/dev/null || true
    
    # Delete HPA
    kubectl delete hpa --all -n $NAMESPACE --timeout=60s 2>/dev/null || true
    
    # Delete PDB
    kubectl delete pdb --all -n $NAMESPACE --timeout=60s 2>/dev/null || true
    
    # Delete network policies
    kubectl delete networkpolicies --all -n $NAMESPACE --timeout=60s 2>/dev/null || true
    
    # Delete any remaining pods (force if necessary)
    kubectl delete pods --all -n $NAMESPACE --force --grace-period=0 --timeout=60s 2>/dev/null || true
    
    log_success "Kubernetes resources cleaned up"
}

# Function to cleanup dependencies (Redis, MongoDB)
cleanup_dependencies() {
    log_step "Cleaning Up Dependencies"
    
    if ! kubectl get namespace $NAMESPACE &>/dev/null; then
        log_info "Namespace does not exist, skipping dependency cleanup"
        return
    fi
    
    # Clean up Redis
    log_info "Cleaning up Redis..."
    kubectl delete deployment redis -n $NAMESPACE --timeout=60s 2>/dev/null || log_info "Redis deployment not found"
    kubectl delete service redis-master -n $NAMESPACE --timeout=60s 2>/dev/null || log_info "Redis service not found"
    kubectl delete pvc --selector app=redis -n $NAMESPACE --timeout=60s 2>/dev/null || true
    
    # Clean up MongoDB
    log_info "Cleaning up MongoDB..."
    kubectl delete deployment mongodb -n $NAMESPACE --timeout=60s 2>/dev/null || log_info "MongoDB deployment not found"
    kubectl delete service mongodb -n $NAMESPACE --timeout=60s 2>/dev/null || log_info "MongoDB service not found"
    kubectl delete pvc --selector app=mongodb -n $NAMESPACE --timeout=60s 2>/dev/null || true
    
    log_success "Dependencies cleaned up"
}

# Function to cleanup namespace
cleanup_namespace() {
    log_step "Cleaning Up Namespace"
    
    if kubectl get namespace $NAMESPACE &>/dev/null; then
        log_info "Deleting namespace '$NAMESPACE'..."
        if kubectl delete namespace $NAMESPACE --timeout=120s; then
            log_success "Namespace deleted successfully"
        else
            log_warning "Failed to delete namespace cleanly, it may take time to fully clean up"
        fi
    else
        log_info "Namespace '$NAMESPACE' does not exist"
    fi
}

# Function to cleanup Docker images
cleanup_docker_images() {
    log_step "Cleaning Up Docker Images"
    
    # Check if images exist before trying to delete
    if docker images | grep -q "myrepo/chat-server"; then
        log_info "Removing chat-server Docker image..."
        docker rmi $SERVER_IMAGE 2>/dev/null || log_warning "Failed to remove server image (may be in use)"
    else
        log_info "Chat-server image not found"
    fi
    
    if docker images | grep -q "myrepo/chat-client"; then
        log_info "Removing chat-client Docker image..."
        docker rmi $CLIENT_IMAGE 2>/dev/null || log_warning "Failed to remove client image (may be in use)"
    else
        log_info "Chat-client image not found"
    fi
    
    # Clean up minikube images
    if minikube status &>/dev/null; then
        log_info "Removing images from minikube..."
        minikube image rm docker.io/$SERVER_IMAGE 2>/dev/null || true
        minikube image rm docker.io/$CLIENT_IMAGE 2>/dev/null || true
    fi
    
    log_success "Docker images cleaned up"
}

# Function to cleanup build artifacts
cleanup_build_artifacts() {
    log_step "Cleaning Up Build Artifacts"
    
    # Remove deployment logs
    if [ -f "deployment.log" ]; then
        log_info "Removing deployment.log..."
        rm -f deployment.log
    fi
    
    # Remove any temporary files
    log_info "Removing temporary files..."
    rm -f /tmp/chat-app-* 2>/dev/null || true
    
    log_success "Build artifacts cleaned up"
}

# Function to cleanup Docker system (optional)
cleanup_docker_system() {
    log_step "Docker System Cleanup (Optional)"
    
    read -p "🗑️  Do you want to clean up unused Docker resources? This will remove unused images, containers, networks, and build cache. (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Running Docker system cleanup..."
        
        # Clean up containers
        docker container prune -f 2>/dev/null || true
        
        # Clean up images
        docker image prune -f 2>/dev/null || true
        
        # Clean up networks
        docker network prune -f 2>/dev/null || true
        
        # Clean up build cache
        docker builder prune -f 2>/dev/null || true
        
        # Show space freed
        log_success "Docker system cleanup completed"
        log_info "Current Docker disk usage:"
        docker system df
    else
        log_info "Skipping Docker system cleanup"
    fi
}

# Function to show final status
show_final_status() {
    log_step "Final Status"
    
    log_success "Cleanup completed successfully!"
    echo ""
    
    # Check what's left
    log_info "Remaining resources:"
    
    # Check namespace
    if kubectl get namespace $NAMESPACE &>/dev/null; then
        log_warning "Namespace '$NAMESPACE' still exists (may be terminating)"
    else
        log_success "Namespace '$NAMESPACE' removed"
    fi
    
    # Check Docker images
    if docker images | grep -q "myrepo/chat"; then
        log_warning "Some chat app Docker images still exist:"
        docker images | grep "myrepo/chat" || true
    else
        log_success "All chat app Docker images removed"
    fi
    
    # Check minikube status
    if minikube status &>/dev/null; then
        log_info "Minikube is still running (as expected)"
    else
        log_info "Minikube is not running"
    fi
    
    echo ""
    log_info "Your environment is now clean and ready for a fresh deployment!"
    log_info "To deploy again, run: ./deploy.sh"
}

# Function to handle cleanup with confirmation
cleanup_with_confirmation() {
    echo -e "${BLUE}🧹 Chat Application Cleanup Tool${NC}"
    echo "================================="
    echo ""
    
    # Show current status first
    show_current_status
    
    echo ""
    read -p "🗑️  Do you want to proceed with cleanup? This will remove ALL chat app resources. (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Cleanup cancelled by user"
        exit 0
    fi
    
    log_info "Starting cleanup process..."
}

# Main cleanup function
main_cleanup() {
    cleanup_kubernetes
    cleanup_dependencies
    cleanup_namespace
    cleanup_docker_images
    cleanup_build_artifacts
    cleanup_docker_system
    show_final_status
}

# Script execution options
case "${1:-}" in
    --force|-f)
        log_warning "Running cleanup in FORCE mode (no confirmation)"
        main_cleanup
        ;;
    --status|-s)
        show_current_status
        ;;
    --help|-h)
        echo "Chat App Cleanup Script"
        echo ""
        echo "Usage: $0 [OPTION]"
        echo ""
        echo "Options:"
        echo "  (no args)    Interactive cleanup with confirmation"
        echo "  -f, --force  Force cleanup without confirmation"
        echo "  -s, --status Show current deployment status only"
        echo "  -h, --help   Show this help message"
        echo ""
        echo "This script will remove:"
        echo "  • Helm releases"
        echo "  • Kubernetes resources in '$NAMESPACE' namespace"
        echo "  • Docker images ($SERVER_IMAGE, $CLIENT_IMAGE)"
        echo "  • Build artifacts and logs"
        echo "  • Optionally: unused Docker system resources"
        ;;
    *)
        cleanup_with_confirmation
        main_cleanup
        ;;
esac
