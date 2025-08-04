# Kubernetes Deployment Guide

This directory contains all the necessary Kubernetes manifests to deploy the Chatter Server backend to a Kubernetes cluster.

## 📋 Prerequisites

- Kubernetes cluster (local or cloud)
- `kubectl` configured to connect to your cluster
- Docker installed (for building images)
- MongoDB connection (either in-cluster or external)

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │────│   Ingress       │────│   Service       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                              ┌─────────────────────────┼─────────────────────────┐
                              │                         │                         │
                    ┌─────────▼────────┐      ┌─────────▼────────┐      ┌─────────▼────────┐
                    │  Chatter Pod 1   │      │  Chatter Pod 2   │      │  Chatter Pod N   │
                    │                  │      │                  │      │                  │
                    │  Socket.IO       │      │  Socket.IO       │      │  Socket.IO       │
                    │  Express API     │      │  Express API     │      │  Express API     │
                    └─────────┬────────┘      └─────────┬────────┘      └─────────┬────────┘
                              │                         │                         │
                              └─────────────────────────┼─────────────────────────┘
                                                        │
                                              ┌─────────▼────────┐
                                              │    MongoDB       │
                                              │   (Optional)     │
                                              └──────────────────┘
```

## 📁 Files Overview

| File | Description |
|------|-------------|
| `deployment.yaml` | Main application deployment with 2 replicas |
| `service.yaml` | ClusterIP and LoadBalancer services |
| `configmap.yaml` | Non-sensitive configuration |
| `secrets.yaml` | Sensitive data (JWT, MongoDB, Google OAuth) |
| `ingress.yaml` | External access with CORS and WebSocket support |
| `hpa.yaml` | Auto-scaling based on CPU/Memory |
| `mongodb.yaml` | Optional MongoDB deployment |
| `deploy.sh` | Automated deployment script |
| `cleanup.sh` | Resource cleanup script |

## 🚀 Quick Deployment

### 1. Update Secrets

First, update `secrets.yaml` with your base64 encoded values:

```bash
# Encode your values
echo -n 'mongodb://your-connection-string' | base64
echo -n 'your-jwt-secret' | base64
echo -n 'your-google-client-id' | base64
```

### 2. Run Deployment Script

```bash
cd k8s
./deploy.sh
```

### 3. Manual Deployment (Alternative)

```bash
# Build and load image (for local clusters like minikube)
cd ../server
docker build -t chatter-server:latest .

# For minikube
minikube image load chatter-server:latest

# Apply manifests
cd ../k8s
kubectl apply -f configmap.yaml
kubectl apply -f secrets.yaml
kubectl apply -f mongodb.yaml  # Optional
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f hpa.yaml
kubectl apply -f ingress.yaml  # Optional
```

## 🔧 Configuration

### Environment Variables

The application uses these environment variables:

| Variable | Source | Description |
|----------|--------|-------------|
| `PORT` | ConfigMap | Server port (8000) |
| `NODE_ENV` | ConfigMap | Node environment |
| `MONGODB_URI` | Secret | MongoDB connection string |
| `JWT_SECRET` | Secret | JWT signing secret |
| `GOOGLE_CLIENT_ID` | Secret | Google OAuth client ID |

### Resource Limits

Each pod is configured with:
- **Requests**: 128Mi RAM, 100m CPU
- **Limits**: 512Mi RAM, 500m CPU

### Auto-scaling

HPA will scale pods between 2-10 based on:
- CPU usage > 70%
- Memory usage > 80%

## 🔍 Monitoring & Debugging

### Check Deployment Status
```bash
kubectl get deployments
kubectl get pods
kubectl get services
```

### View Logs
```bash
kubectl logs -f deployment/chatter-server
```

### Port Forward for Testing
```bash
kubectl port-forward service/chatter-server-service 8000:8000
```

### Connect to MongoDB Pod
```bash
kubectl exec -it deployment/mongodb -- mongosh
```

## 🌐 External Access

### Option 1: LoadBalancer Service
Access via the LoadBalancer external IP:
```bash
kubectl get service chatter-server-loadbalancer
```

### Option 2: Ingress Controller
Update `ingress.yaml` with your domain and apply:
```bash
kubectl apply -f ingress.yaml
```

### Option 3: Port Forwarding (Development)
```bash
kubectl port-forward service/chatter-server-service 8000:8000
```

## 🗄️ Database Options

### Option 1: In-Cluster MongoDB
Deploy MongoDB using the provided `mongodb.yaml` manifest.

### Option 2: External MongoDB
Update the `MONGODB_URI` in `secrets.yaml` to point to your external MongoDB instance.

### Option 3: Cloud Database
Use MongoDB Atlas or other cloud providers and update the connection string.

## 🔒 Security Considerations

1. **Secrets Management**: Consider using external secret management tools like:
   - HashiCorp Vault
   - AWS Secrets Manager
   - Azure Key Vault
   - Google Secret Manager

2. **Network Policies**: Implement network policies to restrict pod-to-pod communication.

3. **RBAC**: Set up proper Role-Based Access Control.

4. **Image Security**: Scan Docker images for vulnerabilities.

## 📊 Scaling

### Horizontal Scaling
The HPA automatically scales based on resource usage. You can also manually scale:
```bash
kubectl scale deployment chatter-server --replicas=5
```

### Vertical Scaling
Update resource limits in `deployment.yaml` and apply:
```bash
kubectl apply -f deployment.yaml
```

## 🧹 Cleanup

To remove all resources:
```bash
./cleanup.sh
```

Or manually:
```bash
kubectl delete -f .
```

## 🐛 Troubleshooting

### Common Issues

1. **Image Pull Errors**
   - Ensure the image exists and is accessible
   - For local clusters, use `minikube image load`

2. **MongoDB Connection Issues**
   - Check if MongoDB pod is running
   - Verify connection string in secrets

3. **Service Not Accessible**
   - Check if LoadBalancer supports your cluster
   - Use port-forwarding for testing

4. **Resource Constraints**
   - Monitor resource usage with `kubectl top pods`
   - Adjust resource limits if needed

### Useful Commands

```bash
# Get all resources
kubectl get all -l app=chatter-server

# Describe deployment
kubectl describe deployment chatter-server

# Check HPA status
kubectl get hpa

# View events
kubectl get events --sort-by=.metadata.creationTimestamp
```
