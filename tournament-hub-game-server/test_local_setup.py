#!/usr/bin/env python3
"""
Setup script for local testing of blockchain submission functionality
This script helps you set up the environment for testing without deploying to devnet
"""

import os
import sys
import subprocess
from pathlib import Path

def check_environment():
    """Check if the environment is set up correctly for testing"""
    print("🔍 Checking Environment Setup...")
    print("-" * 40)
    
    # Check if we're in the right directory
    current_dir = os.getcwd()
    print(f"Current directory: {current_dir}")
    
    # Check if virtual environment exists
    venv_path = Path("venv")
    if venv_path.exists():
        print("✅ Virtual environment found")
    else:
        print("❌ Virtual environment not found")
        return False
    
    # Check if required files exist
    required_files = [
        "contract/submit_results.py",
        "tictactoe_game_engine.py",
        "signing/ed25519_private.pem"
    ]
    
    for file_path in required_files:
        if Path(file_path).exists():
            print(f"✅ {file_path} found")
        else:
            print(f"❌ {file_path} not found")
            if file_path == "signing/ed25519_private.pem":
                print("   This is required for testing. Please create it or set MX_PRIVATE_KEY_BASE64")
    
    return True

def setup_environment():
    """Set up environment variables for local testing"""
    print("\n🌍 Setting up Environment Variables...")
    print("-" * 40)
    
    # Set default environment variables for local testing
    env_vars = {
        "MX_API_URL": "https://devnet-api.multiversx.com",
        "MX_CHAIN_ID": "D",
        "MX_TOURNAMENT_CONTRACT": "erd1qqqqqqqqqqqqqpgq9zhclje8g8n6xlsaj0ds6xj87lt4rgtzd8sspxwzu7"
    }
    
    for key, value in env_vars.items():
        if not os.getenv(key):
            os.environ[key] = value
            print(f"✅ Set {key} = {value}")
        else:
            print(f"✅ {key} already set")
    
    # Check for private key
    if not os.getenv("MX_PRIVATE_KEY_BASE64"):
        pem_path = Path("signing/ed25519_private.pem")
        if pem_path.exists():
            print("✅ Private key file found, will use PEM file")
        else:
            print("⚠️  No private key found. You need either:")
            print("   1. MX_PRIVATE_KEY_BASE64 environment variable, or")
            print("   2. signing/ed25519_private.pem file")
            return False
    
    return True

def run_tests():
    """Run the test suite"""
    print("\n🧪 Running Test Suite...")
    print("-" * 40)
    
    # Get the Python executable from the virtual environment
    venv_python = os.path.join("venv", "bin", "python")
    if not os.path.exists(venv_python):
        venv_python = os.path.join("venv", "Scripts", "python.exe")  # Windows
    
    if not os.path.exists(venv_python):
        print("❌ Virtual environment Python not found")
        return False
    
    print(f"Using Python: {venv_python}")
    
    # Run the blockchain submission tests
    print("Running blockchain submission tests...")
    result = subprocess.run([venv_python, "test_blockchain_submission.py"], 
                          capture_output=True, text=True)
    
    if result.returncode == 0:
        print("✅ Blockchain submission tests passed")
        print(result.stdout)
    else:
        print("❌ Blockchain submission tests failed")
        print(result.stderr)
        return False
    
    # Run the TicTacToe integration tests
    print("\nRunning TicTacToe integration tests...")
    result = subprocess.run([venv_python, "test_tictactoe_integration.py"], 
                          capture_output=True, text=True)
    
    if result.returncode == 0:
        print("✅ TicTacToe integration tests passed")
        print(result.stdout)
    else:
        print("❌ TicTacToe integration tests failed")
        print(result.stderr)
        return False
    
    return True

def main():
    """Main setup and test function"""
    print("🚀 Local Testing Setup for Blockchain Submission")
    print("=" * 50)
    print("This script will help you test blockchain functionality locally")
    print("before deploying to devnet.")
    print()
    
    # Step 1: Check environment
    if not check_environment():
        print("\n❌ Environment check failed. Please fix the issues above.")
        return False
    
    # Step 2: Setup environment
    if not setup_environment():
        print("\n❌ Environment setup failed. Please fix the issues above.")
        return False
    
    # Step 3: Run tests
    if not run_tests():
        print("\n❌ Tests failed. Please fix the issues before deploying.")
        return False
    
    print("\n🎉 All tests passed!")
    print("Your blockchain submission functionality is working correctly.")
    print("You can now deploy to devnet with confidence.")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
