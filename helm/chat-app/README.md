# Chat App Helm Chart

A comprehensive Helm chart for deploying the chat application with horizontal scaling, Redis coordination, and MongoDB persistence.

## Quick Start

```bash
# Add dependencies
helm dependency update ./helm/chat-app

# Install the chart
helm install my-chat-app ./helm/chat-app

# Or with custom values
helm install my-chat-app ./helm/chat-app -f my-values.yaml
```

## Prerequisites

- Kubernetes 1.19+
- Helm 3.0+
- PV provisioner support in the underlying infrastructure (for persistent storage)

## Installing the Chart

```bash
# Install with default values
helm install chat-app ./helm/chat-app

# Install with custom namespace
kubectl create namespace chat-app
helm install chat-app ./helm/chat-app -n chat-app

# Install with custom values
helm install chat-app ./helm/chat-app -f values-production.yaml
```

## Uninstalling the Chart

```bash
helm uninstall chat-app
```

## Configuration

The following table lists the configurable parameters and their default values.

### Global Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `global.appName` | Application name | `"Chat Application"` |
| `global.imageRegistry` | Global Docker registry | `""` |
| `global.extraEnvVars` | Extra environment variables | `{}` |
| `global.extraSecrets` | Extra secret variables | `{}` |

### Server Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `server.name` | Server component name | `"server"` |
| `server.replicaCount` | Number of server replicas | `3` |
| `server.image.registry` | Server image registry | `"myrepo"` |
| `server.image.repository` | Server image repository | `"chat-server"` |
| `server.image.tag` | Server image tag | `"latest"` |
| `server.image.pullPolicy` | Image pull policy | `"Always"` |
| `server.service.type` | Service type | `"ClusterIP"` |
| `server.service.port` | Service port | `3001` |
| `server.autoscaling.enabled` | Enable HPA | `true` |
| `server.autoscaling.minReplicas` | Minimum replicas | `3` |
| `server.autoscaling.maxReplicas` | Maximum replicas | `20` |
| `server.autoscaling.targetCPUUtilizationPercentage` | CPU threshold | `70` |
| `server.autoscaling.targetMemoryUtilizationPercentage` | Memory threshold | `80` |

### Client Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `client.name` | Client component name | `"client"` |
| `client.replicaCount` | Number of client replicas | `2` |
| `client.image.registry` | Client image registry | `"myrepo"` |
| `client.image.repository` | Client image repository | `"chat-client"` |
| `client.image.tag` | Client image tag | `"latest"` |
| `client.image.pullPolicy` | Image pull policy | `"Always"` |
| `client.service.type` | Service type | `"ClusterIP"` |
| `client.service.port` | Service port | `3000` |
| `client.autoscaling.enabled` | Enable HPA | `true` |
| `client.autoscaling.minReplicas` | Minimum replicas | `2` |
| `client.autoscaling.maxReplicas` | Maximum replicas | `10` |

### Ingress Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `ingress.enabled` | Enable ingress | `true` |
| `ingress.className` | Ingress class name | `"nginx"` |
| `ingress.hosts[0].host` | Hostname | `"chat-app.local"` |
| `ingress.hosts[0].paths[0].path` | Path | `"/"` |
| `ingress.hosts[0].paths[0].pathType` | Path type | `"Prefix"` |
| `ingress.tls` | TLS configuration | `[]` |

### Redis Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `redis.enabled` | Deploy Redis | `true` |
| `redis.auth.enabled` | Enable Redis auth | `false` |
| `redis.master.persistence.enabled` | Enable persistence | `true` |
| `redis.master.persistence.size` | Storage size | `"8Gi"` |

### MongoDB Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `mongodb.enabled` | Deploy MongoDB | `true` |
| `mongodb.auth.enabled` | Enable MongoDB auth | `true` |
| `mongodb.auth.username` | MongoDB username | `"chatapp"` |
| `mongodb.auth.password` | MongoDB password | `"chatapp123"` |
| `mongodb.auth.database` | MongoDB database | `"chatapp"` |
| `mongodb.persistence.enabled` | Enable persistence | `true` |
| `mongodb.persistence.size` | Storage size | `"20Gi"` |

### External Database Configuration

Use these when `redis.enabled=false` or `mongodb.enabled=false`:

| Parameter | Description | Default |
|-----------|-------------|---------|
| `externalRedis.host` | External Redis host | `""` |
| `externalRedis.port` | External Redis port | `6379` |
| `externalRedis.password` | External Redis password | `""` |
| `externalMongodb.host` | External MongoDB host | `""` |
| `externalMongodb.port` | External MongoDB port | `27017` |
| `externalMongodb.username` | External MongoDB username | `""` |
| `externalMongodb.password` | External MongoDB password | `""` |
| `externalMongodb.database` | External MongoDB database | `""` |

### Security Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `security.jwtSecret` | JWT secret (auto-generated if empty) | `""` |
| `security.sessionSecret` | Session secret (auto-generated if empty) | `""` |
| `networkPolicy.enabled` | Enable network policies | `false` |
| `podDisruptionBudget.enabled` | Enable PDB | `true` |
| `podDisruptionBudget.minAvailable` | Minimum available pods | `1` |

## Examples

### Production Values

```yaml
# values-production.yaml
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
        - path: "/"
          pathType: "Prefix"
          backend:
            service:
              name: "chat-app-client"
              port: 3000
  tls:
    - secretName: "chat-app-tls"
      hosts:
        - "chat.yourdomain.com"

mongodb:
  auth:
    password: "your-secure-password"
  persistence:
    size: "100Gi"

redis:
  auth:
    enabled: true
    password: "your-redis-password"

networkPolicy:
  enabled: true

security:
  jwtSecret: "your-jwt-secret"
  sessionSecret: "your-session-secret"
```

### External Databases

```yaml
# values-external-db.yaml
redis:
  enabled: false

mongodb:
  enabled: false

externalRedis:
  host: "redis.yourdomain.com"
  port: 6379
  password: "redis-password"

externalMongodb:
  host: "mongodb.yourdomain.com"
  port: 27017
  username: "chatapp"
  password: "mongodb-password"
  database: "chatapp"
```

## Monitoring

The chart includes:
- Health check endpoints for both client and server
- Horizontal Pod Autoscaler (HPA) for automatic scaling
- Pod Disruption Budgets (PDB) for high availability
- Network Policies for security (optional)

## Troubleshooting

### Common Issues

1. **Pods not starting**: Check resource limits and node capacity
2. **Database connection issues**: Verify credentials and network policies
3. **Ingress not working**: Ensure ingress controller is installed
4. **Scaling issues**: Check HPA metrics and resource requests

### Debug Commands

```bash
# Check pod status
kubectl get pods -l app.kubernetes.io/instance=chat-app

# View logs
kubectl logs -l app.kubernetes.io/component=server -f
kubectl logs -l app.kubernetes.io/component=client -f

# Check HPA status
kubectl get hpa

# Describe problematic pods
kubectl describe pod <pod-name>

# Check events
kubectl get events --sort-by=.metadata.creationTimestamp
```

## Upgrading

```bash
# Update dependencies
helm dependency update ./helm/chat-app

# Upgrade release
helm upgrade chat-app ./helm/chat-app -f values-production.yaml

# Rollback if needed
helm rollback chat-app 1
```

## Development

### Local Testing

```bash
# Lint the chart
helm lint ./helm/chat-app

# Test template rendering
helm template chat-app ./helm/chat-app

# Dry run installation
helm install chat-app ./helm/chat-app --dry-run --debug
```

### Contributing

1. Make changes to templates or values
2. Update version in `Chart.yaml`
3. Test with `helm lint` and `helm template`
4. Update this README if needed
