#!/bin/bash

# Chatter Server Kubernetes Deployment Script

set -e

echo "🚀 Deploying Chatter Server to Kubernetes..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl is not installed. Please install kubectl first."
    exit 1
fi

# Check if we can connect to Kubernetes cluster
if ! kubectl cluster-info &> /dev/null; then
    print_error "Cannot connect to Kubernetes cluster. Please check your kubectl configuration."
    exit 1
fi

print_status "Connected to Kubernetes cluster"

# Build Docker image
print_status "Building Docker image..."
cd ../server
docker build -t chatter-server:latest .
print_success "Docker image built successfully"

# If using a registry, push the image
# print_status "Pushing image to registry..."
# docker tag chatter-server:latest your-registry/chatter-server:latest
# docker push your-registry/chatter-server:latest
# print_success "Image pushed to registry"

cd ../k8s

# Apply Kubernetes manifests
print_status "Applying Kubernetes manifests..."

# Apply ConfigMap
kubectl apply -f configmap.yaml
print_success "ConfigMap applied"

# Apply Secrets (you need to update with your actual values)
print_warning "Please update secrets.yaml with your actual base64 encoded values before applying"
echo "Do you want to apply secrets.yaml? (y/n)"
read -r response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    kubectl apply -f secrets.yaml
    print_success "Secrets applied"
else
    print_warning "Skipping secrets. Remember to apply them manually."
fi

# Apply MongoDB (optional)
echo "Do you want to deploy MongoDB in Kubernetes? (y/n)"
read -r response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    kubectl apply -f mongodb.yaml
    print_success "MongoDB deployed"
    
    print_status "Waiting for MongoDB to be ready..."
    kubectl wait --for=condition=available --timeout=300s deployment/mongodb
    print_success "MongoDB is ready"
fi

# Apply Deployment
kubectl apply -f deployment.yaml
print_success "Deployment applied"

# Apply Services
kubectl apply -f service.yaml
print_success "Services applied"

# Apply HPA
kubectl apply -f hpa.yaml
print_success "HorizontalPodAutoscaler applied"

# Apply Ingress (optional)
echo "Do you want to apply Ingress? (y/n)"
read -r response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    print_warning "Please update ingress.yaml with your domain before applying"
    kubectl apply -f ingress.yaml
    print_success "Ingress applied"
fi

print_status "Waiting for deployment to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/chatter-server

print_success "🎉 Chatter Server deployed successfully!"

print_status "Deployment status:"
kubectl get deployments
kubectl get services
kubectl get pods

print_status "To check logs:"
echo "kubectl logs -f deployment/chatter-server"

print_status "To port-forward for local testing:"
echo "kubectl port-forward service/chatter-server-service 8000:8000"
