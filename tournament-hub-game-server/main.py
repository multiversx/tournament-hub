import logging
import time
from fastapi import FastAPI, HTTPException, Request, Body
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, ValidationError
from typing import List, Dict, Optional, Any
import uvicorn
import secrets
import os
import traceback
import sys
import uuid
import json

# Add current directory to path for local imports
sys.path.insert(0, os.path.dirname(__file__))

# Local imports
from contract.submit_results import submit_results_to_contract

# MultiversX SDK imports
from multiversx_sdk import Account, Transaction, NetworkConfig, UserSecretKey
from multiversx_sdk.core import Address
import base64

# FastAPI middleware
from fastapi.middleware.cors import CORSMiddleware

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="Tournament Hub Game Server", version="2.0.0")

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

# On startup, load the private key using MultiversX SDK
if not os.path.exists(PRIVATE_KEY_PATH):
    # Generate a new private key if it doesn't exist
    from multiversx_sdk import UserSecretKey
    secret_key = UserSecretKey.generate()
    
    # Save to PEM format
    pem_content = f"-----BEGIN PRIVATE KEY-----\n{base64.b64encode(secret_key.bytes).decode()}\n-----END PRIVATE KEY-----"
    with open(PRIVATE_KEY_PATH, 'w') as f:
        f.write(pem_content)
    logger.info(f'Generated new private key and saved to {PRIVATE_KEY_PATH}')
else:
    # Load existing private key
    with open(PRIVATE_KEY_PATH, 'r') as f:
        pem_content = f.read()
    
    lines = pem_content.strip().split('\n')
    if len(lines) >= 2:
        # Get the base64 encoded key (second line)
        base64_key = lines[1]
        # Decode the base64 key to get the raw bytes
        private_key_bytes = base64.b64decode(base64_key)
    else:
        raise Exception("Invalid PEM file format")
    
    # Create UserSecretKey from the decoded bytes
    secret_key = UserSecretKey(private_key_bytes)
    logger.info(f'Loaded private key from {PRIVATE_KEY_PATH}')

# Create account with the secret key for reference
account = Account(secret_key)
logger.info(f'Account address: {account.address.bech32()}')

# --- In-memory session store (for demo) ---
sessions: Dict[str, Dict] = {}  # session_id -> session dict

# --- In-memory tournament store (for demo) ---
tournaments: Dict[int, Dict] = {}  # tournament_id -> tournament dict
next_tournament_id = 1  # Next available tournament ID

# --- Helper: Find waiting session for a tournament ---
def find_waiting_session(tournament_id, player):
    for session_id, session in sessions.items():
        if (session["tournament_id"] == tournament_id and
            session["status"] == "waiting" and
            player not in session["players"]):
            return session_id, session
    return None, None

# --- Start or join a session (matchmaking) ---
@app.post("/start_session")
def start_session(data: dict = Body(...)):
    tournament_id = data.get("tournament_id")
    player = data.get("player")
    if not tournament_id or not player:
        return error_response("Missing tournament_id or player", status_code=400)
    # Double-check for any waiting session for this tournament
    for session_id, session in sessions.items():
        if session["tournament_id"] == tournament_id and session["status"] == "waiting" and player not in session["players"]:
            session["players"].append(player)
            session["status"] = "active"
            import random
            session["current_turn"] = random.choice(session["players"])
            sessions[session_id] = session
            logger.info(f"Paired player {player} with session {session_id} for tournament {tournament_id}. Players: {session['players']}")
            # Log all sessions for this tournament
            logger.info(f"All sessions for tournament {tournament_id}: {[sid for sid, s in sessions.items() if s['tournament_id'] == tournament_id]}")
            return {"sessionId": session_id}
    # Otherwise, create new session
    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        "tournament_id": tournament_id,
        "players": [player],
        "status": "waiting",
        "board": [None] * 9,
        "current_turn": player,
        "winner": None
    }
    logger.info(f"Created new session {session_id} for tournament {tournament_id} with player {player}")
    logger.info(f"All sessions for tournament {tournament_id}: {[sid for sid, s in sessions.items() if s['tournament_id'] == tournament_id]}")
    return {"sessionId": session_id}

# --- Get game state ---
@app.get("/game_state")
def get_game_state(sessionId: str):
    logger.info(f"GET /game_state called with sessionId={sessionId}")
    session = sessions.get(sessionId)
    if not session:
        logger.warning(f"Session {sessionId} not found. Current sessions: {list(sessions.keys())}")
        return error_response("Session not found", status_code=404)
    logger.info(f"Session {sessionId} found. Players: {session['players']}, Status: {session['status']}")
    return {
        "board": session["board"],
        "currentTurn": session["current_turn"],
        "gameOver": session["winner"] is not None or all(cell is not None for cell in session["board"]),
        "winner": session["winner"],
        "players": session["players"],
        "status": session["status"]
    }

# --- Debug: List all sessions ---
@app.get("/debug/sessions")
def list_sessions():
    """Debug endpoint to list all current sessions"""
    session_list = []
    for session_id, session in sessions.items():
        session_list.append({
            "sessionId": session_id,
            "tournament_id": session["tournament_id"],
            "players": session["players"],
            "status": session["status"],
            "winner": session["winner"],
            "board": session["board"]
        })
    return {"sessions": session_list, "total": len(session_list)}

# --- Debug: Create test finished session ---
@app.post("/debug/create_test_session")
def create_test_finished_session(data: dict = Body(...)):
    """Debug endpoint to create a test session that's already finished"""
    tournament_id = data.get("tournament_id", 28)
    winner = data.get("winner", "erd1thvc8uzzdvkq4nuvqygfdkqu32evkkh3fdtt8hc672085ed3dthqhrkvvm")
    player2 = data.get("player2", "erd19npdl5d964l6ausfm7l78lj5jrg0sk8wml6t7sjs5rl7hlpjqpjsee0fps")
    
    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        "tournament_id": tournament_id,
        "players": [winner, player2],
        "status": "finished",
        "board": ["X", "O", "X", "O", "X", "O", "X", None, None],  # X wins
        "current_turn": winner,
        "winner": winner
    }
    
    logger.info(f"Created test finished session {session_id} for tournament {tournament_id} with winner {winner}")
    return {
        "sessionId": session_id,
        "tournament_id": tournament_id,
        "winner": winner,
        "status": "finished"
    }

# --- Make a move ---
@app.post("/move")
def make_move(data: dict = Body(...)):
    session_id = data.get("sessionId")
    player = data.get("player")
    move = data.get("move")
    session = sessions.get(session_id)
    if not session:
        return error_response("Session not found", status_code=404)
    if session["status"] != "active":
        return error_response("Game not active", status_code=400)
    if session["current_turn"] != player:
        return error_response("Not your turn", status_code=400)
    if move is None or not (0 <= move < 9) or session["board"][move] is not None:
        return error_response("Invalid move", status_code=400)
    # Mark move
    symbol = "X" if session["players"][0] == player else "O"
    session["board"][move] = symbol
    # Check for win
    b = session["board"]
    win_patterns = [
        [0,1,2],[3,4,5],[6,7,8], # rows
        [0,3,6],[1,4,7],[2,5,8], # cols
        [0,4,8],[2,4,6]          # diags
    ]
    for pattern in win_patterns:
        if b[pattern[0]] and b[pattern[0]] == b[pattern[1]] == b[pattern[2]]:
            session["winner"] = player
            session["status"] = "finished"
            break
    # Switch turn if not over
    if not session["winner"] and any(cell is None for cell in b):
        session["current_turn"] = [p for p in session["players"] if p != player][0]
    sessions[session_id] = session
    return {"status": "move_accepted", "board": session["board"], "winner": session["winner"]}

# --- Submit results (after game over) ---
@app.post("/submit_results")
def submit_results(data: dict = Body(...)):
    session_id = data.get("sessionId")
    winner = data.get("winner")
    session = sessions.get(session_id)
    if not session:
        return error_response("Session not found", status_code=404)
    if session["status"] != "finished":
        return error_response("Game not finished", status_code=400)
    if session["winner"] != winner:
        return error_response("Winner mismatch", status_code=400)

    # Prepare message for signing (e.g., tournament_id + winner address)
    tournament_id = session["tournament_id"]
    message = f"{tournament_id}:{winner}".encode()
    signature = secret_key.sign(message) # Use secret_key for signing
    signature_hex = signature.hex()

    # Call the smart contract (replace with your actual contract call logic)
    try:
        tx_hash = submit_results_to_contract(tournament_id, [winner], secret_key) # Pass secret_key
    except Exception as e:
        logger.error(f"Contract call failed: {e}")
        return error_response("Contract call failed", str(e), status_code=500)

    logger.info(f"Submitted results for session {session_id} to contract. Winner: {winner}, tx: {tx_hash}")
    return {"status": "result_submitted", "sessionId": session_id, "winner": winner, "tx_hash": tx_hash}

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
    
    # Sign using MultiversX SDK
    signature = secret_key.sign(bytes(message))
    signature_hex = signature.hex()
    logger.info(f"Signed result for tournament {req.tournament_id}: {message.hex()} -> {signature_hex}")
    return {"tournament_id": req.tournament_id, "podium": req.podium, "signature": signature_hex, "message_hex": message.hex()}

# Removed duplicate /submit_results endpoint - using the one at line 145 instead

@app.post("/verify_signature")
def verify_signature(req: VerifySignatureRequest):
    try:
        req.validate()
    except HTTPException as e:
        logger.warning(f"Verify signature validation failed: {e.detail}")
        return error_response("Invalid input", e.detail, code="INVALID_INPUT", status_code=400)
    
    # For now, we'll skip verification since we're using the same key for signing
    # In a real implementation, you'd verify against the public key
    logger.info(f"Signature verification requested for tournament {req.tournament_id}")
    return {"valid": True}

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
    # Get the public key from the secret key
    public_key = secret_key.public_key
    # Convert to PEM format
    pem_content = f"-----BEGIN PUBLIC KEY-----\n{base64.b64encode(public_key.bytes).decode()}\n-----END PUBLIC KEY-----"
    return {"public_key_pem": pem_content}

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