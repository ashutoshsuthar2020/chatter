#!/bin/bash
# troubleshoot.sh - Comprehensive troubleshooting script for Chat App
# Updated: August 2025

# Configuration
NAMESPACE="chat-app"
HELM_RELEASE="chat-app"
CHART_PATH="./helm/chat-app"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }
log_step() { echo -e "\n${BLUE}🔄 $1${NC}\n============================================"; }

# Function to check overall system health
check_system_health() {
    log_step "System Health Check"
    
    # Minikube status
    if minikube status &>/dev/null; then
        log_success "Minikube is running"
        log_info "Minikube version: $(minikube version --short)"
        log_info "Minikube IP: $(minikube ip)"
    else
        log_error "Minikube is not running"
        echo "Run: minikube start"
        return 1
    fi
    
    # Kubernetes connectivity
    if kubectl cluster-info &>/dev/null; then
        log_success "Kubernetes cluster accessible"
        log_info "Current context: $(kubectl config current-context)"
    else
        log_error "Cannot connect to Kubernetes cluster"
        return 1
    fi
    
    # Docker status
    if docker ps &>/dev/null; then
        log_success "Docker is running"
    else
        log_error "Docker is not accessible"
        return 1
    fi
}

# Function to check namespace and resources
check_namespace_resources() {
    log_step "Namespace and Resources Check"
    
    # Check if namespace exists
    if kubectl get namespace chat-app &>/dev/null; then
        log_success "Namespace 'chat-app' exists"
    else
        log_error "Namespace 'chat-app' does not exist"
        echo "Run: kubectl create namespace chat-app"
        return 1
    fi
    
    # Check Helm deployment
    if helm list -n chat-app | grep -q chat-app; then
        log_success "Helm deployment 'chat-app' found"
        HELM_STATUS=$(helm status chat-app -n chat-app -o json | jq -r '.info.status')
        log_info "Helm status: $HELM_STATUS"
    else
        log_warning "Helm deployment 'chat-app' not found"
    fi
    
    # Resource overview
    echo "📊 Resource Overview:"
    kubectl get all -n chat-app --no-headers 2>/dev/null | awk '{print "   " $1 ": " $3}' || log_warning "No resources found in namespace"
}

# Function to diagnose pod issues
diagnose_pods() {
    log_step "Pod Diagnostics"
    
    # Get all pods
    PODS=$(kubectl get pods -n chat-app --no-headers 2>/dev/null)
    
    if [ -z "$PODS" ]; then
        log_error "No pods found in chat-app namespace"
        return 1
    fi
    
    echo "🔍 Pod Status Analysis:"
    echo "$PODS" | while read line; do
        POD_NAME=$(echo $line | awk '{print $1}')
        POD_STATUS=$(echo $line | awk '{print $3}')
        POD_READY=$(echo $line | awk '{print $2}')
        
        case $POD_STATUS in
            "Running")
                if [[ $POD_READY == "1/1" ]]; then
                    log_success "$POD_NAME: Healthy"
                else
                    log_warning "$POD_NAME: Running but not ready ($POD_READY)"
                    echo "  Checking readiness probe..."
                    kubectl describe pod $POD_NAME -n chat-app | grep -A 10 "Conditions:" | sed 's/^/    /'
                fi
                ;;
            "Pending")
                log_warning "$POD_NAME: Pending"
                echo "  Checking scheduling issues..."
                kubectl describe pod $POD_NAME -n chat-app | grep -A 5 "Events:" | sed 's/^/    /'
                ;;
            "CrashLoopBackOff"|"Error"|"Failed")
                log_error "$POD_NAME: $POD_STATUS"
                echo "  Recent logs:"
                kubectl logs $POD_NAME -n chat-app --tail=10 2>/dev/null | sed 's/^/    /' || echo "    No logs available"
                ;;
            "ImagePullBackOff"|"ErrImagePull")
                log_error "$POD_NAME: Image pull issue"
                echo "  Image details:"
                kubectl describe pod $POD_NAME -n chat-app | grep -A 2 "Image:" | sed 's/^/    /'
                ;;
            *)
                log_info "$POD_NAME: $POD_STATUS"
                ;;
        esac
    done
}

# Function to check service connectivity
check_service_connectivity() {
    log_step "Service Connectivity Check"
    
    # Check services
    SERVICES=$(kubectl get services -n chat-app --no-headers 2>/dev/null)
    
    if [ -z "$SERVICES" ]; then
        log_error "No services found"
        return 1
    fi
    
    echo "🌐 Service Status:"
    echo "$SERVICES" | while read line; do
        SVC_NAME=$(echo $line | awk '{print $1}')
        SVC_TYPE=$(echo $line | awk '{print $2}')
        SVC_CLUSTER_IP=$(echo $line | awk '{print $3}')
        SVC_EXTERNAL_IP=$(echo $line | awk '{print $4}')
        SVC_PORTS=$(echo $line | awk '{print $5}')
        
        log_info "$SVC_NAME ($SVC_TYPE): $SVC_CLUSTER_IP:$SVC_PORTS"
        
        # Check endpoints
        ENDPOINTS=$(kubectl get endpoints $SVC_NAME -n chat-app -o jsonpath='{.subsets[0].addresses[*].ip}' 2>/dev/null)
        if [ -n "$ENDPOINTS" ]; then
            log_success "  Endpoints: $ENDPOINTS"
        else
            log_warning "  No endpoints available"
        fi
        
        # Test connectivity for NodePort services
        if [[ $SVC_TYPE == "NodePort" ]]; then
            NODE_PORT=$(echo $SVC_PORTS | cut -d: -f2 | cut -d/ -f1)
            MINIKUBE_IP=$(minikube ip)
            
            if [[ $SVC_NAME == *"client"* ]]; then
                log_info "  Testing client UI: http://$MINIKUBE_IP:$NODE_PORT"
                if curl -s -m 5 -I "http://$MINIKUBE_IP:$NODE_PORT/" &>/dev/null; then
                    log_success "    Client UI accessible"
                else
                    log_warning "    Client UI not accessible"
                fi
            elif [[ $SVC_NAME == *"server"* ]]; then
                log_info "  Testing server API: http://$MINIKUBE_IP:$NODE_PORT/health"
                if curl -s -m 5 "http://$MINIKUBE_IP:$NODE_PORT/health" &>/dev/null; then
                    log_success "    Server API accessible"
                else
                    log_warning "    Server API not accessible"
                fi
            fi
        fi
    done
}

# Function to check configuration
check_configuration() {
    log_step "Configuration Check"
    
    # Check ConfigMap
    if kubectl get configmap chat-app-config -n chat-app &>/dev/null; then
        log_success "ConfigMap 'chat-app-config' exists"
        
        echo "🔧 Key Configuration Values:"
        API_URL=$(kubectl get configmap chat-app-config -n chat-app -o jsonpath='{.data.REACT_APP_API_URL}')
        MONGODB_URI=$(kubectl get configmap chat-app-config -n chat-app -o jsonpath='{.data.MONGODB_URI}')
        REDIS_HOST=$(kubectl get configmap chat-app-config -n chat-app -o jsonpath='{.data.REDIS_HOST}')
        
        log_info "  REACT_APP_API_URL: $API_URL"
        log_info "  MONGODB_URI: $MONGODB_URI"
        log_info "  REDIS_HOST: $REDIS_HOST"
        
        # Validate API URL
        if [[ $API_URL == *"localhost"* ]] || [[ $API_URL == *"chat-app-server"* ]]; then
            log_warning "  API URL may not be accessible from browser"
            MINIKUBE_IP=$(minikube ip)
            SERVER_PORT=$(kubectl get service chat-app-server -n chat-app -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null)
            if [ -n "$SERVER_PORT" ]; then
                log_info "  Suggested API URL: http://$MINIKUBE_IP:$SERVER_PORT"
            fi
        fi
    else
        log_error "ConfigMap 'chat-app-config' not found"
    fi
    
    # Check Secrets
    if kubectl get secret chat-app-secret -n chat-app &>/dev/null; then
        log_success "Secret 'chat-app-secret' exists"
    else
        log_warning "Secret 'chat-app-secret' not found"
    fi
}

# Function to check database connectivity
check_database_connectivity() {
    log_step "Database Connectivity Check"
    
    # Check if database pods exist
    REDIS_POD=$(kubectl get pods -n chat-app -l app=redis --no-headers 2>/dev/null | head -1 | awk '{print $1}')
    MONGODB_POD=$(kubectl get pods -n chat-app -l app=mongodb --no-headers 2>/dev/null | head -1 | awk '{print $1}')
    
    # Test Redis connectivity
    if [ -n "$REDIS_POD" ]; then
        log_info "Testing Redis connectivity..."
        if kubectl exec $REDIS_POD -n chat-app -- redis-cli ping &>/dev/null; then
            log_success "Redis is accessible"
        else
            log_warning "Redis is not responding"
        fi
    else
        log_warning "Redis pod not found"
    fi
    
    # Test MongoDB connectivity
    if [ -n "$MONGODB_POD" ]; then
        log_info "Testing MongoDB connectivity..."
        if kubectl exec $MONGODB_POD -n chat-app -- mongosh --eval "db.adminCommand('ping')" &>/dev/null; then
            log_success "MongoDB is accessible"
        else
            log_warning "MongoDB is not responding"
        fi
    else
        log_warning "MongoDB pod not found"
    fi
    
    # Test from application pods
    SERVER_POD=$(kubectl get pods -n chat-app -l app.kubernetes.io/component=server --no-headers 2>/dev/null | head -1 | awk '{print $1}')
    if [ -n "$SERVER_POD" ]; then
        log_info "Testing database connectivity from server pod..."
        
        # Test MongoDB from server
        if kubectl exec $SERVER_POD -n chat-app -- nc -z mongodb 27017 &>/dev/null; then
            log_success "Server can reach MongoDB"
        else
            log_warning "Server cannot reach MongoDB"
        fi
        
        # Test Redis from server  
        if kubectl exec $SERVER_POD -n chat-app -- nc -z redis-master 6379 &>/dev/null; then
            log_success "Server can reach Redis"
        else
            log_warning "Server cannot reach Redis"
        fi
    fi
}

# Function to check logs and events
check_logs_and_events() {
    log_step "Logs and Events Analysis"
    
    echo "📋 Recent Events (last 10):"
    kubectl get events -n chat-app --sort-by='.lastTimestamp' | tail -10 | sed 's/^/  /'
    
    echo ""
    echo "📊 Error Summary:"
    
    # Check for common error patterns
    ERROR_EVENTS=$(kubectl get events -n chat-app --field-selector type=Warning -o json 2>/dev/null | jq -r '.items[] | .message' | sort | uniq -c | sort -nr)
    
    if [ -n "$ERROR_EVENTS" ]; then
        echo "$ERROR_EVENTS" | sed 's/^/  /'
    else
        log_success "No warning events found"
    fi
    
    # Check application logs for errors
    echo ""
    echo "🔍 Recent Application Errors:"
    
    # Server errors
    SERVER_ERRORS=$(kubectl logs -n chat-app -l app.kubernetes.io/component=server --tail=100 2>/dev/null | grep -i "error\|exception\|failed" | tail -5)
    if [ -n "$SERVER_ERRORS" ]; then
        echo "  Server errors:"
        echo "$SERVER_ERRORS" | sed 's/^/    /'
    fi
    
    # Client errors
    CLIENT_ERRORS=$(kubectl logs -n chat-app -l app.kubernetes.io/component=client --tail=100 2>/dev/null | grep -i "error\|failed" | tail -5)
    if [ -n "$CLIENT_ERRORS" ]; then
        echo "  Client errors:"
        echo "$CLIENT_ERRORS" | sed 's/^/    /'
    fi
    
    if [ -z "$SERVER_ERRORS" ] && [ -z "$CLIENT_ERRORS" ]; then
        log_success "No recent application errors found"
    fi
}

# Function to provide fix suggestions
provide_fix_suggestions() {
    log_step "Fix Suggestions"
    
    # Check pod status and provide specific suggestions
    FAILED_PODS=$(kubectl get pods -n chat-app --no-headers 2>/dev/null | grep -v "Running\|Completed" | awk '{print $1 " " $3}')
    
    if [ -n "$FAILED_PODS" ]; then
        echo "🔧 Suggested Fixes:"
        
        echo "$FAILED_PODS" | while read pod status; do
            case $status in
                "ImagePullBackOff"|"ErrImagePull")
                    echo "  For $pod ($status):"
                    echo "    minikube image load myrepo/chat-server:latest"
                    echo "    minikube image load myrepo/chat-client:latest"
                    ;;
                "CrashLoopBackOff")
                    echo "  For $pod ($status):"
                    echo "    kubectl logs $pod -n chat-app --previous"
                    echo "    kubectl describe pod $pod -n chat-app"
                    ;;
                "Pending")
                    echo "  For $pod ($status):"
                    echo "    kubectl describe pod $pod -n chat-app | grep Events -A 10"
                    ;;
            esac
        done
    fi
    
    # Configuration fixes
    API_URL=$(kubectl get configmap chat-app-config -n chat-app -o jsonpath='{.data.REACT_APP_API_URL}' 2>/dev/null)
    if [[ $API_URL == *"chat-app-server"* ]]; then
        echo ""
        echo "🔧 Configuration Fix Needed:"
        MINIKUBE_IP=$(minikube ip)
        SERVER_PORT=$(kubectl get service chat-app-server -n chat-app -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null)
        if [ -n "$SERVER_PORT" ]; then
            echo "  Update API URL:"
            echo "    helm upgrade chat-app ./helm/chat-app -n chat-app --set global.reactAppApiUrl=\"http://$MINIKUBE_IP:$SERVER_PORT\""
        fi
    fi
    
    # General fixes
    echo ""
    echo "🔄 General Troubleshooting Commands:"
    echo "  Restart deployments:"
    echo "    kubectl rollout restart deployment chat-app-server -n chat-app"
    echo "    kubectl rollout restart deployment chat-app-client -n chat-app"
    echo ""
    echo "  Scale down and up:"
    echo "    kubectl scale deployment chat-app-server --replicas=0 -n chat-app"
    echo "    kubectl scale deployment chat-app-server --replicas=3 -n chat-app"
    echo ""
    echo "  Force image pull:"
    echo "    kubectl patch deployment chat-app-server -n chat-app -p '{\"spec\":{\"template\":{\"metadata\":{\"annotations\":{\"date\":\"$(date +'%s')\"}}}}}'"
}

# Function to run automated fixes
run_automated_fixes() {
    log_step "Automated Fixes"
    
    read -p "🤖 Run automated fixes? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        return 0
    fi
    
    # Fix 1: Ensure images are loaded
    log_info "Loading Docker images into minikube..."
    minikube image load myrepo/chat-server:latest 2>/dev/null || log_warning "Server image not found locally"
    minikube image load myrepo/chat-client:latest 2>/dev/null || log_warning "Client image not found locally"
    
    # Fix 2: Restart failed deployments
    FAILED_DEPLOYMENTS=$(kubectl get deployments -n chat-app --no-headers 2>/dev/null | awk '$2 != $3 {print $1}')
    if [ -n "$FAILED_DEPLOYMENTS" ]; then
        log_info "Restarting failed deployments..."
        echo "$FAILED_DEPLOYMENTS" | while read deployment; do
            kubectl rollout restart deployment $deployment -n chat-app
        done
        
        # Wait for rollout
        echo "$FAILED_DEPLOYMENTS" | while read deployment; do
            kubectl rollout status deployment $deployment -n chat-app --timeout=300s
        done
    fi
    
    # Fix 3: Update API URL if needed
    API_URL=$(kubectl get configmap chat-app-config -n chat-app -o jsonpath='{.data.REACT_APP_API_URL}' 2>/dev/null)
    if [[ $API_URL == *"chat-app-server"* ]]; then
        log_info "Updating API URL configuration..."
        MINIKUBE_IP=$(minikube ip)
        SERVER_PORT=$(kubectl get service chat-app-server -n chat-app -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null)
        if [ -n "$SERVER_PORT" ]; then
            helm upgrade chat-app ./helm/chat-app -n chat-app --set global.reactAppApiUrl="http://$MINIKUBE_IP:$SERVER_PORT"
        fi
    fi
    
    log_success "Automated fixes completed"
}

# Function to generate summary report
generate_summary_report() {
    log_step "Summary Report"
    
    echo "📊 Chat Application Health Summary"
    echo "================================="
    echo ""
    
    # Overall status
    TOTAL_PODS=$(kubectl get pods -n chat-app --no-headers 2>/dev/null | wc -l)
    RUNNING_PODS=$(kubectl get pods -n chat-app --no-headers 2>/dev/null | grep "Running" | wc -l)
    READY_PODS=$(kubectl get pods -n chat-app --no-headers 2>/dev/null | awk '$2 == "1/1" {count++} END {print count+0}')
    
    echo "Pod Status: $READY_PODS/$TOTAL_PODS ready, $RUNNING_PODS/$TOTAL_PODS running"
    
    if [ "$READY_PODS" -eq "$TOTAL_PODS" ] && [ "$TOTAL_PODS" -gt 0 ]; then
        log_success "All pods are healthy"
    elif [ "$RUNNING_PODS" -gt 0 ]; then
        log_warning "Some pods are not ready"
    else
        log_error "No pods are running"
    fi
    
    # Service accessibility
    echo ""
    echo "🌐 Access Information:"
    MINIKUBE_IP=$(minikube ip)
    CLIENT_PORT=$(kubectl get service chat-app-client -n chat-app -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null)
    SERVER_PORT=$(kubectl get service chat-app-server -n chat-app -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null)
    
    if [ -n "$CLIENT_PORT" ]; then
        echo "  Client UI:  http://$MINIKUBE_IP:$CLIENT_PORT"
    else
        echo "  Client UI:  Not exposed"
    fi
    
    if [ -n "$SERVER_PORT" ]; then
        echo "  Server API: http://$MINIKUBE_IP:$SERVER_PORT"
    else
        echo "  Server API: Not exposed"
    fi
    
    # Database status
    echo ""
    echo "🗄️  Database Status:"
    REDIS_STATUS=$(kubectl get pods -n chat-app -l app=redis --no-headers 2>/dev/null | awk '{print $3}' | head -1)
    MONGODB_STATUS=$(kubectl get pods -n chat-app -l app=mongodb --no-headers 2>/dev/null | awk '{print $3}' | head -1)
    
    echo "  Redis:   ${REDIS_STATUS:-Not Found}"
    echo "  MongoDB: ${MONGODB_STATUS:-Not Found}"
    
    # Recommendations
    echo ""
    echo "💡 Recommendations:"
    if [ "$READY_PODS" -lt "$TOTAL_PODS" ]; then
        echo "  - Check pod logs for issues: kubectl logs -n chat-app <pod-name>"
        echo "  - Consider running automated fixes"
    fi
    
    if [[ $(kubectl get configmap chat-app-config -n chat-app -o jsonpath='{.data.REACT_APP_API_URL}' 2>/dev/null) == *"chat-app-server"* ]]; then
        echo "  - Update API URL for external access"
    fi
    
    if [ "$TOTAL_PODS" -eq 0 ]; then
        echo "  - Run the deployment script: ./deploy.sh"
    fi
}

# Main function
main() {
    echo "🔧 Chat Application Troubleshooting Tool"
    echo "======================================="
    echo ""
    
    # Run all diagnostic checks
    check_system_health
    check_namespace_resources
    diagnose_pods
    check_service_connectivity
    check_configuration
    check_database_connectivity
    check_logs_and_events
    provide_fix_suggestions
    run_automated_fixes
    generate_summary_report
    
    echo ""
    log_success "Troubleshooting completed!"
    echo ""
    echo "💡 For detailed logs, run:"
    echo "   kubectl logs -n chat-app -l app.kubernetes.io/component=server -f"
    echo "   kubectl logs -n chat-app -l app.kubernetes.io/component=client -f"
}

# Run main function
main "$@"
