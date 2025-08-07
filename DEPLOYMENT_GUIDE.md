# Chat App Kubernetes Deployment Guide

## 🎯 Overview

This guide provides complete instructions for deploying the Chat Application to Kubernetes using Helm charts. The application is production-ready with enterprise features including horizontal scaling, health monitoring, and security policies.

## 📋 Prerequisites

- **Kubernetes Cluster**: Docker Desktop, minikube, kind, or cloud provider (GKE, EKS, AKS)
- **Helm 3.0+**: Package manager for Kubernetes
- **kubectl**: Kubernetes command-line tool
- **Docker**: For building and managing container images

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Ingress                              │
│              (nginx with TLS termination)                   │
└─────────────────┬───────────────────────────┬───────────────┘
                  │                           │
    ┌─────────────▼──────────────┐   ┌────────▼─────────────────┐
    │     Client Service          │   │    Server Service        │
    │   (React Frontend)          │   │   (Node.js Backend)      │
    │   • Port 80                 │   │   • Port 8000            │
    │   • 2-10 replicas (HPA)     │   │   • 3-20 replicas (HPA)  │
    └─────────────┬──────────────┘   └────────┬─────────────────┘
                  │                           │
    ┌─────────────▼──────────────┐   ┌────────▼─────────────────┐
    │    Client Pods              │   │    Server Pods           │
    │   nginx:alpine              │   │   node:18-alpine         │
    │   + built React app         │   │   + Express + Socket.io  │
    └─────────────────────────────┘   └──────┬───────────────────┘
                                             │
                           ┌─────────────────▼─────────────────┐
                           │         External Services         │
                           │  ┌─────────────┐ ┌─────────────┐  │
                           │  │    Redis    │ │   MongoDB   │  │
                           │  │ (Messages)  │ │   (Data)    │  │
                           │  └─────────────┘ └─────────────┘  │
                           └───────────────────────────────────┘
```

## 🔧 Configuration Summary

### Images Built
- **Server**: `myrepo/chat-server:latest` (279MB)
- **Client**: `myrepo/chat-client:latest` (84.5MB)

### Kubernetes Resources
- **Deployments**: Server and Client with rolling updates
- **Services**: ClusterIP for internal communication
- **Ingress**: nginx with TLS, WebSocket support, CORS
- **HPA**: Auto-scaling based on CPU/Memory
- **PDB**: High availability during updates
- **NetworkPolicy**: Security isolation
- **ConfigMaps/Secrets**: Configuration management

## 🚀 Quick Deployment

### 1. Start Kubernetes Cluster

Choose one option:

**Docker Desktop**:
```bash
# Enable Kubernetes in Docker Desktop settings
# Apply & Restart
```

**minikube**:
```bash
brew install minikube
minikube start --memory 4096 --cpus 2
```

**kind**:
```bash
brew install kind
kind create cluster --config - <<EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  kubeadmConfigPatches:
  - |
    kind: InitConfiguration
    nodeRegistration:
      kubeletExtraArgs:
        node-labels: "ingress-ready=true"
  extraPortMappings:
  - containerPort: 80
    hostPort: 80
    protocol: TCP
  - containerPort: 443
    hostPort: 443
    protocol: TCP
EOF
```

### 2. Deploy the Application

```bash
# Create namespace
kubectl create namespace chat-app

# Deploy with embedded Redis and MongoDB
cd helm/chat-app
helm install chat-app . -n chat-app \
  --set redis.enabled=true \
  --set mongodb.enabled=true

# Or deploy with external databases
helm install chat-app . -n chat-app \
  --set redis.enabled=false \
  --set mongodb.enabled=false \
  --set externalRedis.host=your-redis-host \
  --set externalMongodb.host=your-mongo-host
```

### 3. Verify Deployment

```bash
# Check pod status
kubectl get pods -n chat-app

# Check services
kubectl get services -n chat-app

# Check ingress
kubectl get ingress -n chat-app

# Check HPA
kubectl get hpa -n chat-app
```

## 📊 Production Deployment

### 1. Custom Values File

Create `production-values.yaml`:

```yaml
# Production configuration
global:
  imageRegistry: "your-registry.com"
  
server:
  replicaCount: 5
  image:
    tag: "v1.0.0"
    pullPolicy: "IfNotPresent"
  autoscaling:
    enabled: true
    minReplicas: 5
    maxReplicas: 50
  resources:
    requests:
      cpu: 200m
      memory: 256Mi
    limits:
      cpu: 500m
      memory: 512Mi

client:
  replicaCount: 3
  image:
    tag: "v1.0.0"
    pullPolicy: "IfNotPresent"
  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 20

ingress:
  enabled: true
  className: "nginx"
  hosts:
    - host: "chat.yourdomain.com"
      paths:
        - path: /api
          pathType: Prefix
          backend:
            service:
              name: server
              port: 8000
        - path: /socket.io
          pathType: Prefix
          backend:
            service:
              name: server
              port: 8000
        - path: /
          pathType: Prefix
          backend:
            service:
              name: client
              port: 80
  tls:
    - secretName: "chat-app-tls"
      hosts:
        - "chat.yourdomain.com"

# External databases for production
redis:
  enabled: false
mongodb:
  enabled: false

externalRedis:
  host: "redis.yourdomain.com"
  port: 6379
  password: "your-redis-password"

externalMongodb:
  host: "mongodb.yourdomain.com"
  port: 27017
  username: "chatapp"
  password: "your-mongodb-password"
  database: "chatter"

# Security
security:
  jwtSecret: "your-jwt-secret"
  sessionSecret: "your-session-secret"

networkPolicy:
  enabled: true

podDisruptionBudget:
  enabled: true
  minAvailable: 2
```

### 2. Deploy with Production Values

```bash
helm install chat-app ./helm/chat-app -n chat-app -f production-values.yaml
```

## 🔍 Monitoring & Troubleshooting

### Health Checks

```bash
# Check deployment health
kubectl get deployments -n chat-app

# View pod details
kubectl describe pods -l app.kubernetes.io/name=chat-app -n chat-app

# Check resource usage
kubectl top pods -n chat-app
```

### Logs

```bash
# Server logs
kubectl logs -l app.kubernetes.io/component=server -n chat-app -f

# Client logs  
kubectl logs -l app.kubernetes.io/component=client -n chat-app -f

# Previous pod logs (if pod restarted)
kubectl logs -l app.kubernetes.io/component=server -n chat-app -p
```

### Scaling

```bash
# Manual scaling
kubectl scale deployment chat-app-server --replicas=10 -n chat-app

# Check HPA status
kubectl describe hpa chat-app-server -n chat-app
```

### Configuration Updates

```bash
# Update configuration
helm upgrade chat-app ./helm/chat-app -n chat-app -f updated-values.yaml

# Rollback if needed
helm rollback chat-app 1 -n chat-app

# View release history
helm history chat-app -n chat-app
```

## 🌐 External Access

### Local Development (Port Forward)

```bash
# Access client
kubectl port-forward service/chat-app-client 3000:80 -n chat-app
# Visit: http://localhost:3000

# Access server directly
kubectl port-forward service/chat-app-server 8000:8000 -n chat-app
# Visit: http://localhost:8000/health
```

### Ingress Setup

1. **Install nginx ingress controller**:
```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml
```

2. **Update DNS**: Point your domain to the ingress load balancer IP

3. **TLS Certificate**: Use cert-manager for automatic TLS:
```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.1/cert-manager.yaml
```

## 📈 Performance & Scaling

### Horizontal Pod Autoscaling

- **Server**: 3-20 replicas based on 70% CPU, 80% memory
- **Client**: 2-10 replicas based on 70% CPU

### Resource Limits

| Component | CPU Request | Memory Request | CPU Limit | Memory Limit |
|-----------|-------------|----------------|-----------|--------------|
| Server    | 250m        | 256Mi          | 500m      | 512Mi        |
| Client    | 100m        | 128Mi          | 200m      | 256Mi        |

### Pod Disruption Budget

- Minimum 1 pod available during updates
- Ensures zero-downtime deployments

## 🔒 Security Features

- **Network Policies**: Restrict pod-to-pod communication
- **Security Contexts**: Non-root users, read-only filesystems
- **Secrets Management**: Encrypted storage of sensitive data
- **TLS Termination**: HTTPS/WSS for all traffic
- **CORS Configuration**: Controlled cross-origin access

## 🧹 Cleanup

```bash
# Uninstall the application
helm uninstall chat-app -n chat-app

# Delete namespace
kubectl delete namespace chat-app

# Stop local cluster (if using kind/minikube)
kind delete cluster
# or
minikube stop && minikube delete
```

## 🎉 Success Metrics

After deployment, you should see:

- ✅ All pods in `Running` state
- ✅ Services with ClusterIP assigned
- ✅ Ingress with external IP/hostname
- ✅ HPA showing current metrics
- ✅ Health endpoints responding (200 OK)

## 🤝 Support

For issues or questions:
1. Check pod logs for error messages
2. Verify resource quotas and limits
3. Ensure external services (Redis/MongoDB) are accessible
4. Review ingress controller logs
5. Check network policies if communication fails

Your Chat Application is now ready for production deployment! 🚀
