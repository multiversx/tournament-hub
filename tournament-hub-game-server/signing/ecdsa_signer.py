from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature, decode_dss_signature
from cryptography.hazmat.backends import default_backend
from cryptography.exceptions import InvalidSignature
import os

# --- Key Generation ---
def generate_private_key():
    """Generate a new ECDSA private key (secp256k1)."""
    return ec.generate_private_key(ec.SECP256K1(), default_backend())

# --- Key Serialization ---
def save_private_key_to_pem(private_key, filepath, password=None):
    pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.BestAvailableEncryption(password.encode()) if password else serialization.NoEncryption()
    )
    with open(filepath, "wb") as f:
        f.write(pem)

def load_private_key_from_pem(filepath, password=None):
    with open(filepath, "rb") as f:
        pem_data = f.read()
    return serialization.load_pem_private_key(pem_data, password=password.encode() if password else None, backend=default_backend())

# --- Signing ---
def sign_message(private_key, message: bytes) -> bytes:
    signature = private_key.sign(message, ec.ECDSA(hashes.SHA256()))
    # Optionally, encode as r,s tuple
    r, s = decode_dss_signature(signature)
    return r.to_bytes(32, 'big') + s.to_bytes(32, 'big')

# --- Verification ---
def verify_signature(public_key, message: bytes, signature: bytes) -> bool:
    try:
        # Decode r,s from signature
        r = int.from_bytes(signature[:32], 'big')
        s = int.from_bytes(signature[32:], 'big')
        der_sig = encode_dss_signature(r, s)
        public_key.verify(der_sig, message, ec.ECDSA(hashes.SHA256()))
        return True
    except InvalidSignature:
        return False

# --- Example Usage ---
if __name__ == "__main__":
    # Generate and save a key
    priv = generate_private_key()
    save_private_key_to_pem(priv, "ecdsa_private.pem", password=None)
    # Load the key
    priv2 = load_private_key_from_pem("ecdsa_private.pem")
    pub = priv2.public_key()
    # Sign and verify
    msg = b"test message"
    sig = sign_message(priv2, msg)
    print("Signature valid:", verify_signature(pub, msg, sig)) 