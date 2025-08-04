# Chatter Helm Chart

A Helm chart for deploying the Chatter real-time messaging application with contact management on Kubernetes.

## 🚀 Quick Start

### Prerequisites

- Kubernetes 1.19+
- Helm 3.2.0+
- Docker images built and available (for local development)

### 🎯 Development Deployment

```bash
# Build Docker image for Minikube
eval $(minikube docker-env)
cd ../server && docker build -t chatter-server:latest .

# Deploy development environment
helm install chatter . -f values-dev.yaml

# Port forward to access
kubectl port-forward service/chatter-chatter-helm 8000:8000
```

### 🏭 Production Deployment

```bash
# Deploy production environment
helm install chatter . -f values-prod.yaml

# Check deployment status
helm status chatter
kubectl get all -l app.kubernetes.io/instance=chatter
```

## 📋 Configuration

The following table lists the configurable parameters and their default values.

### Application Configuration

| Parameter | Description | Default | Dev Override | Prod Override |
|-----------|-------------|---------|--------------|---------------|
| `replicaCount` | Number of replicas | `2` | `1` | `3` |
| `image.repository` | Image repository | `chatter-server` | `chatter-server` | `your-registry/chatter-server` |
| `image.tag` | Image tag | `latest` | `latest` | `v1.0.0` |
| `image.pullPolicy` | Image pull policy | `Never` | `Never` | `Always` |
| `service.type` | Service type | `ClusterIP` | `ClusterIP` | `ClusterIP` |
| `service.port` | Service port | `8000` | `8000` | `8000` |

### Environment Variables

| Parameter | Description | Default |
|-----------|-------------|---------|
| `env[0].name` | Port variable name | `PORT` |
| `env[0].value` | Port value | `8000` |
| `env[1].name` | Node environment | `NODE_ENV` |
| `env[1].value` | Environment value | `production` |

### Secrets Configuration

| Parameter | Description | Default | Notes |
|-----------|-------------|---------|-------|
| `secrets.enabled` | Enable secrets | `true` | Set to `false` for external secret management |
| `secrets.data.MONGODB_URI` | MongoDB connection string (base64) | `encoded-value` | Auto-configured for internal MongoDB |
| `secrets.data.JWT_SECRET` | JWT secret key (base64) | `encoded-value` | Change for production |
| `secrets.data.GOOGLE_CLIENT_ID` | Google OAuth client ID (base64) | `encoded-value` | Your Google OAuth credentials |

### MongoDB Configuration

| Parameter | Description | Default | Dev Override | Prod Override |
|-----------|-------------|---------|--------------|---------------|
| `mongodb.enabled` | Enable MongoDB | `true` | `true` | `true` |
| `mongodb.auth.enabled` | Enable MongoDB auth | `false` | `false` | `true` |
| `mongodb.persistence.enabled` | Enable persistent storage | `true` | `false` | `true` |
| `mongodb.persistence.size` | Storage size | `8Gi` | `N/A` | `20Gi` |
| `mongodb.resources.limits.cpu` | CPU limit | `200m` | `200m` | `2000m` |
| `mongodb.resources.limits.memory` | Memory limit | `256Mi` | `256Mi` | `2Gi` |

### Auto-scaling Configuration

| Parameter | Description | Default | Dev Override | Prod Override |
|-----------|-------------|---------|--------------|---------------|
| `autoscaling.enabled` | Enable HPA | `true` | `false` | `true` |
| `autoscaling.minReplicas` | Minimum replicas | `2` | `N/A` | `3` |
| `autoscaling.maxReplicas` | Maximum replicas | `10` | `N/A` | `20` |
| `autoscaling.targetCPUUtilizationPercentage` | CPU target | `80` | `N/A` | `70` |

### Ingress Configuration (Production Only)

| Parameter | Description | Default | Prod Override |
|-----------|-------------|---------|---------------|
| `ingress.enabled` | Enable ingress | `false` | `true` |
| `ingress.className` | Ingress class | `""` | `nginx` |
| `ingress.hosts[0].host` | Hostname | `chatter.local` | `chatter.yourdomain.com` |
| `ingress.tls[0].secretName` | TLS secret | `""` | `chatter-tls` |

## 🎯 Environment-Specific Deployments

### Development Environment (`values-dev.yaml`)
**Optimized for local development and testing:**

- **Single replica** - Minimal resource usage
- **No persistence** - Fresh start every deployment
- **Local images** - `imagePullPolicy: Never`
- **Minimal resources** - 100m CPU, 128Mi memory
- **No auto-scaling** - Fixed single pod
- **No ingress** - Port forwarding for access

**Best for:**
- Local development
- Feature testing
- Debugging
- Quick iterations

### Production Environment (`values-prod.yaml`)
**Enterprise-ready configuration:**

- **Multiple replicas** - High availability with 3+ pods
- **Auto-scaling** - Scale from 3 to 20 pods based on CPU
- **Persistent storage** - 20Gi storage for MongoDB
- **Registry images** - Pull from container registry
- **Ingress with TLS** - External access with SSL
- **Resource limits** - 1000m CPU, 1Gi memory per pod
- **MongoDB auth** - Secure database access
- **External secrets** - Integration with secret management systems

**Best for:**
- Production workloads
- High availability requirements
- External user access
- Scalable applications

## 🔧 Common Operations

### Installation
```bash
# Development
helm install chatter . -f values-dev.yaml

# Production
helm install chatter . -f values-prod.yaml

# Custom values
helm install chatter . --set replicaCount=5 --set image.tag=v2.0.0
```

### Upgrades
```bash
# Upgrade with new values
helm upgrade chatter . -f values-prod.yaml

# Upgrade specific parameters
helm upgrade chatter . --set image.tag=v1.1.0

# Force upgrade
helm upgrade chatter . -f values-dev.yaml --force
```

### Monitoring
```bash
# Check deployment status
helm status chatter

# List all releases
helm list

# View deployment history
helm history chatter

# Get all Kubernetes resources
kubectl get all -l app.kubernetes.io/instance=chatter
```

### Troubleshooting
```bash
# Check pod logs
kubectl logs -l app.kubernetes.io/name=chatter-helm

# Check MongoDB logs
kubectl logs -l app=mongodb

# Describe problematic pods
kubectl describe pod <pod-name>

# Check secrets
kubectl get secrets chatter-chatter-helm-secrets -o yaml

# Port forward for debugging
kubectl port-forward service/chatter-chatter-helm 8000:8000
```

### Rollbacks
```bash
# Rollback to previous version
helm rollback chatter

# Rollback to specific revision
helm rollback chatter 2

# Check rollback status
helm status chatter
```

### Cleanup
```bash
# Uninstall release (keeps PVCs)
helm uninstall chatter

# Delete PVCs if needed
kubectl delete pvc -l app.kubernetes.io/instance=chatter

# Complete cleanup
helm uninstall chatter && kubectl delete pvc -l app.kubernetes.io/instance=chatter
```

## 🧪 Testing

### Dry Run
```bash
# Test without installing
helm install chatter-test . --dry-run -f values-dev.yaml

# Debug template rendering
helm template chatter . -f values-dev.yaml
```

### Helm Tests
```bash
# Run connectivity tests
helm test chatter

# View test results
kubectl logs chatter-chatter-helm-test-connection
```

### Health Checks
```bash
# Check application health
curl http://localhost:8000/health

# Check via Kubernetes
kubectl get pods -l app.kubernetes.io/name=chatter-helm
kubectl describe deployment chatter-chatter-helm
```

## 🔒 Security Considerations

### Production Security Checklist

- [ ] **Use external secret management** (set `secrets.enabled: false`)
- [ ] **Enable MongoDB authentication** (`mongodb.auth.enabled: true`)
- [ ] **Configure TLS/SSL** for ingress
- [ ] **Set resource limits** to prevent resource exhaustion
- [ ] **Use non-root containers** (already configured)
- [ ] **Enable network policies** if supported by your cluster
- [ ] **Regular security updates** for base images
- [ ] **Audit logging** for compliance requirements

### Secret Management

For production deployments, consider using:
- **AWS Secrets Manager** with External Secrets Operator
- **HashiCorp Vault** integration
- **Azure Key Vault** with CSI driver
- **Google Secret Manager** with Workload Identity

## 📊 Monitoring and Observability

### Recommended Additions
```bash
# Add Prometheus monitoring
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack

# Add Grafana dashboards for Node.js and MongoDB
# Configure ServiceMonitor for metrics collection
```

### Key Metrics to Monitor
- **Application**: Response time, error rates, active connections
- **MongoDB**: Connection pool, query performance, storage usage  
- **Kubernetes**: CPU usage, memory usage, pod restarts
- **Socket.IO**: Active connections, message throughput

## 🚨 Disaster Recovery

### Backup Strategy
```bash
# MongoDB backup (if using persistent storage)
kubectl exec mongodb-pod -- mongodump --db chatter --out /backup

# PVC snapshots (cluster-dependent)
kubectl create volumesnapshot chatter-snapshot --source-name=mongodb-pvc
```

### High Availability
- **Multi-AZ deployment** with node affinity rules
- **Database replication** for MongoDB replica sets
- **Load balancer** health checks and failover
- **Backup and restore** procedures

## 📁 Chart Structure

```
chatter-helm/
├── Chart.yaml                 # Chart metadata
├── values.yaml               # Default configuration values
├── values-dev.yaml           # Development environment
├── values-prod.yaml          # Production environment
├── templates/
│   ├── deployment.yaml       # Main application deployment
│   ├── service.yaml          # Kubernetes service
│   ├── secret.yaml           # Application secrets
│   ├── mongodb.yaml          # MongoDB deployment
│   ├── ingress.yaml          # Ingress configuration
│   ├── hpa.yaml              # Horizontal Pod Autoscaler
│   ├── serviceaccount.yaml   # Service account
│   ├── _helpers.tpl          # Template helpers
│   └── tests/
│       └── test-connection.yaml  # Connectivity tests
└── README.md                 # This documentation
```

---

## 🔗 Related Documentation

- **Main Project**: [../README.md](../README.md)
- **Google OAuth Setup**: [../GOOGLE_OAUTH_SETUP.md](../GOOGLE_OAUTH_SETUP.md)
- **Helm Documentation**: https://helm.sh/docs/
- **Kubernetes Documentation**: https://kubernetes.io/docs/

**🎯 Ready to deploy? Choose your environment and get started with a single Helm command!**
