#!/usr/bin/env python3
"""
Test script to verify blockchain transaction submission functionality locally
This tests the submit_results.py functions without needing to deploy to devnet
"""

import os
import sys
import time
import json
from pathlib import Path

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(__file__))

# Import the functions we want to test
from contract.submit_results import (
    load_private_key,
    sign_results_for_tournament,
    submit_results_to_contract_with_signature,
    construct_result_message,
    encode_submit_results_args,
    bech32_to_bytes
)

def test_private_key_loading():
    """Test private key loading functionality"""
    print("🔑 Testing Private Key Loading...")
    print("-" * 40)
    
    try:
        # Test loading private key
        private_key_bytes = load_private_key()
        print(f"✅ Private key loaded successfully")
        print(f"   Key length: {len(private_key_bytes)} bytes")
        print(f"   Key type: {type(private_key_bytes)}")
        return True
    except Exception as e:
        print(f"❌ Failed to load private key: {e}")
        return False

def test_bech32_conversion():
    """Test bech32 address conversion functionality"""
    print("\n🏠 Testing Bech32 Address Conversion...")
    print("-" * 40)
    
    test_address = "erd1thvc8uzzdvkq4nuvqygfdkqu32evkkh3fdtt8hc672085ed3dthqhrkvvm"
    
    try:
        # Test bech32_to_bytes function
        addr_bytes = bech32_to_bytes(test_address)
        print(f"✅ Bech32 conversion successful")
        print(f"   Input: {test_address}")
        print(f"   Output length: {len(addr_bytes)} bytes")
        print(f"   Output (first 20 bytes): {addr_bytes[:20].hex()}")
        return True
    except Exception as e:
        print(f"❌ Failed to convert bech32 address: {e}")
        return False

def test_message_construction():
    """Test message construction for signing"""
    print("\n📝 Testing Message Construction...")
    print("-" * 40)
    
    tournament_id = 123
    podium = [
        "erd1thvc8uzzdvkq4nuvqygfdkqu32evkkh3fdtt8hc672085ed3dthqhrkvvm",
        "erd19npdl5d964l6ausfm7l78lj5jrg0sk8wml6t7sjs5rl7hlpjqpjsee0fps"
    ]
    
    try:
        # Test message construction
        message = construct_result_message(tournament_id, podium)
        print(f"✅ Message constructed successfully")
        print(f"   Tournament ID: {tournament_id}")
        print(f"   Podium: {podium}")
        print(f"   Message length: {len(message)} bytes")
        print(f"   Message (hex): {message.hex()}")
        return True
    except Exception as e:
        print(f"❌ Failed to construct message: {e}")
        return False

def test_signature_generation():
    """Test signature generation"""
    print("\n✍️ Testing Signature Generation...")
    print("-" * 40)
    
    tournament_id = 123
    podium = [
        "erd1thvc8uzzdvkq4nuvqygfdkqu32evkkh3fdtt8hc672085ed3dthqhrkvvm"
    ]
    
    try:
        # Test signature generation
        signature = sign_results_for_tournament(tournament_id, podium)
        print(f"✅ Signature generated successfully")
        print(f"   Tournament ID: {tournament_id}")
        print(f"   Podium: {podium}")
        print(f"   Signature length: {len(signature)} characters")
        print(f"   Signature (first 20 chars): {signature[:20]}...")
        return True
    except Exception as e:
        print(f"❌ Failed to generate signature: {e}")
        return False

def test_contract_call_encoding():
    """Test contract call argument encoding"""
    print("\n📋 Testing Contract Call Encoding...")
    print("-" * 40)
    
    tournament_id = 123
    podium = [
        "erd1thvc8uzzdvkq4nuvqygfdkqu32evkkh3fdtt8hc672085ed3dthqhrkvvm"
    ]
    signature_hex = "577cafce2a6e18e0273ddc173ebf1bdb93b586459119a5466e980b4ddb753446889110ac6a97469fa20fd3eb144b128b40d58552b5181bf544bf6f85b1016703"
    
    try:
        # Test contract call encoding
        encoded_data = encode_submit_results_args(tournament_id, podium, signature_hex)
        print(f"✅ Contract call encoded successfully")
        print(f"   Tournament ID: {tournament_id}")
        print(f"   Podium: {podium}")
        print(f"   Signature: {signature_hex[:20]}...")
        print(f"   Encoded data: {encoded_data}")
        return True
    except Exception as e:
        print(f"❌ Failed to encode contract call: {e}")
        return False

def test_full_flow():
    """Test the complete flow without actually submitting to blockchain"""
    print("\n🔄 Testing Complete Flow (Dry Run)...")
    print("-" * 40)
    
    tournament_id = 123
    podium = [
        "erd1thvc8uzzdvkq4nuvqygfdkqu32evkkh3fdtt8hc672085ed3dthqhrkvvm"
    ]
    
    try:
        # Step 1: Construct message
        print("1. Constructing message...")
        message = construct_result_message(tournament_id, podium)
        print(f"   ✅ Message length: {len(message)} bytes")
        
        # Step 2: Generate signature
        print("2. Generating signature...")
        signature = sign_results_for_tournament(tournament_id, podium)
        print(f"   ✅ Signature generated: {signature[:20]}...")
        
        # Step 3: Encode contract call
        print("3. Encoding contract call...")
        encoded_data = encode_submit_results_args(tournament_id, podium, signature)
        print(f"   ✅ Contract call encoded")
        
        # Step 4: Test account loading (without submitting)
        print("4. Testing account loading...")
        from multiversx_sdk import UserSecretKey, Account
        
        private_key_bytes = load_private_key()
        secret_key = UserSecretKey(private_key_bytes)
        account = Account(secret_key)
        print(f"   ✅ Account loaded: {account.address}")
        
        print("\n🎉 Complete flow test successful!")
        print("   All functions are working correctly.")
        print("   Ready for devnet deployment!")
        
        return True
        
    except Exception as e:
        print(f"❌ Complete flow test failed: {e}")
        return False

def test_environment_variables():
    """Test environment variable configuration"""
    print("\n🌍 Testing Environment Variables...")
    print("-" * 40)
    
    # Check if we're in the right environment
    print(f"Current working directory: {os.getcwd()}")
    print(f"Python path: {sys.path[0]}")
    
    # Check environment variables
    env_vars = [
        "MX_PRIVATE_KEY_BASE64",
        "MX_API_URL", 
        "MX_CHAIN_ID",
        "MX_TOURNAMENT_CONTRACT"
    ]
    
    for var in env_vars:
        value = os.getenv(var)
        if value:
            if var == "MX_PRIVATE_KEY_BASE64":
                print(f"✅ {var}: {'*' * 20}... (hidden)")
            else:
                print(f"✅ {var}: {value}")
        else:
            print(f"⚠️  {var}: Not set (using default)")
    
    return True

def main():
    """Run all tests"""
    print("🧪 Blockchain Submission Test Suite")
    print("=" * 50)
    print("Testing blockchain transaction functionality locally...")
    print("This will NOT submit actual transactions to devnet.")
    print()
    
    # Set up environment for local testing
    os.environ.setdefault("MX_API_URL", "https://devnet-api.multiversx.com")
    os.environ.setdefault("MX_CHAIN_ID", "D")
    os.environ.setdefault("MX_TOURNAMENT_CONTRACT", "erd1qqqqqqqqqqqqqpgq9zhclje8g8n6xlsaj0ds6xj87lt4rgtzd8sspxwzu7")
    
    # Check if private key is available
    if not os.getenv("MX_PRIVATE_KEY_BASE64"):
        print("⚠️  MX_PRIVATE_KEY_BASE64 not set. Using PEM file fallback.")
        print("   Make sure you have a private key file at: signing/ed25519_private.pem")
    
    tests = [
        ("Environment Variables", test_environment_variables),
        ("Private Key Loading", test_private_key_loading),
        ("Bech32 Conversion", test_bech32_conversion),
        ("Message Construction", test_message_construction),
        ("Signature Generation", test_signature_generation),
        ("Contract Call Encoding", test_contract_call_encoding),
        ("Complete Flow", test_full_flow)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
            else:
                print(f"❌ {test_name} failed")
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {e}")
    
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Ready for devnet deployment.")
        return True
    else:
        print("💥 Some tests failed. Please fix issues before deploying.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
