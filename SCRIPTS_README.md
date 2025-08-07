# 🚀 Chat Application Deployment & Troubleshooting Scripts
*Updated: August 2025*

## Overview
This repository contains comprehensive deployment and troubleshooting scripts for the Chat Application on Kubernetes (minikube). The scripts have been updated to handle all edge cases and provide production-ready deployment automation.

## 📁 Script Files

### 1. `deploy.sh` - Complete Deployment Script
**Purpose**: Automated deployment of the entire chat application stack with built-in NodePort configuration

**Features**:
- ✅ Prerequisites validation (minikube, Docker, kubectl, Helm)
- 🔨 Docker image building and loading into minikube
- 🗄️ Database deployment (Redis, MongoDB)
- 💬 Chat application deployment with Helm
- 🌍 External access configuration (NodePort) - **BUILT-IN**
- 🏥 Health checks and validation
- 📊 Final status and access information
- 🔧 Automatic API URL configuration

**Usage**:
```bash
./deploy.sh
```

**What it does**:
1. Checks if minikube, Docker, kubectl, and Helm are available
2. Builds server and client Docker images
3. Loads images into minikube cluster
4. Deploys Redis and MongoDB dependencies
5. Deploys chat application using Helm with NodePort services
6. Automatically configures external access URLs
7. Updates API URL configuration for proper client-server communication
8. Performs comprehensive health checks
9. Shows final access URLs and management commands

### 2. `troubleshoot.sh` - Comprehensive Troubleshooting Tool
**Purpose**: Diagnose and fix common deployment issues

**Features**:
- 🩺 System health diagnostics
- 🔍 Pod status analysis with specific error detection
- 🌐 Service connectivity testing
- 🔧 Configuration validation
- 🗄️ Database connectivity checks
- 📋 Log analysis and error pattern detection
- 💡 Automated fix suggestions
- 🤖 Automated fix execution
- 📊 Summary health report

**Usage**:
```bash
./troubleshoot.sh
```

**What it checks**:
1. Minikube and Kubernetes cluster status
2. Namespace and Helm deployment status
3. Pod health with detailed error analysis
4. Service accessibility and endpoints
5. ConfigMap and Secret validation
6. Database connectivity from application pods
7. Recent events and error patterns
8. Provides specific fix suggestions

### 3. `cleanup.sh` - Complete Environment Cleanup
**Purpose**: Safely remove all chat application resources and undo everything done by deploy.sh

**Features**:
- 🗑️ Complete Kubernetes resource cleanup
- 🏗️ Helm release removal
- 🗄️ Database cleanup (Redis, MongoDB)
- 🐳 Docker image cleanup
- 📁 Build artifact removal
- 🔧 Optional Docker system cleanup
- ✅ Confirmation prompts for safety
- 📊 Status reporting before and after cleanup

**Usage**:
```bash
# Interactive cleanup with confirmation
./cleanup.sh

# Force cleanup without prompts
./cleanup.sh --force

# Show current status only
./cleanup.sh --status

# Show help
./cleanup.sh --help
```

**What it removes**:
1. Helm releases in chat-app namespace
2. All Kubernetes resources (pods, services, deployments, etc.)
3. Redis and MongoDB dependencies
4. Namespace deletion
5. Docker images (myrepo/chat-server, myrepo/chat-client)
6. Build logs and temporary files
7. Optionally: unused Docker resources (containers, images, networks, build cache)

### 🔧 Common Use Cases

### First-Time Deployment
```bash
# Deploy everything from scratch
./deploy.sh
```

### Application Not Working
```bash
# Diagnose issues and get fix suggestions
./troubleshoot.sh
```

### Complete Environment Reset
```bash
# Clean everything and start fresh
./cleanup.sh
./deploy.sh
```

### Force Cleanup (No Prompts)
```bash
# Automated cleanup for scripts/CI
./cleanup.sh --force
```

### Check Current Status
```bash
# Check deployment status
./cleanup.sh --status

# Check current deployment status
kubectl get pods -n chat-app
kubectl get services -n chat-app
```

### Development Workflow
```bash
# Make changes to code
./cleanup.sh --force    # Quick cleanup
./deploy.sh             # Fresh deployment
./troubleshoot.sh       # If issues arise
```

### Manual Fixes
```bash
# Restart deployments
kubectl rollout restart deployment chat-app-server -n chat-app
kubectl rollout restart deployment chat-app-client -n chat-app

# Update API URL (if needed)
MINIKUBE_IP=$(minikube ip)
SERVER_PORT=$(kubectl get svc chat-app-server -n chat-app -o jsonpath='{.spec.ports[0].nodePort}')
helm upgrade chat-app ./helm/chat-app -n chat-app \
  --set global.reactAppApiUrl="http://$MINIKUBE_IP:$SERVER_PORT" \
  --set server.service.type=NodePort \
  --set client.service.type=NodePort

# Load images if missing
minikube image load myrepo/chat-server:latest
minikube image load myrepo/chat-client:latest
```

## 🐛 Common Issues and Solutions

### Issue 1: Pods Not Starting
**Symptoms**: Pods stuck in `Pending`, `ImagePullBackOff`, or `CrashLoopBackOff`

**Solutions**:
```bash
# Check if images are loaded
minikube image ls | grep myrepo

# Load images if missing
minikube image load myrepo/chat-server:latest
minikube image load myrepo/chat-client:latest

# Check pod details
kubectl describe pods -n chat-app
```

### Issue 2: Client UI Not Accessible (macOS/Docker)
**Symptoms**: Cannot access `http://MINIKUBE_IP:CLIENT_PORT` on macOS with Docker driver

**Solutions**:
```bash
# Method 1: Use minikube service (RECOMMENDED for macOS/Docker)
minikube service chat-app-client -n chat-app
minikube service chat-app-server -n chat-app

# Method 2: Use port forwarding
kubectl port-forward -n chat-app service/chat-app-client 3000:80
kubectl port-forward -n chat-app service/chat-app-server 8000:8000
# Then access: http://localhost:3000 (UI) and http://localhost:8000 (API)

# Method 3: Check service configuration
kubectl get services -n chat-app
kubectl describe service chat-app-client -n chat-app
```

### Issue 3: API Connection Issues
**Symptoms**: Client loads but cannot connect to server API

**Solutions**:
```bash
# Check API URL configuration
kubectl get configmap chat-app-config -n chat-app -o jsonpath='{.data.REACT_APP_API_URL}'

# Update API URL to external address
MINIKUBE_IP=$(minikube ip)
SERVER_PORT=$(kubectl get svc chat-app-server -n chat-app -o jsonpath='{.spec.ports[0].nodePort}')
helm upgrade chat-app ./helm/chat-app -n chat-app --set global.reactAppApiUrl="http://$MINIKUBE_IP:$SERVER_PORT"
```

### Issue 4: Database Connection Failures
**Symptoms**: Server logs show MongoDB or Redis connection errors

**Solutions**:
```bash
# Check database pods
kubectl get pods -n chat-app | grep -E "(redis|mongodb)"

# Test connectivity from server pod
SERVER_POD=$(kubectl get pods -n chat-app -l app.kubernetes.io/component=server -o jsonpath='{.items[0].metadata.name}')
kubectl exec $SERVER_POD -n chat-app -- nc -z mongodb 27017
kubectl exec $SERVER_POD -n chat-app -- nc -z redis-master 6379
```

### Issue 5: Health Check Failures
**Symptoms**: Pods running but readiness/liveness probes failing

**Solutions**:
```bash
# Check health endpoints manually
kubectl exec -n chat-app deployment/chat-app-server -- curl localhost:8000/health
kubectl exec -n chat-app deployment/chat-app-client -- curl localhost:3000/health

# Check probe configuration
kubectl describe pod -n chat-app -l app.kubernetes.io/component=server | grep -A 10 Liveness
```

## 📊 Monitoring Commands

### Real-time Monitoring
```bash
# Watch pod status
watch kubectl get pods -n chat-app

# Stream server logs
kubectl logs -n chat-app -l app.kubernetes.io/component=server -f

# Stream client logs
kubectl logs -n chat-app -l app.kubernetes.io/component=client -f

# Monitor events
kubectl get events -n chat-app --watch
```

### Resource Usage
```bash
# Check resource usage (if metrics-server is installed)
kubectl top pods -n chat-app
kubectl top nodes

# Check HPA status
kubectl get hpa -n chat-app
```

## 🔄 Maintenance Operations

### Scaling
```bash
# Scale server pods
kubectl scale deployment chat-app-server --replicas=5 -n chat-app

# Scale client pods
kubectl scale deployment chat-app-client --replicas=3 -n chat-app
```

### Updates
```bash
# Update Helm deployment
helm upgrade chat-app ./helm/chat-app -n chat-app

# Update with new values
helm upgrade chat-app ./helm/chat-app -n chat-app -f custom-values.yaml

# Rollback if needed
helm rollback chat-app -n chat-app
```

### Cleanup
```bash
# Complete cleanup using the cleanup script (RECOMMENDED)
./cleanup.sh

# Manual cleanup (old method)
# Remove application but keep namespace
helm uninstall chat-app -n chat-app

# Remove everything including namespace
kubectl delete namespace chat-app

# Clean up Docker images
docker rmi myrepo/chat-server:latest myrepo/chat-client:latest

# Clean up unused Docker resources
docker system prune -f
```

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐
│   Client UI     │────│   Server API    │
│ (React + nginx) │    │   (Node.js)     │
│ Port: 3000      │    │ Port: 8000      │
└─────────────────┘    └─────────────────┘
         │                       │
         │                       ├── MongoDB
         │                       │   Port: 27017
         │                       │
         │                       └── Redis
         │                           Port: 6379
         │
    ┌─────────────┐
    │   Browser   │
    │  (External) │
    └─────────────┘
```

## 🍎 macOS Specific Notes

**Important**: On macOS with Docker driver, direct NodePort access may not work. Use these methods instead:

### Recommended Access Methods (macOS):
1. **minikube service** (Best option):
   ```bash
   minikube service chat-app-client -n chat-app
   minikube service chat-app-server -n chat-app
   ```

2. **Port forwarding** (Alternative):
   ```bash
   kubectl port-forward -n chat-app service/chat-app-client 3000:80 &
   kubectl port-forward -n chat-app service/chat-app-server 8000:8000 &
   ```

3. **minikube tunnel** (Advanced):
   ```bash
   minikube tunnel  # Run in separate terminal
   # Then use LoadBalancer services
   ```

## 🔐 Security Considerations

- Pods run as non-root user (UID 1001)
- Network policies restrict pod-to-pod communication
- Secrets used for sensitive configuration
- Resource limits applied to prevent resource exhaustion
- Health checks ensure only healthy pods receive traffic

## 📝 Logging and Debugging

### Log Locations
- **Application Logs**: `kubectl logs -n chat-app <pod-name>`
- **Kubernetes Events**: `kubectl get events -n chat-app`
- **Helm Status**: `helm status chat-app -n chat-app`

### Debug Information Collection
The troubleshoot script automatically collects:
- Pod logs and status
- Service configurations
- ConfigMap values
- Recent events
- Resource usage
- Error patterns

### Log Analysis
Look for these patterns:
- `connection error`: Database connectivity issues
- `ECONNREFUSED`: Service connectivity problems
- `ImagePullBackOff`: Image availability issues
- `CrashLoopBackOff`: Application startup failures
- `Unhealthy`: Health check failures

## 🎯 Success Criteria

A successful deployment should show:
- ✅ All pods in `Running` state with `1/1` ready
- ✅ Services accessible via NodePort URLs
- ✅ Client UI loads in browser
- ✅ Server API responds to health checks
- ✅ Database connections established
- ✅ No error events in recent Kubernetes events

## 📞 Getting Help

1. **Run diagnostics**: `./troubleshoot.sh`
2. **Check logs**: `kubectl logs -n chat-app <pod-name>`
3. **Describe resources**: `kubectl describe pod -n chat-app <pod-name>`
4. **Review events**: `kubectl get events -n chat-app --sort-by='.lastTimestamp'`

The scripts provide comprehensive logging and error reporting to help identify and resolve issues quickly!
