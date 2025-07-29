from pathlib import Path
from multiversx_sdk import Address, Transaction, Account, DevnetEntrypoint
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from signing import ecdsa_signer
import binascii

# --- Helper: Convert bech32 address to raw bytes (32 bytes) ---
def bech32_to_bytes(addr: str) -> bytes:
    return Address.from_bech32(addr).pubkey

# --- Construct the message to sign (as required by the contract) ---
def construct_result_message(tournament_id: int, podium: list[str]) -> bytes:
    """
    Constructs the message to be signed for result submission:
    - 8 bytes: tournament_id (big endian)
    - 32 bytes per podium address (raw address bytes)
    """
    msg = tournament_id.to_bytes(8, "big")
    for addr in podium:
        msg += bech32_to_bytes(addr)
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

# Config
API_URL = "https://devnet-api.multiversx.com"
CONTRACT_ADDRESS = "erd1qqqqqqqqqqqqqpgqeqv9v8fydgdh8arf6kfd5y7uvycv9kx3d8ssz87x92"
PEM_PATH = "alice.pem"  # Path to your PEM file
CHAIN_ID = "D"

# --- Main submission function ---
def submit_results_to_contract(tournament_id: int, podium: list[str], private_key=None):
    # Construct message as required by contract
    message = construct_result_message(tournament_id, podium)
    # Sign with Ed25519
    if private_key is None:
        # Load from default location (used for testing/demo)
        from signing import ecdsa_signer
        import os
        key_path = os.path.join(os.path.dirname(__file__), "..", "signing", "ed25519_private.pem")
        private_key = ecdsa_signer.load_private_key_from_pem(key_path)
    signature = ecdsa_signer.sign_message(private_key, message)
    signature_hex = signature.hex()
    # Prepare contract call data
    data = encode_submit_results_args(tournament_id, podium, signature_hex)
    # Load account from PEM
    account = Account.new_from_pem(Path(PEM_PATH))
    print("Loaded account address:", account.address.bech32())
    entrypoint = DevnetEntrypoint(url=API_URL)
    account.nonce = entrypoint.recall_account_nonce(account.address)
    print(f"Account nonce: {account.nonce}")
    print(f"Account address: {account.address}")
    # Build transaction
    tx = Transaction(
        nonce=account.get_nonce_then_increment(),
        value=0,
        sender=account.address,
        receiver=Address.from_bech32(CONTRACT_ADDRESS),
        gas_price=1000000000,
        gas_limit=60000000,
        data=data.encode(),
        chain_id=CHAIN_ID,
        version=1,
    )
    # Sign and send
    try:
        tx.signature = account.sign_transaction(tx)
        print("Transaction signed. Signature:", tx.signature.hex())
    except Exception as e:
        print("Error during signing:", e)
    tx_hash = entrypoint.send_transaction(tx)
    if isinstance(tx_hash, bytes):
        tx_hash = tx_hash.hex()
    print(f"Transaction sent! Hash: {tx_hash}")
    print(f"View on explorer: https://devnet-explorer.multiversx.com/transactions/{tx_hash}")
    return tx_hash

# Example usage:
if __name__ == "__main__":
    # Example data (replace with real values)
    tournament_id = 11
    podium = [
        "erd1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssycr6th",  # winner 1
    ]
    # Load private key for signing
    from signing import ecdsa_signer
    import os
    key_path = os.path.join(os.path.dirname(__file__), "..", "signing", "ed25519_private.pem")
    priv = ecdsa_signer.load_private_key_from_pem(key_path)
    submit_results_to_contract(tournament_id, podium, private_key=priv)