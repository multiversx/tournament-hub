from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
import uvicorn
import secrets
import os
from signing import ecdsa_signer
from cryptography.hazmat.primitives import serialization

app = FastAPI()

# Path to the private key file
PRIVATE_KEY_PATH = os.path.join(os.path.dirname(__file__), "signing", "ecdsa_private.pem")

# On startup, load or generate the private key
if not os.path.exists(PRIVATE_KEY_PATH):
    priv = ecdsa_signer.generate_private_key()
    ecdsa_signer.save_private_key_to_pem(priv, PRIVATE_KEY_PATH, password=None)
private_key = ecdsa_signer.load_private_key_from_pem(PRIVATE_KEY_PATH, password=None)

# In-memory session store (for demo)
sessions = {}

class StartSessionRequest(BaseModel):
    tournament_id: int
    players: List[str]

class SubmitResultsRequest(BaseModel):
    tournament_id: int
    podium: List[str]  # Ordered list of winner addresses

class VerifySignatureRequest(BaseModel):
    message: str  # The original message (string)
    signature: str  # Hex-encoded signature
    public_key_pem: str  # PEM-encoded public key

@app.post("/start_session")
def start_session(req: StartSessionRequest):
    if req.tournament_id in sessions:
        raise HTTPException(status_code=400, detail="Session already exists")
    sessions[req.tournament_id] = {
        "players": req.players,
        "status": "active"
    }
    print(f"Started session for tournament {req.tournament_id} with players: {req.players}")
    return {"status": "session_started"}

@app.post("/submit_results")
def submit_results(req: SubmitResultsRequest):
    if req.tournament_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    # In a real implementation, check that podium is valid, players participated, etc.
    # Create the message to sign
    message = f"tournament_id:{req.tournament_id};podium:{','.join(req.podium)}".encode()
    # Sign the message using ECDSA
    signature = ecdsa_signer.sign_message(private_key, message)
    signature_hex = signature.hex()
    print(f"Signed result for tournament {req.tournament_id}: {message} -> {signature_hex}")
    return {"tournament_id": req.tournament_id, "podium": req.podium, "signature": signature_hex}

@app.post("/verify_signature")
def verify_signature(req: VerifySignatureRequest):
    # Load public key from PEM
    try:
        public_key = serialization.load_pem_public_key(req.public_key_pem.encode())
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid public key: {e}")
    message_bytes = req.message.encode()
    signature_bytes = bytes.fromhex(req.signature)
    valid = ecdsa_signer.verify_signature(public_key, message_bytes, signature_bytes)
    return {"valid": valid}

@app.post("/send_to_contract")
def send_to_contract(req: SubmitResultsRequest):
    # In a real implementation, this would call the TournamentHub smart contract's submitResults endpoint
    print(f"Simulating contract call: submitResults({req.tournament_id}, {req.podium}, <signature>)")
    return {"status": "submitted_to_contract"}

@app.get("/public_key_pem")
def get_public_key_pem():
    pubkey = private_key.public_key()
    pem = pubkey.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )
    return {"public_key_pem": pem.decode()}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000) 