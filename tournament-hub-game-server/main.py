import logging
import time
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, ValidationError
from typing import List
import uvicorn
import secrets
import os
import traceback
import sys
sys.path.insert(0, os.path.dirname(__file__))
from signing import ecdsa_signer
from multiversx_sdk import Address
from contract.submit_results import submit_results_to_contract
from fastapi.middleware.cors import CORSMiddleware

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Or specify ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Path to the private key file
PRIVATE_KEY_PATH = os.path.join(os.path.dirname(__file__), "signing", "ed25519_private.pem")

# On startup, load or generate the private key
if not os.path.exists(PRIVATE_KEY_PATH):
    priv = ecdsa_signer.generate_private_key()
    ecdsa_signer.save_private_key_to_pem(priv, PRIVATE_KEY_PATH)
private_key = ecdsa_signer.load_private_key_from_pem(PRIVATE_KEY_PATH)

# In-memory session store (for demo)
sessions = {}

# In-memory tournament store (for demo - in production, use a database)
tournaments = {}
next_tournament_id = 1

# --- Error Response Model ---
def error_response(error: str, details: str = "", code: str = "", status_code: int = 400):
    resp = {"error": error}
    if details:
        resp["details"] = details
    if code:
        resp["code"] = code
    return JSONResponse(status_code=status_code, content=resp)

# --- Global Exception Handlers ---
@app.exception_handler(Exception)
def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}\n{traceback.format_exc()}")
    return error_response(
        error="Internal server error",
        details=str(exc),
        code="INTERNAL_ERROR",
        status_code=500
    )

@app.exception_handler(RequestValidationError)
def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning(f"Validation error: {exc.errors()}")
    return error_response(
        error="Validation error",
        details=str(exc),
        code="VALIDATION_ERROR",
        status_code=422
    )

# --- Input Validators ---
def validate_bech32_address(addr: str):
    try:
        Address.from_bech32(addr)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid Bech32 address: {addr}")

def validate_hex_signature(sig: str):
    try:
        bytes.fromhex(sig)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid hex signature format")

class StartSessionRequest(BaseModel):
    tournament_id: int
    players: List[str]

    def validate(self):
        for addr in self.players:
            validate_bech32_address(addr)

class SignResultsRequest(BaseModel):
    tournament_id: int
    podium: List[str]  # Ordered list of winner addresses

    def validate(self):
        for addr in self.podium:
            validate_bech32_address(addr)

class SubmitResultsRequest(BaseModel):
    tournament_id: int
    podium: List[str]  # Ordered list of winner addresses
    # signature: str  # Hex-encoded signature

    def validate(self):
        for addr in self.podium:
            validate_bech32_address(addr)
        # validate_hex_signature(self.signature)

class VerifySignatureRequest(BaseModel):
    tournament_id: int
    podium: List[str]  # Ordered list of winner addresses
    signature: str  # Hex-encoded signature
    public_key_pem: str  # PEM-encoded Ed25519 public key

    def validate(self):
        for addr in self.podium:
            validate_bech32_address(addr)
        validate_hex_signature(self.signature)

class CreateTournamentRequest(BaseModel):
    game_id: int
    entry_fee: str  # EGLD amount in wei
    prize_pool: str  # EGLD amount in wei
    join_deadline: int  # Unix timestamp
    start_time: int  # Unix timestamp
    end_time: int  # Unix timestamp

class JoinTournamentRequest(BaseModel):
    player_address: str

    def validate(self):
        validate_bech32_address(self.player_address)

@app.post("/start_session")
def start_session(req: StartSessionRequest):
    try:
        req.validate()
    except HTTPException as e:
        logger.warning(f"Start session validation failed: {e.detail}")
        return error_response("Invalid input", e.detail, code="INVALID_INPUT", status_code=400)
    if req.tournament_id in sessions:
        logger.info(f"Session already exists for tournament {req.tournament_id}")
        return error_response("Session already exists", f"Tournament ID {req.tournament_id}", code="SESSION_EXISTS", status_code=400)
    player_addresses = [Address.from_bech32(addr) for addr in req.players]
    logger.info(f"Started session for tournament {req.tournament_id} with players: {req.players}")
    sessions[req.tournament_id] = {
        "players": player_addresses,
        "status": "active"
    }
    return {"status": "session_started"}

@app.post("/sign_results")
def sign_results(req: SignResultsRequest):
    try:
        req.validate()
    except HTTPException as e:
        logger.warning(f"Sign results validation failed: {e.detail}")
        return error_response("Invalid input", e.detail, code="INVALID_INPUT", status_code=400)
    if req.tournament_id not in sessions:
        logger.info(f"Session not found for tournament {req.tournament_id}")
        return error_response("Session not found", f"Tournament ID {req.tournament_id}", code="SESSION_NOT_FOUND", status_code=404)
    # Construct message: tournament_id (8 bytes big-endian) + raw address bytes for each podium entry
    message = bytearray()
    message.extend(req.tournament_id.to_bytes(8, 'big'))
    for addr_str in req.podium:
        addr = Address.from_bech32(addr_str)
        message.extend(addr.pubkey)
    signature = ecdsa_signer.sign_message(private_key, bytes(message))
    signature_hex = signature.hex()
    logger.info(f"Signed result for tournament {req.tournament_id}: {message.hex()} -> {signature_hex}")
    return {"tournament_id": req.tournament_id, "podium": req.podium, "signature": signature_hex, "message_hex": message.hex()}

@app.post("/submit_results")
def submit_results(req: SubmitResultsRequest):
    try:
        req.validate()
    except HTTPException as e:
        logger.warning(f"Submit results validation failed: {e.detail}")
        return error_response("Invalid input", e.detail, code="INVALID_INPUT", status_code=400)
    if req.tournament_id not in sessions:
        logger.info(f"Session not found for tournament {req.tournament_id}")
        return error_response("Session not found", f"Tournament ID {req.tournament_id}", code="SESSION_NOT_FOUND", status_code=404)
    # Construct message: tournament_id (nested encoding, 8 bytes big-endian) + raw address bytes for each podium entry
    message = bytearray()
    message.extend(req.tournament_id.to_bytes(8, 'big'))
    for addr_str in req.podium:
        addr = Address.from_bech32(addr_str)
        message.extend(addr.pubkey)
    signature = ecdsa_signer.sign_message(private_key, bytes(message))
    signature_hex = signature.hex()
    logger.info(f"Signed result for tournament {req.tournament_id}: {message.hex()} -> {signature_hex}")
    return {"tournament_id": req.tournament_id, "podium": req.podium, "signature": signature_hex,  "message_hex": message.hex()}

@app.post("/verify_signature")
def verify_signature(req: VerifySignatureRequest):
    try:
        req.validate()
    except HTTPException as e:
        logger.warning(f"Verify signature validation failed: {e.detail}")
        return error_response("Invalid input", e.detail, code="INVALID_INPUT", status_code=400)
    try:
        public_key = ecdsa_signer.load_public_key_from_pem(req.public_key_pem.encode())
    except Exception as e:
        logger.warning(f"Invalid public key: {e}")
        return error_response("Invalid public key", str(e), code="INVALID_PUBLIC_KEY", status_code=400)
    # Construct message: tournament_id (8 bytes big-endian) + raw address bytes for each podium entry
    message = bytearray()
    message.extend(req.tournament_id.to_bytes(8, 'big'))
    for addr_str in req.podium:
        addr = Address.from_bech32(addr_str)
        message.extend(addr.pubkey)
    signature_bytes = bytes.fromhex(req.signature)
    valid = ecdsa_signer.verify_signature(public_key, bytes(message), signature_bytes)
    return {"valid": valid}

@app.post("/send_to_contract")
def send_to_contract(req: SubmitResultsRequest):
    try:
        req.validate()
    except HTTPException as e:
        logger.warning(f"Send to contract validation failed: {e.detail}")
        return error_response("Invalid input", e.detail, code="INVALID_INPUT", status_code=400)
    try:
        tx_hash = submit_results_to_contract(req.tournament_id, req.podium)
    except Exception as e:
        logger.error(f"Contract call failed: {e}\n{traceback.format_exc()}")
        return error_response(
            "Contract call failed",
            details=str(e),
            code="CONTRACT_CALL_ERROR",
            status_code=500
        )
    logger.info(f"Tournament {req.tournament_id} submitted to contract with tx hash: {tx_hash}")
    logger.info(f"Podium: {req.podium}")
    # logger.info(f"Signature: {req.signature}")
    return {"status": "submitted_to_contract", "tx_hash": tx_hash}

@app.get("/public_key_pem")
def get_public_key_pem():
    pem = ecdsa_signer.get_public_key_pem(private_key)
    return {"public_key_pem": pem.decode()}

# Frontend API endpoints
@app.get("/tournaments")
def get_tournaments():
    """Get all tournaments"""
    global tournaments
    return list(tournaments.values())

@app.get("/tournaments/{tournament_id}")
def get_tournament(tournament_id: int):
    """Get a specific tournament"""
    global tournaments
    if tournament_id not in tournaments:
        raise HTTPException(status_code=404, detail="Tournament not found")
    return tournaments[tournament_id]

@app.post("/create_tournament")
def create_tournament(request: CreateTournamentRequest):
    """Create a new tournament"""
    global tournaments, next_tournament_id
    
    tournament = {
        "id": next_tournament_id,
        "game_id": request.game_id,
        "entry_fee": request.entry_fee,
        "prize_pool": request.prize_pool,
        "status": "created",
        "join_deadline": request.join_deadline,
        "start_time": request.start_time,
        "end_time": request.end_time,
        "players": [],
        "created_at": int(time.time())
    }
    
    tournaments[next_tournament_id] = tournament
    next_tournament_id += 1
    
    logger.info(f"Created tournament {tournament['id']}: {tournament}")
    return {"status": "created", "tournament_id": tournament['id'], "tournament": tournament}

@app.post("/join_tournament/{tournament_id}")
def join_tournament(tournament_id: int, request: JoinTournamentRequest):
    """Join a tournament"""
    global tournaments
    
    if tournament_id not in tournaments:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    tournament = tournaments[tournament_id]
    
    if tournament["status"] != "created":
        raise HTTPException(status_code=400, detail="Tournament is not accepting players")
    
    if int(time.time()) > tournament["join_deadline"]:
        raise HTTPException(status_code=400, detail="Join deadline has passed")
    
    if request.player_address in tournament["players"]:
        raise HTTPException(status_code=400, detail="Player already joined")
    
    try:
        request.validate()
    except HTTPException as e:
        return error_response("Invalid player address", e.detail, code="INVALID_ADDRESS", status_code=400)
    
    tournament["players"].append(request.player_address)
    tournaments[tournament_id] = tournament
    
    logger.info(f"Player {request.player_address} joined tournament {tournament_id}")
    return {"status": "joined", "tournament_id": tournament_id, "player": request.player_address}

@app.post("/start_tournament/{tournament_id}")
def start_tournament(tournament_id: int):
    """Start a tournament"""
    global tournaments
    
    if tournament_id not in tournaments:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    tournament = tournaments[tournament_id]
    
    if tournament["status"] != "created":
        raise HTTPException(status_code=400, detail="Tournament cannot be started")
    
    if int(time.time()) < tournament["start_time"]:
        raise HTTPException(status_code=400, detail="Tournament start time has not been reached")
    
    if len(tournament["players"]) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 players to start tournament")
    
    tournament["status"] = "active"
    tournaments[tournament_id] = tournament
    
    logger.info(f"Tournament {tournament_id} started with {len(tournament['players'])} players")
    return {"status": "started", "tournament_id": tournament_id, "players": tournament["players"]}

@app.post("/finish_tournament/{tournament_id}")
def finish_tournament(tournament_id: int, podium: List[str]):
    """Finish a tournament with results"""
    global tournaments
    
    if tournament_id not in tournaments:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    tournament = tournaments[tournament_id]
    
    if tournament["status"] != "active":
        raise HTTPException(status_code=400, detail="Tournament is not active")
    
    if int(time.time()) < tournament["end_time"]:
        raise HTTPException(status_code=400, detail="Tournament end time has not been reached")
    
    # Validate podium addresses
    for addr in podium:
        try:
            validate_bech32_address(addr)
        except HTTPException as e:
            return error_response("Invalid podium address", e.detail, code="INVALID_ADDRESS", status_code=400)
    
    tournament["status"] = "finished"
    tournament["final_podium"] = podium
    tournaments[tournament_id] = tournament
    
    logger.info(f"Tournament {tournament_id} finished with podium: {podium}")
    return {"status": "finished", "tournament_id": tournament_id, "podium": podium}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000) 