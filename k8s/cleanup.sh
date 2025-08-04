#!/bin/bash

# Chatter Server Kubernetes Cleanup Script

set -e

echo "🧹 Cleaning up Chatter Server from Kubernetes..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Warning
print_warning "This will delete all Chatter Server resources from Kubernetes!"
echo "Are you sure you want to continue? (y/n)"
read -r response

if [[ ! "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo "Cleanup cancelled."
    exit 0
fi

print_status "Deleting Kubernetes resources..."

# Delete in reverse order
kubectl delete -f ingress.yaml --ignore-not-found=true
kubectl delete -f hpa.yaml --ignore-not-found=true
kubectl delete -f service.yaml --ignore-not-found=true
kubectl delete -f deployment.yaml --ignore-not-found=true
kubectl delete -f mongodb.yaml --ignore-not-found=true
kubectl delete -f secrets.yaml --ignore-not-found=true
kubectl delete -f configmap.yaml --ignore-not-found=true

print_success "✅ All resources deleted successfully!"

print_status "Remaining resources:"
kubectl get all -l app=chatter-server
kubectl get all -l app=mongodb
