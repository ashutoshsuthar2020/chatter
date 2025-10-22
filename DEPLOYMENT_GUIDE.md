# How to Deploy Chatter 🚀

Just the essential stuff to get your chat app running in the cloud.

## Quick Deploy Checklist

1. **Fix the client config first** (this trips everyone up!)
   ```bash
   # In client/.env - update this to your server's URL
   REACT_APP_INGRESS_DOMAIN=http://your-server-ip
   ```

2. **Build & push your images**
   ```bash
   cd client
   docker buildx build --platform linux/amd64,linux/arm64 -t your-username/client:latest --push .
   
   cd ../server  
   docker buildx build --platform linux/amd64,linux/arm64 -t your-username/server:latest --push .
   ```

3. **Deploy with Helm**
   ```bash
   helm upgrade --install chat-server ./helm/server
   helm upgrade --install chat-client ./helm/client
   ```

4. **Check if it worked**
   ```bash
   kubectl get pods    # Should all be "Running"
   kubectl get ingress # Get your external URL
   ```

## Common Issues

**"It's not connecting!"** - Check your client .env has the right server URL

**"Images won't pull"** - Make sure your Docker images are public or add image pull secrets

**"502 Bad Gateway"** - Server probably isn't running, check `kubectl logs`

**"Can't see messages"** - Redis or MongoDB might not be connected properly

## What You Get

- Client app on port 3000 (React)
- Server API on port 8000 (Node.js)  
- Redis for presence/scaling
- NATS for multi-server sync
- Auto-scaling when traffic increases

That's it! Your chat app should be live and working.

For issues or questions:
1. Check pod logs for error messages
2. Verify resource quotas and limits
3. Ensure external services (Redis/MongoDB) are accessible
4. Review ingress controller logs
5. Check network policies if communication fails

Your Chat Application is now ready for production deployment! 🚀
