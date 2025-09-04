from pathlib import Path
from multiversx_sdk import Transaction, Account, DevnetEntrypoint
from multiversx_sdk.core import Address
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from signing import ecdsa_signer
import binascii

# --- Helper: Convert bech32 address to raw bytes (32 bytes) ---
def bech32_to_bytes(addr: str) -> bytes:
    # Return the address bytes, not the public key bytes
    return bytes.fromhex(Address.from_bech32(addr).hex())

# --- Helper: Get address from Ed25519 public key ---
def get_address_from_public_key(public_key_bytes: bytes) -> str:
    """Convert Ed25519 public key to MultiversX address"""
    # MultiversX uses the first 20 bytes of the SHA256 hash of the public key
    import hashlib
    hash_bytes = hashlib.sha256(public_key_bytes).digest()[:20]
    # Pad to 32 bytes (add 12 zero bytes at the end)
    padded_hash = hash_bytes + b'\x00' * 12
    # Create address from the 32-byte padded hash
    return Address(padded_hash).bech32()

# --- Construct the message to sign (as required by the contract) ---
def construct_result_message(tournament_id: int, podium: list[str]) -> bytes:
    """
    Constructs the message to be signed for result submission:
    - 8 bytes: tournament_id (big endian)
    - Address bytes for each podium address (as managed buffer)
    """
    msg = tournament_id.to_bytes(8, "big")
    for addr in podium:
        # Get the address bytes (same as addr.as_managed_buffer() in the contract)
        addr_bytes = bytes.fromhex(Address.from_bech32(addr).hex())
        msg += addr_bytes
    return msg

# --- Encode contract call arguments ---
def encode_submit_results_args(tournament_id: int, podium: list[str], signature_hex: str) -> str:
    """
    Encodes the arguments for the submitResults contract call as required by MultiversX ABI.
    - tournament_id: u64, big endian, hex
    - podium: list of bech32 addresses, concatenated as 32-byte hex each
    - signature_hex: hex string
    Returns the data string for the contract call.
    """
    arg_tournament_id = tournament_id.to_bytes(8, "big").hex()
    arg_podium = "".join([Address.from_bech32(addr).hex() for addr in podium])
    arg_signature = signature_hex

    print(f"Encoded data: submitResults@{arg_tournament_id}@{arg_podium}@{arg_signature}")
    return f"submitResults@{arg_tournament_id}@{arg_podium}@{arg_signature}"

# Import configuration
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Config - use environment variables with fallbacks
API_URL = os.getenv("MX_API_URL", "https://devnet-api.multiversx.com")
CONTRACT_ADDRESS = os.getenv("MX_TOURNAMENT_CONTRACT", "erd1qqqqqqqqqqqqqpgq9zhclje8g8n6xlsaj0ds6xj87lt4rgtzd8sspxwzu7")
PEM_PATH = os.getenv("MX_PRIVATE_KEY_PATH", os.path.join(os.path.dirname(__file__), "..", "signing", "ed25519_private.pem"))
PRIVATE_KEY_BASE64 = os.getenv("MX_PRIVATE_KEY_BASE64")  # Alternative: private key as base64 env var
CHAIN_ID = os.getenv("MX_CHAIN_ID", "D")

# Debug information for environment variable loading (can be removed in production)
# print(f"DEBUG: MX_PRIVATE_KEY_BASE64 = {PRIVATE_KEY_BASE64}")
# print(f"DEBUG: MX_PRIVATE_KEY_BASE64 is None: {PRIVATE_KEY_BASE64 is None}")
# print(f"DEBUG: MX_PRIVATE_KEY_BASE64 is empty: {PRIVATE_KEY_BASE64 == ''}")
# print(f"DEBUG: MX_PRIVATE_KEY_BASE64 length: {len(PRIVATE_KEY_BASE64) if PRIVATE_KEY_BASE64 else 'N/A'}")
# print(f"DEBUG: PEM_PATH fallback: {PEM_PATH}")
# print(f"DEBUG: All environment variables starting with MX_:")
# for key, value in os.environ.items():
#     if key.startswith('MX_'):
#         print(f"  {key} = {value[:20]}..." if len(value) > 20 else f"  {key} = {value}")

def load_private_key():
    """
    Load private key from either environment variable (base64) or PEM file.
    Returns the private key bytes.
    """
    import base64
    
    if PRIVATE_KEY_BASE64:
        # Load from environment variable (base64 encoded)
        print("Loading private key from environment variable")
        try:
            private_key_bytes = base64.b64decode(PRIVATE_KEY_BASE64)
            return private_key_bytes
        except Exception as e:
            raise Exception(f"Failed to decode private key from environment variable: {e}")
    else:
        # Load from PEM file
        print(f"Loading private key from file: {PEM_PATH}")
        if not os.path.exists(PEM_PATH):
            raise Exception(f"Private key file not found: {PEM_PATH}")
        
        with open(PEM_PATH, 'r') as f:
            pem_content = f.read()
        
        lines = pem_content.strip().split('\n')
        if len(lines) >= 2:
            # Get the base64 encoded key (second line)
            base64_key = lines[1]
            # Decode the base64 key to get the raw bytes
            private_key_bytes = base64.b64decode(base64_key)
            return private_key_bytes
        else:
            raise Exception("Invalid PEM file format")

# --- Helper function to sign results for tournament ---
def sign_results_for_tournament(tournament_id: int, podium: list[str]) -> str:
    """
    Signs the results for a tournament and returns the signature as hex string.
    This function can be called from the game server to get the signature.
    """
    from multiversx_sdk import UserSecretKey
    
    # Load private key using the helper function
    private_key_bytes = load_private_key()
    
    # Create UserSecretKey from the decoded bytes
    secret_key = UserSecretKey(private_key_bytes)
    
    # Construct message as required by contract
    message = construct_result_message(tournament_id, podium)
    
    # Sign the result message using the MultiversX SDK
    signature = secret_key.sign(message)
    signature_hex = signature.hex()
    
    print(f"Signed results for tournament {tournament_id}: {signature_hex}")
    return signature_hex

# --- Submit results with pre-signed signature ---
def submit_results_to_contract_with_signature(tournament_id: int, podium: list[str], signature_hex: str):
    """
    Submits results to the contract using a pre-signed signature.
    This function can be called from the game server with a signature from sign_results_for_tournament.
    """
    from multiversx_sdk import UserSecretKey, Account, Transaction, DevnetEntrypoint, Address
    
    # Load private key using the helper function
    private_key_bytes = load_private_key()
    
    # Create UserSecretKey from the decoded bytes
    secret_key = UserSecretKey(private_key_bytes)
    
    # Create account with the secret key
    account = Account(secret_key)
    print("Loaded account address:", account.address.bech32())
    
    # Prepare contract call data
    data = encode_submit_results_args(tournament_id, podium, signature_hex)
    
    # Sign transaction with the same secret key
    try:
        from multiversx_sdk import ProxyNetworkProvider
        
        # Use ProxyNetworkProvider instead of DevnetEntrypoint
        provider = ProxyNetworkProvider(API_URL)
        
        # Get account info
        account_info = provider.get_account(account.address)
        account.nonce = account_info.nonce
        
        print(f"Account nonce: {account.nonce}")
        print(f"Account address: {account.address}")
        
        # Create transaction with proper format
        tx = Transaction(
            nonce=account.nonce,
            value=0,
            sender=account.address,
            receiver=Address.from_bech32(CONTRACT_ADDRESS),
            gas_price=1000000000,
            gas_limit=60000000,
            data=data.encode(),
            chain_id=CHAIN_ID,
            version=1,
        )
        
        # Sign the transaction using the account's secret key
        tx.signature = account.sign_transaction(tx)
        
        print(f"Transaction signed successfully")
        print(f"Transaction signature: {tx.signature.hex()}")
        
        # Send the signed transaction
        print(f"Sending transaction to blockchain...")
        tx_hash_result = provider.send_transaction(tx)
        
        if isinstance(tx_hash_result, bytes):
            tx_hash_result = tx_hash_result.hex()
        
        print(f"Transaction sent successfully!")
        print(f"Transaction hash: {tx_hash_result}")
        print(f"View on explorer: https://devnet-explorer.multiversx.com/transactions/{tx_hash_result}")
        
        return tx_hash_result
        
    except Exception as e:
        print(f"Error during transaction signing/sending: {e}")
        print(f"Transaction data: {data}")
        print(f"Signature: {signature_hex}")
        raise

# --- Main submission function ---
def submit_results_to_contract(tournament_id: int, podium: list[str], private_key=None):
    # Load Ed25519 private key using MultiversX SDK format
    from multiversx_sdk import UserSecretKey, Account, Transaction, DevnetEntrypoint, Address
    
    # Load private key using the helper function
    private_key_bytes = load_private_key()
    
    # Create UserSecretKey from the decoded bytes
    secret_key = UserSecretKey(private_key_bytes)
    
    # Create account with the secret key
    account = Account(secret_key)
    print("Loaded account address:", account.address.bech32())
    
    # Construct message as required by contract
    message = construct_result_message(tournament_id, podium)
    
    # Debug: Print the message being signed
    print(f"Message to sign (hex): {message.hex()}")
    print(f"Message length: {len(message)} bytes")
    print(f"Tournament ID: {tournament_id}")
    print(f"Podium addresses: {podium}")
    
    # Sign the result message using the MultiversX SDK
    signature = secret_key.sign(message)
    signature_hex = signature.hex()
    
    print(f"Signature (hex): {signature_hex}")
    print(f"Signature length: {len(signature)} bytes")
    
    # Prepare contract call data
    data = encode_submit_results_args(tournament_id, podium, signature_hex)
    
    # Sign transaction with the same secret key
    try:
        from multiversx_sdk import ProxyNetworkProvider
        
        # Use ProxyNetworkProvider instead of DevnetEntrypoint
        provider = ProxyNetworkProvider(API_URL)
        
        # Get account info
        account_info = provider.get_account(account.address)
        account.nonce = account_info.nonce
        
        print(f"Account nonce: {account.nonce}")
        print(f"Account address: {account.address}")
        
        # Create transaction with proper format
        tx = Transaction(
            nonce=account.nonce,
            value=0,
            sender=account.address,
            receiver=Address.from_bech32(CONTRACT_ADDRESS),
            gas_price=1000000000,
            gas_limit=60000000,
            data=data.encode(),
            chain_id=CHAIN_ID,
            version=1,
        )
        
        # Sign the transaction using the account's secret key
        tx.signature = account.sign_transaction(tx)
        
        print(f"Transaction signed successfully")
        print(f"Transaction signature: {tx.signature.hex()}")
        
        # Send the signed transaction
        print(f"Sending transaction to blockchain...")
        tx_hash_result = provider.send_transaction(tx)
        
        if isinstance(tx_hash_result, bytes):
            tx_hash_result = tx_hash_result.hex()
        
        print(f"Transaction sent successfully!")
        print(f"Transaction hash: {tx_hash_result}")
        print(f"View on explorer: https://devnet-explorer.multiversx.com/transactions/{tx_hash_result}")
        
        return tx_hash_result
        
    except Exception as e:
        print(f"Error during transaction signing/sending: {e}")
        print(f"Transaction data: {data}")
        print(f"Message to sign: {message.hex()}")
        print(f"Signature: {signature_hex}")
        raise

# Example usage:
if __name__ == "__main__":
    # Example data (replace with real values)
    tournament_id = 11
    podium = [
        "erd1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssycr6th",  # winner 1
    ]
    # Load private key for signing
    key_path = os.path.join(os.path.dirname(__file__), "..", "signing", "ed25519_private.pem")
    priv = ecdsa_signer.load_private_key_from_pem(key_path)
    submit_results_to_contract(tournament_id, podium, private_key=priv)