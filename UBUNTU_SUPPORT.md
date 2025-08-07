# Ubuntu/Linux Support Documentation
*Updated: August 7, 2025*

## 🐧 Linux Platform Support

The `deploy.sh` script now includes comprehensive support for multiple Linux distributions, with special focus on Ubuntu/Debian systems.

## 🎯 Supported Distributions

### Ubuntu/Debian (Primary Support)
- **Package Manager**: `apt-get`
- **Features**: Official repositories with GPG verification
- **Docker**: Docker CE from official Docker repository
- **kubectl**: Official Kubernetes repository
- **Helm**: Official Helm repository
- **minikube**: Official `.deb` package

### RHEL/CentOS
- **Package Manager**: `yum` / `rpm`
- **Features**: RPM packages where available
- **Installation**: Mix of RPM packages and official scripts

### Fedora
- **Package Manager**: `dnf`
- **Features**: Native package support
- **Installation**: Prefers distribution packages

### Generic Linux
- **Fallback**: Binary downloads and installation scripts
- **Compatibility**: Works on most Linux distributions

## 📦 Installation Process

### Ubuntu/Debian Installation Steps

1. **System Update**
   ```bash
   sudo apt-get update -qq
   ```

2. **Docker CE Installation**
   ```bash
   # Install prerequisites
   sudo apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release
   
   # Add Docker GPG key
   sudo mkdir -p /etc/apt/keyrings
   curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
   
   # Add repository
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list
   
   # Install Docker
   sudo apt-get update
   sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
   ```

3. **kubectl Installation**
   ```bash
   # Add Kubernetes GPG key
   curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.28/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
   
   # Add repository
   echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.28/deb/ /' | sudo tee /etc/apt/sources.list.d/kubernetes.list
   
   # Install kubectl
   sudo apt-get update
   sudo apt-get install -y kubectl
   ```

4. **Helm Installation**
   ```bash
   # Add Helm GPG key
   curl https://baltocdn.com/helm/signing.asc | gpg --dearmor | sudo tee /usr/share/keyrings/helm.gpg
   
   # Add repository
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/helm.gpg] https://baltocdn.com/helm/stable/debian/ all main" | sudo tee /etc/apt/sources.list.d/helm-stable-debian.list
   
   # Install Helm
   sudo apt-get update
   sudo apt-get install -y helm
   ```

5. **minikube Installation**
   ```bash
   # Download and install DEB package
   curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube_latest_amd64.deb
   sudo dpkg -i minikube_latest_amd64.deb
   ```

## 🔧 Post-Installation Setup

### Docker Group Configuration
```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Enable Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Apply group changes (choose one)
newgrp docker          # Apply in current session
# OR log out and back in
```

### minikube Driver Selection
The script automatically selects and installs the best driver:
1. **Docker** (preferred if available)
2. **KVM2** (native virtualization for Linux)
3. **Podman** (alternative container runtime)
4. **VirtualBox** (cross-platform fallback)
5. **None** (bare metal, last resort)

### Driver Installation
The script automatically installs required drivers:
```bash
# KVM2 driver (preferred for Linux)
sudo apt-get install -y qemu-kvm libvirt-daemon-system libvirt-clients bridge-utils
sudo usermod -aG libvirt $USER

# VirtualBox driver (fallback)
sudo apt-get install -y virtualbox virtualbox-ext-pack

# docker-machine-driver-kvm2 (enhanced KVM support)
curl -LO https://storage.googleapis.com/minikube/releases/latest/docker-machine-driver-kvm2
sudo install docker-machine-driver-kvm2 /usr/local/bin/
```

## 🚀 Usage on Ubuntu

### First Time Setup
```bash
# Clone the repository
git clone <repository-url>
cd chatter

# Run deployment (installs everything automatically)
./deploy.sh
```

### Verification Commands
```bash
# Check installed versions
docker --version
kubectl version --client
helm version --short
minikube version --short

# Verify Docker permissions
docker ps

# Check minikube status
minikube status
```

## 🔒 Security Features

### GPG Verification
- All repositories use GPG key verification
- Official signing keys from Docker, Kubernetes, and Helm
- Secure package installation

### User Permissions
- Automatic Docker group management
- Proper sudo usage for system packages
- No unnecessary privilege escalation

## 🐛 Troubleshooting

### Docker Permission Issues
```bash
# If you get permission denied errors:
sudo usermod -aG docker $USER
newgrp docker

# Or restart your session
logout
# Log back in
```

### Package Repository Issues
```bash
# If repository updates fail:
sudo apt-get update --fix-missing

# Clear package cache if needed:
sudo apt-get clean
sudo apt-get update
```

### minikube Start Issues
```bash
# Check available drivers:
minikube start --help | grep driver

# Force specific driver:
minikube start --driver=docker
# or
minikube start --driver=virtualbox
```

## 📋 System Requirements

### Ubuntu/Debian Minimum Requirements
- **OS**: Ubuntu 18.04+ or Debian 10+
- **RAM**: 4GB (8GB recommended)
- **CPU**: 2 cores (4+ recommended)
- **Disk**: 20GB free space
- **Network**: Internet connection for downloads

### Supported Architectures
- **x86_64** (amd64) - Primary support
- **arm64** - Limited support (some packages)

## 🔄 Automatic Updates

The installation script:
- Always installs latest stable versions
- Uses official repositories for updates
- Configures automatic security updates where possible

## 💡 Best Practices

1. **Run as regular user** (not root)
2. **Ensure internet connectivity** during installation
3. **Have sudo privileges** for system packages
4. **Close Docker Desktop** if switching from other platforms
5. **Reboot after major installations** for clean state

This comprehensive Ubuntu support ensures the chat application can be deployed on any Ubuntu/Debian system with zero manual setup required.
