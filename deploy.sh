#!/bin/bash

# ========================================
# Ethereum Wallet Analyzer - Deployment Script
# Automated deployment for multiple platforms
# ========================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="ethereum-wallet-analyzer"
VERSION="2.1.0"
DOCKER_IMAGE="$APP_NAME:$VERSION"

# Functions
print_header() {
    echo -e "${BLUE}"
    echo "=========================================="
    echo " Ethereum Wallet Analyzer Deployment"
    echo " Version: $VERSION"
    echo "=========================================="
    echo -e "${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

check_prerequisites() {
    print_info "Checking prerequisites..."
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi
    
    # Check Node.js version
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version must be 18 or higher. Current version: $(node --version)"
        exit 1
    fi
    
    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm first."
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

check_env_file() {
    print_info "Checking environment configuration..."
    
    if [ ! -f ".env" ]; then
        print_warning ".env file not found. Creating from template..."
        
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_info "Created .env file from template"
            print_warning "Please edit .env file and add your Etherscan API key before continuing"
            echo ""
            echo "Required configuration:"
            echo "  ETHERSCAN_API_KEY=your_api_key_here"
            echo ""
            read -p "Press Enter after configuring .env file..."
        else
            print_error ".env.example template not found"
            exit 1
        fi
    fi
    
    # Check if API key is configured
    if ! grep -q "ETHERSCAN_API_KEY=" .env || grep -q "your_etherscan_api_key_here" .env; then
        print_warning "Etherscan API key appears to be missing or using default value"
        print_info "Please ensure ETHERSCAN_API_KEY is set in .env file"
    fi
    
    print_success "Environment configuration checked"
}

install_dependencies() {
    print_info "Installing dependencies..."
    
    if [ -f "package-lock.json" ]; then
        npm ci
    else
        npm install
    fi
    
    print_success "Dependencies installed"
}

run_tests() {
    print_info "Running tests..."
    
    # Check if test script exists
    if npm run | grep -q "test"; then
        npm test
        print_success "Tests passed"
    else
        print_warning "No tests found, skipping test phase"
    fi
}

build_production() {
    print_info "Building for production..."
    
    # Set production environment
    export NODE_ENV=production
    
    # Run build script if it exists
    if npm run | grep -q "build"; then
        npm run build
        print_success "Production build completed"
    else
        print_info "No build script found, using source files directly"
    fi
}

deploy_local() {
    print_info "Starting local deployment..."
    
    check_prerequisites
    check_env_file
    install_dependencies
    run_tests
    
    print_success "Local deployment ready!"
    print_info "Starting application..."
    
    npm start
}

deploy_docker() {
    print_info "Starting Docker deployment..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    check_env_file
    
    print_info "Building Docker image..."
    docker build -t $DOCKER_IMAGE .
    print_success "Docker image built: $DOCKER_IMAGE"
    
    print_info "Starting Docker container..."
    docker run -d \
        --name $APP_NAME \
        --env-file .env \
        -p 10000:10000 \
        --restart unless-stopped \
        $DOCKER_IMAGE
    
    print_success "Docker container started!"
    print_info "Application available at: http://localhost:10000"
    print_info "Container name: $APP_NAME"
    print_info "View logs: docker logs $APP_NAME"
    print_info "Stop container: docker stop $APP_NAME"
}

deploy_docker_compose() {
    print_info "Starting Docker Compose deployment..."
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null && ! command -v docker &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    check_env_file
    
    print_info "Starting services with Docker Compose..."
    
    # Use docker compose or docker-compose based on availability
    if command -v docker &> /dev/null && docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    elif command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    else
        print_error "Neither 'docker compose' nor 'docker-compose' is available"
        exit 1
    fi
    
    # Start production profile by default
    $COMPOSE_CMD up -d --build
    
    print_success "Docker Compose deployment started!"
    print_info "Application available at: http://localhost:10000"
    print_info "View logs: $COMPOSE_CMD logs -f app"
    print_info "Stop services: $COMPOSE_CMD down"
}

deploy_render() {
    print_info "Preparing for Render deployment..."
    
    check_env_file
    install_dependencies
    run_tests
    build_production
    
    print_success "Project prepared for Render deployment!"
    echo ""
    print_info "Render Deployment Instructions:"
    echo "1. Push your code to GitHub"
    echo "2. Connect your GitHub repository to Render"
    echo "3. Create a new Web Service with these settings:"
    echo "   - Build Command: npm install"
    echo "   - Start Command: npm start"
    echo "   - Node Version: 18"
    echo "4. Add environment variables in Render dashboard:"
    echo "   - ETHERSCAN_API_KEY=your_actual_api_key"
    echo "   - NODE_ENV=production"
    echo "5. Deploy!"
    echo ""
    print_info "Your app will be available at: https://your-app.onrender.com"
}

deploy_railway() {
    print_info "Preparing for Railway deployment..."
    
    check_env_file
    install_dependencies
    run_tests
    build_production
    
    print_success "Project prepared for Railway deployment!"
    echo ""
    print_info "Railway Deployment Instructions:"
    echo "1. Install Railway CLI: npm install -g @railway/cli"
    echo "2. Login: railway login"
    echo "3. Initialize: railway init"
    echo "4. Add environment variables:"
    echo "   railway variables set ETHERSCAN_API_KEY=your_actual_api_key"
    echo "   railway variables set NODE_ENV=production"
    echo "5. Deploy: railway up"
    echo ""
}

cleanup() {
    print_info "Cleaning up..."
    
    # Remove Docker containers and images if they exist
    if command -v docker &> /dev/null; then
        if docker ps -a | grep -q $APP_NAME; then
            docker stop $APP_NAME 2>/dev/null || true
            docker rm $APP_NAME 2>/dev/null || true
            print_info "Removed Docker container: $APP_NAME"
        fi
        
        if docker images | grep -q $APP_NAME; then
            docker rmi $DOCKER_IMAGE 2>/dev/null || true
            print_info "Removed Docker image: $DOCKER_IMAGE"
        fi
    fi
    
    print_success "Cleanup completed"
}

show_help() {
    echo "Ethereum Wallet Analyzer - Deployment Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  local           Deploy locally with Node.js"
    echo "  docker          Deploy with Docker container"
    echo "  compose         Deploy with Docker Compose (full stack)"
    echo "  render          Prepare for Render deployment"
    echo "  railway         Prepare for Railway deployment"
    echo "  cleanup         Clean up Docker resources"
    echo "  help            Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 local        # Start local development server"
    echo "  $0 docker       # Build and run Docker container"
    echo "  $0 compose      # Start with Docker Compose"
    echo "  $0 render       # Prepare for Render deployment"
    echo ""
}

# Main script logic
print_header

case "${1:-help}" in
    "local")
        deploy_local
        ;;
    "docker")
        deploy_docker
        ;;
    "compose")
        deploy_docker_compose
        ;;
    "render")
        deploy_render
        ;;
    "railway")
        deploy_railway
        ;;
    "cleanup")
        cleanup
        ;;
    "help"|*)
        show_help
        ;;
esac
