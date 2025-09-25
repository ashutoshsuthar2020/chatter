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

## Deployment Guide

1. Build your client and server Docker images and push to Docker Hub.
2. Set the correct backend URL in the client `.env` before building.
3. Update Helm chart values for image name, tag, and pull policy.
4. Deploy with Helm and verify services are running.
5. Check logs and endpoints to confirm everything works.

Architecture: React frontend and Node.js backend, both running in Kubernetes with Redis and MongoDB for data and scaling.
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
