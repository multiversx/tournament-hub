import nacl.signing
import nacl.encoding
import nacl.exceptions
import base64
from cryptography.hazmat.primitives import serialization
import os

# --- Key Generation ---
def generate_private_key():
    """Generate a new Ed25519 private key."""
    return nacl.signing.SigningKey.generate()

# --- Key Serialization ---
def save_private_key_to_pem(private_key, filepath, password=None):
    """Save Ed25519 private key to PEM file."""
    # Export as raw bytes
    raw = private_key.encode()
    # Wrap in PEM format
    pem = b"-----BEGIN ED25519 PRIVATE KEY-----\n" + base64.encodebytes(raw) + b"-----END ED25519 PRIVATE KEY-----\n"
    with open(filepath, "wb") as f:
        f.write(pem)

def load_private_key_from_pem(filepath, password=None):
    """Load Ed25519 private key from PEM file."""
    with open(filepath, "rb") as f:
        pem_data = f.read()
    # Extract base64 part
    lines = pem_data.split(b"\n")
    b64 = b"".join([line for line in lines if b"-----" not in line and line.strip()])
    raw = base64.b64decode(b64)
    return nacl.signing.SigningKey(raw)

# --- Signing ---
def sign_message(private_key, message: bytes) -> bytes:
    """Sign a message with Ed25519 private key. Returns raw signature bytes."""
    signed = private_key.sign(message)
    return signed.signature

# --- Verification ---
def verify_signature(public_key, message: bytes, signature: bytes) -> bool:
    """Verify Ed25519 signature. public_key can be nacl.signing.VerifyKey or raw bytes."""
    try:
        if not isinstance(public_key, nacl.signing.VerifyKey):
            public_key = nacl.signing.VerifyKey(public_key)
        public_key.verify(message, signature)
        return True
    except nacl.exceptions.BadSignatureError:
        return False

# --- Public Key Export/Import ---
def get_public_key_pem(private_key):
    """Export Ed25519 public key as PEM."""
    pubkey = private_key.verify_key.encode()
    pem = b"-----BEGIN ED25519 PUBLIC KEY-----\n" + base64.encodebytes(pubkey) + b"-----END ED25519 PUBLIC KEY-----\n"
    return pem

def load_public_key_from_pem(pem_data: bytes):
    lines = pem_data.split(b"\n")
    b64 = b"".join([line for line in lines if b"-----" not in line and line.strip()])
    raw = base64.b64decode(b64)
    return nacl.signing.VerifyKey(raw)

# --- Example Usage ---
if __name__ == "__main__":
    # Generate and save a key
    priv = generate_private_key()
    save_private_key_to_pem(priv, "ed25519_private.pem", password=None)
    # Load the key
    priv2 = load_private_key_from_pem("ed25519_private.pem")
    pub = priv2.verify_key
    # Sign and verify
    msg = b"test message"
    sig = sign_message(priv2, msg)
    # Verify the signature
    is_valid = verify_signature(pub, msg, sig)
    
    # Export public key PEM
    pub_pem = get_public_key_pem(priv2) 