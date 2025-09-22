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

# Environment presets
# local      -> Frontend local (Vite), Backend local (uvicorn on 8000)
# devnet     -> Frontend local (Vite), Backend remote (https://devnet-tools.multiversx.com/tournament-hub)
# cloudflare -> Frontend built for Cloudflare, Backend remote (https://devnet-tools.multiversx.com/tournament-hub)
ENV_PRESET="${ENV_PRESET:-local}"

# Load env config if present
load_env_config() {
    if [ -f "config.sh" ]; then
        print_status "Loading environment from config.sh"
        # shellcheck disable=SC1091
        source ./config.sh
        if [ -n "${ENV_PRESET:-}" ]; then
            print_status "Using ENV_PRESET='${ENV_PRESET}' from environment/config"
        fi
    else
        print_warning "config.sh not found. Using current shell environment."
    fi
}

# Show notifier configuration summary
show_notifier_config() {
    if [ -n "${MX_AMQP_USER:-}" ] || [ -n "${MX_AMQP_URL:-}" ]; then
        print_status "Event Notifier subscriber: RabbitMQ (AMQP)"
        echo "  Host: ${MX_AMQP_HOST:-devnet-external-k8s-proxy.multiversx.com}"
        echo "  Port: ${MX_AMQP_PORT:-30006}"
        echo "  VHost: ${MX_AMQP_VHOST:-devnet2}"
        echo "  Exchange: ${MX_AMQP_EXCHANGE:-all_events}"
        echo "  Queue: ${MX_AMQP_QUEUE:-costin_queue_temporary}"
    else
        print_status "Event Notifier subscriber: WebSocket"
        echo "  WS URL: ${MX_NOTIFIER_WS_URL:-ws://localhost:5000/hub/ws}"
    fi
    if [ -n "${MX_TOURNAMENT_CONTRACT:-}" ]; then
        echo "  Contract filter: ${MX_TOURNAMENT_CONTRACT}"
    else
        echo "  Contract filter: (none)"
    fi
}

# Configure frontend environment for a given preset
configure_frontend_env() {
    local preset="$1"
    print_status "Configuring frontend env for preset: ${preset}"
    pushd tournament-hub-frontend >/dev/null
    case "$preset" in
        local)
            # Use local backend via Vite proxy
            echo "VITE_BACKEND_URL=/api" > .env.local
            ;;
        devnet|remote)
            # Use remote devnet backend
            echo "VITE_BACKEND_URL=https://devnet-tools.multiversx.com/tournament-hub" > .env.local
            ;;
        cloudflare)
            # Cloudflare build targets remote backend
            echo "VITE_BACKEND_URL=https://devnet-tools.multiversx.com/tournament-hub" > .env.local
            ;;
        *)
            print_warning "Unknown preset '$preset'. Falling back to local."
            echo "VITE_BACKEND_URL=/api" > .env.local
            ;;
    esac
    print_success "Wrote tournament-hub-frontend/.env.local"
    popd >/dev/null
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

# Function to cleanup processes on exit
cleanup_processes() {
    print_status "Cleaning up processes..."
    if [ -n "$BACKEND_PID" ] && kill -0 $BACKEND_PID 2>/dev/null; then
        print_status "Stopping backend server (PID: $BACKEND_PID)..."
        kill $BACKEND_PID 2>/dev/null
    fi
    if [ -n "$FRONTEND_PID" ] && kill -0 $FRONTEND_PID 2>/dev/null; then
        print_status "Stopping frontend server (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID 2>/dev/null
    fi
    # Also kill by port as backup
    kill_port 8000
    kill_port 3000
    print_success "Cleanup complete!"
    exit 0
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
    
    # Ensure virtual environment exists
    if [ ! -d "venv" ]; then
        print_status "Creating Python virtual environment..."
        python3 -m venv venv
    fi

    # Activate virtual environment
    source venv/bin/activate

    # Load environment variables from env.local if it exists
    if [ -f "env.local" ]; then
        print_status "Loading environment variables from env.local..."
        source env.local
        # Export all variables to make them available to the Python process
        export $(cat env.local | grep -v '^#' | grep -v '^$' | xargs)
    else
        print_warning "env.local not found. Using default environment variables."
    fi

    # Ensure dependencies (update in case requirements changed)
    print_status "Installing/updating Python dependencies..."
    pip install -r requirements.txt
    
    # Start the server
    print_status "Starting FastAPI server on port 8000..."
    python main.py &
    BACKEND_PID=$!
    export BACKEND_PID
    
    # Wait for server to start with multiple attempts
    print_status "Waiting for backend server to start..."
    local attempts=0
    local max_attempts=30  # 30 seconds total
    
    while [ $attempts -lt $max_attempts ]; do
        if curl -s http://localhost:8000/ >/dev/null 2>&1; then
            print_success "Backend server started successfully!"
            print_status "Backend API docs: http://localhost:8000/docs"
            cd ..
            return 0
        fi
        sleep 1
        attempts=$((attempts + 1))
        if [ $((attempts % 5)) -eq 0 ]; then
            print_status "Still waiting for backend server... (${attempts}s)"
        fi
    done
    
    print_error "Failed to start backend server after ${max_attempts} seconds"
    print_error "Please check the server logs for errors"
    cd ..
    exit 1
}

# Function to run frontend
run_frontend() {
    print_status "Starting frontend development server..."
    
    cd tournament-hub-frontend
    
    # Kill existing process on port 3000
    kill_port 3000
    
    # Export VITE_BACKEND_URL based on preset to ensure dev server picks it up
    case "${ENV_PRESET}" in
      devnet|remote)
        export VITE_BACKEND_URL="https://devnet-tools.multiversx.com/tournament-hub"
        ;;
      cloudflare)
        export VITE_BACKEND_URL="https://devnet-tools.multiversx.com/tournament-hub"
        ;;
      *)
        export VITE_BACKEND_URL="/api"
        ;;
    esac

    print_status "VITE_BACKEND_URL=${VITE_BACKEND_URL}"

    # Start the development server
    print_status "Starting Vite dev server on port 3000 (HTTPS)..."
    PORT=3000 npm run dev &
    FRONTEND_PID=$!
    export FRONTEND_PID
    
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
    echo "  run         - Run backend (with notifier subscriber) and frontend servers"
    echo "  backend     - Set up and run only the backend server"
    echo "  frontend    - Set up and run only the frontend server"
    echo "  contract    - Build the smart contract"
    echo "  stop        - Stop all running services"
    echo "  status      - Show status of running services"
    echo "  help        - Show this help message"
    echo ""
    echo "Environment presets (set ENV_PRESET before command):"
    echo "  local      - Frontend local (Vite), Backend local (default)"
    echo "  devnet     - Frontend local (Vite), Backend remote (devnet tools)"
    echo "  cloudflare - Frontend build for Cloudflare, Backend remote (devnet tools)"
    echo ""
    echo "Examples:"
    echo "  $0 setup                       # Set up everything"
    echo "  $0 run                         # Run local frontend + backend"
    echo "  ENV_PRESET=devnet $0 run       # Run local frontend against devnet backend"
    echo "  ENV_PRESET=cloudflare $0 setup # Prepare env for Cloudflare build"
    echo "  $0 backend                     # Run only backend"
    echo "  $0 stop                        # Stop all services"
}

# Main script logic
case "${1:-help}" in
    "setup")
        print_status "Setting up Tournament Hub project..."
        load_env_config
        configure_frontend_env "${ENV_PRESET}"
        setup_backend
        setup_frontend
        build_contract
        print_success "Setup complete! Run '$0 run' to start the application."
        ;;
    "run")
        print_status "Starting Tournament Hub application..."
        load_env_config
        configure_frontend_env "${ENV_PRESET}"
        show_notifier_config
        
        # Initialize PIDs
        BACKEND_PID=""
        FRONTEND_PID=""
        
        if [ "${ENV_PRESET}" = "local" ]; then
            run_backend
            run_frontend
        elif [ "${ENV_PRESET}" = "devnet" ] || [ "${ENV_PRESET}" = "remote" ]; then
            print_status "Preset '${ENV_PRESET}': using remote backend. Running only frontend."
            run_frontend
        elif [ "${ENV_PRESET}" = "cloudflare" ]; then
            print_status "Preset 'cloudflare': configure env for build. Not starting local servers."
            print_status "To build for Cloudflare: cd tournament-hub-frontend && npm run build"
            exit 0
        else
            print_warning "Unknown preset '${ENV_PRESET}', defaulting to local."
            run_backend
            run_frontend
        fi
        print_success "Tournament Hub is now running!"
        print_status "Frontend: https://localhost:3000"
        if [ "${ENV_PRESET}" = "local" ]; then
          print_status "Backend API: http://localhost:8000"
          print_status "Backend Docs: http://localhost:8000/docs"
        else
          print_status "Backend API: https://devnet-tools.multiversx.com/tournament-hub"
          print_status "Backend Docs: https://devnet-tools.multiversx.com/tournament-hub/openapi.json"
        fi
        print_status "Press Ctrl+C to stop all services"
        
        # Set up signal handler for cleanup
        trap 'cleanup_processes' INT TERM
        
        # Wait for processes
        if [ -n "$BACKEND_PID" ] && [ -n "$FRONTEND_PID" ]; then
            wait $BACKEND_PID $FRONTEND_PID
        elif [ -n "$BACKEND_PID" ]; then
            wait $BACKEND_PID
        elif [ -n "$FRONTEND_PID" ]; then
            wait $FRONTEND_PID
        else
            wait
        fi
        ;;
    "backend")
        load_env_config
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