# Chat App Kubernetes Deployment Guide

## 🚀 Production Deployment Checklist (August 2025)

1. **Set correct backend URL in client .env:**
  - `REACT_APP_INGRESS_DOMAIN=http://<server-external-ip>:8000`
2. **Build and push multi-arch Docker images for both client and server:**
  - `docker buildx build --platform linux/amd64,linux/arm64 -t <user>/client:<tag> --push .`
  - `docker buildx build --platform linux/amd64,linux/arm64 -t <user>/server:<tag> --push .`
3. **Update Helm values.yaml for both charts:**
  - Set image repository and tag for client and server
  - Set `pullPolicy: Always` for latest tag
  - Set `client.ingressDomain` to backend URL
4. **Deploy/upgrade with Helm:**
  - `helm upgrade --install chat-server ./helm/server -n chatter`
  - `helm upgrade --install chat-client ./helm/client -n chatter`
5. **Verify services:**
  - `kubectl get svc -n chatter` (check for EXTERNAL-IP)
6. **Check logs and connectivity:**
  - `kubectl logs <pod> -n chatter`
  - Test HTTP and WebSocket endpoints from browser and CLI
7. **CORS and Socket.IO CORS:**
  - Ensure backend allows requests from client EXTERNAL-IP
8. **Troubleshooting:**
  - If client still uses old env, repeat build and push with correct .env
  - Use unique image tags to avoid cache issues


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
