#!/bin/bash

# Tournament Hub Setup and Run Script
# This script helps you set up and run the tournament hub project

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a port is in use
port_in_use() {
    lsof -i :$1 >/dev/null 2>&1
}

# Function to kill process on port
kill_port() {
    if port_in_use $1; then
        print_warning "Port $1 is in use. Killing existing process..."
        lsof -ti:$1 | xargs kill -9
        sleep 2
    fi
}

# Function to setup backend
setup_backend() {
    print_status "Setting up backend..."
    
    cd tournament-hub-game-server
    
    # Check if Python virtual environment exists
    if [ ! -d "venv" ]; then
        print_status "Creating Python virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate virtual environment
    print_status "Activating virtual environment..."
    source venv/bin/activate
    
    # Install dependencies
    print_status "Installing Python dependencies..."
    pip install -r requirements.txt
    
    print_success "Backend setup complete!"
    cd ..
}

# Function to setup frontend
setup_frontend() {
    print_status "Setting up frontend..."
    
    cd tournament-hub-frontend
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        print_status "Installing Node.js dependencies..."
        npm install
    fi
    
    print_success "Frontend setup complete!"
    cd ..
}

# Function to build smart contract
build_contract() {
    print_status "Building smart contract..."
    
    cd tournament-hub-sc
    
    # Check if sc-meta is available
    if ! command_exists sc-meta; then
        print_error "sc-meta is not installed. Please install MultiversX SDK first."
        print_status "Visit: https://docs.multiversx.com/developers/setup/overview/"
        exit 1
    fi
    
    # Build the contract
    print_status "Building contract..."
    sc-meta all build
    
    # Generate proxy
    print_status "Generating proxy..."
    sc-meta all proxy
    
    print_success "Smart contract build complete!"
    cd ..
}

# Function to run backend
run_backend() {
    print_status "Starting backend server..."
    
    cd tournament-hub-game-server
    
    # Kill existing process on port 8000
    kill_port 8000
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Start the server
    print_status "Starting FastAPI server on port 8000..."
    python main.py &
    BACKEND_PID=$!
    
    # Wait a moment for server to start
    sleep 3
    
    # Check if server is running
    if curl -s http://localhost:8000/docs >/dev/null 2>&1; then
        print_success "Backend server started successfully!"
        print_status "Backend API docs: http://localhost:8000/docs"
    else
        print_error "Failed to start backend server"
        exit 1
    fi
    
    cd ..
}

# Function to run frontend
run_frontend() {
    print_status "Starting frontend development server..."
    
    cd tournament-hub-frontend
    
    # Kill existing process on port 3000
    kill_port 3000
    
    # Start the development server
    print_status "Starting Vite dev server on port 3000 (HTTPS)..."
    npm run dev &
    FRONTEND_PID=$!
    
    # Wait for server to become ready (retry for up to 30 seconds)
    READY=false
    for i in {1..30}; do
        # Vite is configured with HTTPS; -k ignores self-signed cert
        if curl -k -s https://localhost:3000 >/dev/null 2>&1; then
            READY=true
            break
        fi
        sleep 1
    done

    if [ "$READY" = true ]; then
        print_success "Frontend server started successfully!"
        print_status "Frontend URL: https://localhost:3000"
    else
        print_error "Failed to start frontend server"
        print_status "Tip: If you just changed ports or certificates, try running: npm run dev inside tournament-hub-frontend to see logs."
        exit 1
    fi
    
    cd ..
}

# Function to stop all services
stop_all() {
    print_status "Stopping all services..."
    
    # Kill processes on common ports
    kill_port 8000
    kill_port 3000
    
    print_success "All services stopped!"
}

# Function to show status
show_status() {
    print_status "Checking service status..."
    
    if port_in_use 8000; then
        print_success "Backend server is running on port 8000"
    else
        print_warning "Backend server is not running"
    fi
    
    if port_in_use 3000; then
        print_success "Frontend server is running on port 3000"
    else
        print_warning "Frontend server is not running"
    fi
}

# Function to show help
show_help() {
    echo "Tournament Hub Setup and Run Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  setup       - Set up the entire project (backend, frontend, contract)"
    echo "  run         - Run both backend and frontend servers"
    echo "  backend     - Set up and run only the backend server"
    echo "  frontend    - Set up and run only the frontend server"
    echo "  contract    - Build the smart contract"
    echo "  stop        - Stop all running services"
    echo "  status      - Show status of running services"
    echo "  help        - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 setup    # Set up everything"
    echo "  $0 run      # Run the full application"
    echo "  $0 backend  # Run only backend"
    echo "  $0 stop     # Stop all services"
}

# Main script logic
case "${1:-help}" in
    "setup")
        print_status "Setting up Tournament Hub project..."
        setup_backend
        setup_frontend
        build_contract
        print_success "Setup complete! Run '$0 run' to start the application."
        ;;
    "run")
        print_status "Starting Tournament Hub application..."
        run_backend
        run_frontend
        print_success "Tournament Hub is now running!"
        print_status "Frontend: https://localhost:3000"
        print_status "Backend API: http://localhost:8000"
        print_status "Backend Docs: http://localhost:8000/docs"
        print_status "Press Ctrl+C to stop all services"
        
        # Wait for user to stop
        wait
        ;;
    "backend")
        setup_backend
        run_backend
        print_status "Backend is running. Press Ctrl+C to stop."
        wait $BACKEND_PID
        ;;
    "frontend")
        setup_frontend
        run_frontend
        print_status "Frontend is running. Press Ctrl+C to stop."
        wait $FRONTEND_PID
        ;;
    "contract")
        build_contract
        ;;
    "stop")
        stop_all
        ;;
    "status")
        show_status
        ;;
    "help"|*)
        show_help
        ;;
esac