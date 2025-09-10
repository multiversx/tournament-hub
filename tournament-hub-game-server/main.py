import asyncio
import json
import logging
import threading
import time
from typing import Dict, List, Optional
import os
import base64
import re
from collections import deque
from fastapi import FastAPI, HTTPException, BackgroundTasks, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.gzip import GZipMiddleware
import requests
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Configure logging first
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Handle bech32 import - try different package names
try:
    from bech32 import bech32_encode, convertbits
except ImportError:
    try:
        from bech32m import bech32_encode, convertbits
    except ImportError:
        # If neither works, create dummy functions for production fallback
        def bech32_encode(hrp, data):
            return "dummy_bech32_encode"
        def convertbits(data, frombits, tobits, pad=True):
            return data
        logger.warning("bech32 module not found, using fallback functions")

import uvicorn

# Import CryptoBubbles game engine
from cryptobubbles_game_engine import create_cryptobubbles_game, get_cryptobubbles_game, remove_cryptobubbles_game, CryptoBubblesGameEngine
from dodgedash_game_engine import create_dodgedash_game, get_dodgedash_game, remove_dodgedash_game, dodgedash_games

# Import Chess game engine
from chess_game_engine import create_chess_game, get_chess_game, remove_chess_game, ChessGameEngine

# Import Tic Tac Toe game engine
from tictactoe_game_engine import create_tictactoe_game, get_tictactoe_game, remove_tictactoe_game, TicTacToeGameEngine

# Import Color Rush game engine
from colorrush_game_engine import create_colorrush_game, get_colorrush_game, remove_colorrush_game, ColorRushGameEngine, colorrush_games

# Import contract interaction
from contract.submit_results import sign_results_for_tournament, submit_results_to_contract_with_signature
from notifier_subscriber import start_notifier_subscriber
from notifier_rabbitmq_subscriber import RabbitNotifierSubscriber
from database_optimization import db_optimizer

app = FastAPI(title="Tournament Hub Game Server", version="1.0.0")

# Add compression middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Add request logging middleware with database optimization
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    logger.info(f"Request: {request.method} {request.url.path} - Query: {request.query_params}")
    
    try:
        response = await call_next(request)
        response_time_ms = int((time.time() - start_time) * 1000)
        
        # Log to database for analytics
        db_optimizer.log_api_request(
            endpoint=request.url.path,
            method=request.method,
            status_code=response.status_code,
            response_time_ms=response_time_ms,
            user_agent=request.headers.get("user-agent"),
            ip_address=request.client.host if request.client else None
        )
        
        logger.info(f"Response: {response.status_code} for {request.method} {request.url.path} ({response_time_ms}ms)")
        return response
    except Exception as e:
        response_time_ms = int((time.time() - start_time) * 1000)
        
        # Log error to database
        db_optimizer.log_api_request(
            endpoint=request.url.path,
            method=request.method,
            status_code=500,
            response_time_ms=response_time_ms,
            user_agent=request.headers.get("user-agent"),
            ip_address=request.client.host if request.client else None
        )
        
        logger.error(f"Error processing request {request.method} {request.url.path}: {e}")
        raise

# Custom 404 handler
@app.exception_handler(404)
async def custom_404_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=404,
        content={
            "error": "Endpoint not found",
            "path": str(request.url.path),
            "method": request.method,
            "message": "The requested endpoint does not exist. Check the API documentation at /docs"
        }
    )

# Global session storage
sessions: Dict[str, Dict] = {}
sessions_lock = threading.Lock()
recent_notifier_events = deque(maxlen=200)
recent_events_lock = threading.Lock()

# Recent joins per tournament (session_id string -> deque of addresses)
recent_joins_by_tid: Dict[str, deque] = {}
recent_joins_lock = threading.Lock()
recent_game_starts_by_tid: Dict[str, float] = {}
recent_game_starts_lock = threading.Lock()
last_global_join_ts: float = 0.0

# -------- Chain helpers (simple, resilient) --------
def _vm_query(func: str, args: list[str]) -> Optional[dict]:
    try:
        sc_addr = os.getenv("MX_TOURNAMENT_CONTRACT", "")
        if not sc_addr:
            return None
        resp = requests.post(
            "https://devnet-api.multiversx.com/vm-values/query",
            json={"scAddress": sc_addr, "funcName": func, "args": args},
            timeout=10,
        )
        return resp.json()
    except Exception:
        return None

def _hex_pad_u64(value: int) -> str:
    return format(int(value), 'x').zfill(16)

def fetch_num_tournaments() -> Optional[int]:
    data = _vm_query("getNumberOfTournaments", [])
    if not data:
        return None
    # Try data.value hex
    try:
        hex_val = (data.get("data", {}) or {}).get("value")
        if hex_val:
            return int(hex_val, 16)
    except Exception:
        pass
    # Try returnData[0] base64 -> hex
    try:
        ret = (data.get("data", {}).get("data", {}) or {}).get("returnData")
        if isinstance(ret, list) and ret:
            b64 = ret[0]
            hx = base64.b64decode(b64 + ("=" * ((4 - len(b64) % 4) % 4))).hex()
            return int(hx or '0', 16)
    except Exception:
        pass
    return None

def fetch_game_id_from_sc(tournament_id: int) -> Optional[int]:
    data = _vm_query("getTournament", [_hex_pad_u64(tournament_id)])
    if not data:
        return None
    try:
        ret = (data.get("data", {}).get("data", {}) or {}).get("returnData")
        if isinstance(ret, list) and ret:
            b64 = ret[0]
            hx = base64.b64decode(b64 + ("=" * ((4 - len(b64) % 4) % 4))).hex()
            # First u64 (16 hex chars) is game_id per frontend parser
            if len(hx) >= 16:
                return int(hx[:16] or '0', 16)
    except Exception:
        pass
    return None

# Helper function to determine game type
def determine_game_type(game_type_id: Optional[int]) -> str:
    """Determine game type string from game type ID"""
    if game_type_id == 1:  # Tic Tac Toe
        return "tictactoe"
    elif game_type_id == 2:  # Chess
        return "chess"
    elif game_type_id == 3:  # Deprecated
        return "cryptobubbles"
    elif game_type_id == 4:  # Color Rush
        return "colorrush"
    elif game_type_id == 5:  # CryptoBubbles
        return "cryptobubbles"
    elif game_type_id == 6:  # DodgeDash
        return "dodgedash"
    elif game_type_id == 7:  # Connect Four
        return "connectfour"
    elif game_type_id == 8:  # Memory Match
        return "memorymatch"
    elif game_type_id == 9:  # Word Scramble
        return "wordscramble"
    elif game_type_id == 10:  # Math Challenge
        return "mathchallenge"
    elif game_type_id == 11:  # Puzzle Race
        return "puzzlerace"
    elif game_type_id == 12:  # Trivia Master
        return "triviamaster"
    else:
        return "cryptobubbles"  # Default fallback

# Helper function to create game instances
def create_game_instance(game_type: str, session_id: str, players: List[str]):
    """Create a game instance based on game type"""
    if game_type == "chess":
        create_chess_game(session_id, players)
    elif game_type == "tictactoe":
        create_tictactoe_game(session_id, players)
    elif game_type == "dodgedash":
        create_dodgedash_game(session_id, players)
    elif game_type == "colorrush":
        create_colorrush_game(session_id, players)
    else:  # All other games default to CryptoBubbles for now
        logger.info(f"Game type '{game_type}' not implemented yet, using CryptoBubbles as fallback")
        create_cryptobubbles_game(session_id, players)

# Helper: decode topics coming from notifier
def _maybe_hex_string(value: str) -> bool:
    return bool(re.fullmatch(r"[0-9a-fA-F]+", value))

def _decode_topic_to_int(topic) -> Optional[int]:
    """Best-effort decoder for u64-like integers from various encodings.
    Tries multiple interpretations (hex/base64 big- and little-endian, ascii decimal),
    then chooses a reasonable candidate (small positive values preferred).
    """
    try:
        candidates = []
        if isinstance(topic, int):
            candidates.append(topic)
        s = str(topic)
        # 1) Decimal string
        try:
            if s.isdigit():
                candidates.append(int(s))
        except Exception:
            pass
        # 2) Hex with 0x prefix
        try:
            if s.startswith("0x"):
                val = int(s, 16)
                candidates.append(val)
                if len(s) >= 2 + 64:
                    candidates.append(int(s[-16:], 16))
        except Exception:
            pass
        # 3) Raw hex (possibly 32-byte padded)
        try:
            if _maybe_hex_string(s) and len(s) % 2 == 0:
                candidates.append(int(s, 16))
                if len(s) == 64:
                    # last 8 bytes big-endian
                    candidates.append(int(s[-16:], 16))
                    # little-endian from last 8 bytes
                    tail_bytes = bytes.fromhex(s[-16:])
                    candidates.append(int.from_bytes(tail_bytes, byteorder="little"))
        except Exception:
            pass
        # 4) base64
        try:
            raw = base64.b64decode(s + ("=" * ((4 - len(s) % 4) % 4)))
            if raw:
                # Prefer ASCII digits if present (e.g. '0' or '1')
                try:
                    txt = raw.decode("utf-8", errors="ignore").strip()
                    if txt.isdigit():
                        candidates.append(int(txt))
                except Exception:
                    pass
                # Also try numeric value of bytes
                candidates.append(int.from_bytes(raw, byteorder="big"))
                if len(raw) >= 8:
                    tail = raw[-8:]
                    candidates.append(int.from_bytes(tail, byteorder="big"))
                    candidates.append(int.from_bytes(tail, byteorder="little"))
        except Exception:
            pass

        # Choose the most reasonable candidate
        candidates = [c for c in candidates if isinstance(c, int) and c >= 0]
        if not candidates:
            return None

        def score(x: int) -> tuple:
            # Prefer small positive numbers typical for ids (<= 1e6), then <= 1e9, then others
            if 0 < x <= 1_000_000:
                return (0, x)
            if 0 < x <= 1_000_000_000:
                return (1, x)
            return (2, x)

        candidates.sort(key=score)
        return candidates[0]
    except Exception:
        return None

def _decode_topic_to_str(topic) -> str:
    """Decode topic to a human-readable string.
    Prefer base64->utf8 if possible, even when the input is a plain string.
    """
    try:
        s = topic if isinstance(topic, str) else str(topic)
        # Try base64 decode first
        try:
            raw = base64.b64decode(s + ("=" * ((4 - len(s) % 4) % 4)))
            text = raw.decode("utf-8", errors="ignore")
            # If the decoded text looks meaningful, use it
            if text:
                return text
        except Exception:
            pass
        return s
    except Exception:
        return str(topic)

def _get_or_create_session(session_id: str, game_type: Optional[str] = None) -> Dict:
    with sessions_lock:
        if session_id not in sessions:
            sessions[session_id] = {
                "id": session_id,
                "players": [],
                "game_type": game_type or "cryptobubbles",
                "status": "waiting",
                "created_at": time.time(),
            }
        else:
            if game_type and sessions[session_id].get("game_type") != game_type:
                sessions[session_id]["game_type"] = game_type
        return sessions[session_id]

def _b64_to_ascii(value: str) -> str:
    try:
        raw = base64.b64decode(value + ("=" * ((4 - len(value) % 4) % 4)))
        return raw.decode("utf-8", errors="ignore")
    except Exception:
        return ""

def _decode_u64_from_b64_topic(topic_str: str) -> Optional[int]:
    try:
        # Try ASCII digits first
        ascii_txt = _b64_to_ascii(topic_str).strip()
        if ascii_txt.isdigit():
            return int(ascii_txt)
        # Fallback: use last 8 bytes (u64, big-endian) from raw bytes
        raw = base64.b64decode(topic_str + ("=" * ((4 - len(topic_str) % 4) % 4)))
        if len(raw) >= 8:
            return int.from_bytes(raw[-8:], byteorder="big")
        # Fallback: interpret hex
        hx = raw.hex()
        if len(hx) >= 16:
            return int(hx[-16:], 16)
    except Exception:
        pass
    return None

def handle_notifier_event(event: Dict):
    try:
        identifier = event.get("identifier")
        # Normalize some common variants coming from different sources
        alias_map = {
            "createTournament": "tournamentCreated",
            "CreateTournament": "tournamentCreated",
            "startTournament": "tournamentStarted",
            "StartTournament": "tournamentStarted",
            "startGame": "gameStarted",
            "submitResults": "resultsSubmitted",
            "SubmitResults": "resultsSubmitted",
            "joinTournament": "playerJoined",
        }
        identifier = alias_map.get(identifier, identifier)
        topics = event.get("topics") or []
        # Some notifier payloads set identifier to writeLog; first topic contains the real event name.
        if len(topics) > 0:
            first_topic_as_str = _decode_topic_to_str(topics[0])
            known_names = {
                "tournamentCreated",
                "playerJoined",
                "tournamentStarted",
                "resultsSubmitted",
                "prizesDistributed",
                "tournamentReadyToStart",
                "gameStarted",
                "startTournament",
                "createTournament",
                "startGame",
                "joinTournament",
            }
            if first_topic_as_str in known_names:
                # Normalize identifier from topic name for writeLog cases
                identifier = alias_map.get(first_topic_as_str, first_topic_as_str)
                topics = topics[1:]

        tournament_id = _decode_topic_to_int(topics[0]) if len(topics) >= 1 else None
        # Fallback: if tournament_id is implausible, query SC for latest id
        def is_implausible(value: Optional[int]) -> bool:
            return value is None or value <= 0 or value > 10**12
        if identifier == "tournamentCreated":
            # Use helper that properly reads data.data.data.returnData[0]
            count = fetch_num_tournaments()
            if count and count > 0:
                tournament_id = count
        if tournament_id is None:
            return
        session_id = str(tournament_id)
        event_for_ui = {"identifier": identifier, "tournament_id": tournament_id, "ts": time.time()}
        try:
            event_for_ui["topics"] = [str(t) for t in topics]
            raw = event.get("raw") or {}
            raw_data_b64 = raw.get("data")
            if raw_data_b64:
                raw_hex = base64.b64decode(raw_data_b64 + ("=" * ((4 - len(raw_data_b64) % 4) % 4))).hex()
                event_for_ui["raw_head"] = raw_hex[:128]
        except Exception:
            pass

        if identifier == "tournamentCreated":
            # If topics are base64 ASCII digits, decode tournament_id and game_id directly
            try:
                if len(topics) >= 1:
                    txt = base64.b64decode(str(topics[0]) + ("=" * ((4 - len(str(topics[0])) % 4) % 4))).decode("utf-8", errors="ignore").strip()
                    if txt.isdigit():
                        tournament_id = int(txt)
            except Exception:
                pass
            # Determine game_id: prefer topic[2] if topics are [eventName, tournament_id, game_id]
            game_id = None
            try:
                if len(topics) >= 2:
                    txt_gid = base64.b64decode(str(topics[1]) + ("=" * ((4 - len(str(topics[1])) % 4) % 4))).decode("utf-8", errors="ignore").strip()
                    if txt_gid.isdigit():
                        game_id = int(txt_gid)
            except Exception:
                pass
            if game_id is None:
                if len(topics) >= 3:
                    game_id = _decode_topic_to_int(topics[2])
                if game_id is None and len(topics) >= 2:
                    game_id = _decode_topic_to_int(topics[1])
            # As a final fallback, query chain state for the tournament's game_id
            if game_id is None:
                gid = fetch_game_id_from_sc(tournament_id)
                if gid is not None:
                    game_id = gid
            game_type = determine_game_type(game_id) if game_id is not None else "cryptobubbles"
            sess = _get_or_create_session(session_id, game_type)
            logger.info(f"Session created from event: {session_id} game_type={sess['game_type']}")
            # Do NOT create engine here; wait for tournamentStarted/gameStarted
            event_for_ui["game_id"] = game_id

        elif identifier == "playerJoined":
            # Topics ordering per SC: [tournament_id (indexed u64)], [player (indexed address)]
            # First topic should be the tournament_id
            if len(topics) >= 1:
                tid = _decode_u64_from_b64_topic(str(topics[0]))
                if tid and tid > 0:
                    tournament_id = tid
                    session_id = str(tournament_id)
            # 2) Decode player from base64 -> hex -> bech32 (prefe  r topic with 32-byte pubkey)
            player_addr = ""
            for t in topics:
                try:
                    b64s = str(t)
                    hx = base64.b64decode(b64s + ("=" * ((4 - len(b64s) % 4) % 4))).hex()
                    if len(hx) >= 64:
                        data_bytes = bytes.fromhex(hx[-64:])
                        five_bits = convertbits(list(data_bytes), 8, 5, True)
                        addr = bech32_encode("erd", five_bits)
                        if addr and addr.startswith("erd"):
                            player_addr = addr
                            break
                except Exception:
                    continue
            if not player_addr and len(topics) >= 2:
                player_addr = _decode_topic_to_str(topics[1])
            sess = _get_or_create_session(session_id)
            with sessions_lock:
                if player_addr and player_addr not in sess["players"]:
                    sess["players"].append(player_addr)
            # Try to reflect in game engine where applicable
            try:
                if sess.get("game_type") == "dodgedash":
                    from dodgedash_game_engine import get_dodgedash_game, create_dodgedash_game
                    g = get_dodgedash_game(session_id)
                    if not g:
                        create_dodgedash_game(session_id, sess["players"])
                    else:
                        if player_addr:
                            g.add_player(player_addr)
            except Exception as e:
                logger.debug(f"Ignoring engine add player error: {e}")
            logger.info(f"Player joined from event: {player_addr} -> session {session_id}")
            event_for_ui["player"] = player_addr
            # Record recent joins for UI polling
            if player_addr:
                with recent_joins_lock:
                    dq = recent_joins_by_tid.get(session_id)
                    if dq is None:
                        dq = deque(maxlen=50)
                        recent_joins_by_tid[session_id] = dq
                    dq.append(player_addr)
            # Bump global join timestamp regardless of mapping
            global last_global_join_ts
            last_global_join_ts = time.time()

        elif identifier in ("tournamentReadyToStart", "tournamentStarted", "gameStarted"):
            sess = _get_or_create_session(session_id)
            # Mark session ready/playing and ensure engine exists
            if identifier == "tournamentReadyToStart":
                with sessions_lock:
                    sess["status"] = "ready"
                # Do NOT create engine on ready; wait for explicit start
            else:
                with sessions_lock:
                    sess["status"] = "playing"
                # Ensure session has correct game_type before creating engine
                resolved_game_type = sess.get("game_type")
                if not resolved_game_type or resolved_game_type == "cryptobubbles":
                    gid = fetch_game_id_from_sc(int(session_id))
                    if gid is not None:
                        resolved_game_type = determine_game_type(gid)
                        with sessions_lock:
                            sessions[session_id]["game_type"] = resolved_game_type
                create_game_instance(resolved_game_type or "cryptobubbles", session_id, sess["players"])
            logger.info(f"Session {session_id} status from event {identifier}: {sessions[session_id]['status']}")
            if identifier in ("tournamentStarted", "gameStarted"):
                with recent_game_starts_lock:
                    recent_game_starts_by_tid[session_id] = time.time()

        elif identifier == "resultsSubmitted":
            with sessions_lock:
                sess = _get_or_create_session(session_id)
                sess["results_submitted"] = True
            logger.info(f"Results submitted for session {session_id}")

        elif identifier == "prizesDistributed":
            # Cleanup session and engines
            with sessions_lock:
                sess = sessions.get(session_id)
                game_type = sess.get("game_type") if sess else None
            try:
                if game_type == "chess":
                    remove_chess_game(session_id)
                elif game_type == "tictactoe":
                    remove_tictactoe_game(session_id)
                elif game_type == "dodgedash":
                    remove_dodgedash_game(session_id)
                else:
                    remove_cryptobubbles_game(session_id)
            except Exception:
                pass
            with sessions_lock:
                sessions.pop(session_id, None)
            logger.info(f"Cleaned up session {session_id} after prizes distribution")

        # store compact event for UI polling
        with recent_events_lock:
            recent_notifier_events.append(event_for_ui)

    except Exception as e:
        logger.error(f"Notifier event handling error: {e}")

@app.get("/notifier/recent")
@app.get("/tournament-hub/notifier/recent")
async def get_recent_notifier_events():
    with recent_events_lock:
        return list(recent_notifier_events)

@app.get("/notifier/joins")
@app.get("/tournament-hub/notifier/joins")
async def get_recent_joins(tournamentId: str):
    # Return recent join addresses for a tournament (session id)
    sid = str(tournamentId)
    with recent_joins_lock:
        dq = recent_joins_by_tid.get(sid)
        return list(dq) if dq else []

@app.get("/notifier/game-start")
@app.get("/tournament-hub/notifier/game-start")
async def get_recent_game_start(tournamentId: str):
    sid = str(tournamentId)
    with recent_game_starts_lock:
        ts = recent_game_starts_by_tid.get(sid)
        return {"started": ts is not None, "ts": ts or 0}



@app.get("/notifier/joins-any")
@app.get("/tournament-hub/notifier/joins-any")
async def get_recent_any_join():
    return {"ts": last_global_join_ts}

@app.get("/health")
async def health_check():
    """Health check endpoint to monitor server and notifier status"""
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "active_sessions": len(sessions),
        "recent_events_count": len(recent_notifier_events),
        "contract_address": os.getenv("MX_TOURNAMENT_CONTRACT", "not_set"),
        "notifier_ws_url": os.getenv("MX_NOTIFIER_WS_URL", "not_set"),
        "notifier_amqp_host": os.getenv("MX_AMQP_HOST", "not_set"),
        "root_path": os.getenv("ROOT_PATH", "not_set"),
    }

@app.get("/performance")
async def get_performance_stats():
    """Get performance statistics and database metrics"""
    try:
        stats = db_optimizer.get_performance_stats()
        return {
            "status": "success",
            "data": stats,
            "timestamp": time.time()
        }
    except Exception as e:
        logger.error(f"Error getting performance stats: {e}")
        return {"status": "error", "message": str(e)}

@app.post("/optimize")
async def optimize_database():
    """Run database optimization"""
    try:
        db_optimizer.optimize_database()
        return {
            "status": "success",
            "message": "Database optimization completed",
            "timestamp": time.time()
        }
    except Exception as e:
        logger.error(f"Error optimizing database: {e}")
        return {"status": "error", "message": str(e)}

@app.get("/")
async def root():
    """Root endpoint to test if the server is working"""
    return {
        "message": "Tournament Hub Game Server is running",
        "timestamp": time.time(),
        "root_path": os.getenv("ROOT_PATH", "not_set"),
        "available_endpoints": [
            "/health",
            "/start_session",
            "/tictactoe_game_state",
            "/notifier/recent",
            "/docs"
        ]
    }

@app.post("/test")
@app.post("/tournament-hub/test")
async def test_post():
    """Test POST endpoint"""
    return {"message": "POST request received", "timestamp": time.time()}

# Pydantic models for requests
class StartSessionRequest(BaseModel):
    players: Optional[List[str]] = None
    game_type: Optional[int] = 5  # Default to CryptoBubbles
    sessionId: Optional[str] = None  # New format for tournament-based sessions
    tournamentId: Optional[str] = None  # Tournament ID for tournament-based sessions
    playerAddresses: Optional[List[str]] = None  # Actual player addresses for tournament-based sessions

class JoinSessionRequest(BaseModel):
    player: str

class MoveRequest(BaseModel):
    player: str
    position: Optional[int] = None
    x: Optional[float] = None
    y: Optional[float] = None

class GameConfigRequest(BaseModel):
    game_type: str

# Pydantic models for CryptoBubbles endpoints
class StartCryptoBubblesGameRequest(BaseModel):
    sessionId: str

class CryptoBubblesMoveRequest(BaseModel):
    sessionId: str
    player: str
    x: float
    y: float

# Pydantic models for Chess endpoints
class ChessMoveRequest(BaseModel):
    sessionId: str
    player: str
    from_pos: str  # Format: "x,y" (e.g., "0,1")
    to_pos: str    # Format: "x,y" (e.g., "0,3")
    promotion: Optional[str] = None  # 'q','r','b','n'

class ChessEmojiRequest(BaseModel):
    sessionId: str
    player: str
    emoji: str

# Pydantic models for Tic Tac Toe endpoints
class TicTacToeMoveRequest(BaseModel):
    sessionId: str
    player: str
    row: int
    col: int

def error_response(message: str, status_code: int = 400):
    return {"error": message, "status_code": status_code}

@app.post("/start_session")
@app.post("/tournament-hub/start_session")
async def start_session(request: StartSessionRequest):
    """Start a new game session"""
    logger.info("=== START_SESSION ROUTE CALLED ===")
    try:
        # Debug logging
        logger.info(f"Received start_session request: sessionId={request.sessionId}, tournamentId={request.tournamentId}, players={request.players}, game_type={request.game_type}")
        logger.info(f"Request body: {request}")
        
        # Validate that we have at least one identifier
        if not request.tournamentId and not request.sessionId and not request.players:
            logger.warning("Invalid start_session request: no tournamentId, sessionId, or players provided")
            raise HTTPException(status_code=400, detail="Either 'tournamentId', 'sessionId', or 'players' must be provided")
        
        # Handle new format (tournament-based sessions)
        if request.tournamentId:
            # Determine game type based on request.game_type
            game_type = determine_game_type(request.game_type)
            
            # Use deterministic session id per tournament so all players join same game
            existing_session_id = str(request.tournamentId) if str(request.tournamentId) in sessions else None
            
            if existing_session_id:
                # Ensure engine exists and includes provided players
                try:
                    if game_type == 'dodgedash':
                        from dodgedash_game_engine import get_dodgedash_game, create_dodgedash_game
                        g = get_dodgedash_game(existing_session_id)
                        if not g:
                            logger.info(f"Creating DodgeDash engine for existing session {existing_session_id}")
                            create_dodgedash_game(existing_session_id, request.playerAddresses or [])
                        else:
                            if request.playerAddresses:
                                for p in request.playerAddresses:
                                    g.add_player(p)
                    elif game_type == 'cryptobubbles':
                        # Engines for other games are created on demand elsewhere; skip for now
                        pass
                    elif game_type == 'colorrush':
                        from colorrush_game_engine import get_colorrush_game, create_colorrush_game
                        g = get_colorrush_game(existing_session_id)
                        if not g:
                            logger.info(f"Creating Color Rush engine for existing session {existing_session_id}")
                            create_colorrush_game(existing_session_id, request.playerAddresses or [])
                        else:
                            if request.playerAddresses:
                                for p in request.playerAddresses:
                                    if p not in g.players:
                                        g.players.append(p)
                                        g.state.scores[p] = 0
                except Exception as e:
                    logger.warning(f"Failed to ensure engine for existing session: {e}")
                logger.info(f"Returning existing session: {existing_session_id} for tournament: {request.tournamentId}")
                return {"session_id": existing_session_id, "game_type": game_type}
            
            # Create new session if none exists
            session_id = str(request.tournamentId)
            
            # Use actual player addresses if provided, otherwise use placeholder
            if request.playerAddresses:
                players = request.playerAddresses
            else:
                # Fallback to placeholder - should be actual tournament players
                players = [f"player_{request.tournamentId}_1", f"player_{request.tournamentId}_2"]
            
            session = {
                "id": session_id,
                "players": players,
                "game_type": game_type,
                "status": "waiting",
                "created_at": time.time()
            }
            
            sessions[session_id] = session
            
            # Create game instance based on game type
            create_game_instance(game_type, session_id, players)
            # Ensure the engine reflects latest provided players (idempotent)
            try:
                if game_type == 'dodgedash' and request.playerAddresses:
                    from dodgedash_game_engine import get_dodgedash_game
                    g = get_dodgedash_game(session_id)
                    if g:
                        for p in request.playerAddresses:
                            g.add_player(p)
            except Exception as e:
                logger.warning(f"Failed to sync engine players: {e}")
            
            logger.info(f"Started {game_type} session: {session_id} with players: {players}")
            return {"session_id": session_id, "game_type": game_type}
        
        # Handle sessionId format (legacy)
        elif request.sessionId:
            session_id = request.sessionId
            
            # Determine game type based on request.game_type
            game_type = determine_game_type(request.game_type)
            
            # For tournament-based sessions, we need to get the players from the tournament
            # For now, we'll create a placeholder session with the sessionId as the player list
            # In a real implementation, you'd fetch the tournament data and get the actual players
            players = [request.sessionId]  # Placeholder - should be actual tournament players
            
            session = {
                "id": session_id,
                "players": players,
                "game_type": game_type,
                "status": "waiting",
                "created_at": time.time()
            }
            
            sessions[session_id] = session
            
            # Create game instance based on game type
            create_game_instance(game_type, session_id, players)
            
            logger.info(f"Started {game_type} session: {session_id}")
            return {"session_id": session_id, "game_type": game_type}
        
        # Handle old format (direct players list)
        elif request.players:
            session_id = f"session_{int(time.time() * 1000)}"
            game_type = determine_game_type(request.game_type)
            
            session = {
                "id": session_id,
                "players": request.players,
                "game_type": game_type,
                "status": "waiting",
                "created_at": time.time()
            }
            
            sessions[session_id] = session
            
            # Create game instance based on game type
            create_game_instance(game_type, session_id, request.players)
            
            logger.info(f"Started {game_type} session: {session_id}")
            return {"session_id": session_id, "game_type": game_type}
        
        else:
            logger.error(f"Invalid request: sessionId={request.sessionId}, tournamentId={request.tournamentId}, players={request.players}")
            raise HTTPException(status_code=422, detail="Either 'players', 'sessionId', or 'tournamentId' must be provided")
        
    except Exception as e:
        logger.error(f"Error starting session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/join_session")
@app.post("/tournament-hub/join_session")
async def join_session(session_id: str, request: JoinSessionRequest):
    """Join an existing session"""
    try:
        if session_id not in sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session = sessions[session_id]
        player = request.player
        
        if player not in session["players"]:
            raise HTTPException(status_code=400, detail="Player not in session")
        
        if session["status"] != "waiting":
            raise HTTPException(status_code=400, detail="Session already started")
        
        # Add player to session
        if player not in session.get("joined_players", []):
            if "joined_players" not in session:
                session["joined_players"] = []
            session["joined_players"].append(player)
        
        # Check if all players joined
        if len(session["joined_players"]) == len(session["players"]):
            session["status"] = "ready"
            
            # Create game instance based on session's game type
            game_type = session.get("game_type", "cryptobubbles")
            create_game_instance(game_type, session_id, session["players"])
        
        logger.info(f"Player {player} joined session {session_id}")
        return {"status": "joined", "session_status": session["status"]}
        
    except Exception as e:
        logger.error(f"Error joining session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/game_state")
async def get_game_state(session_id: str):
    """Get current game state - handles both chess and CryptoBubbles"""
    try:
        if session_id not in sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session = sessions[session_id]
        game_type = session.get("game_type", "cryptobubbles")
        
        # Redirect to appropriate game state endpoint
        if game_type == "chess":
            return await get_chess_game_state(sessionId=session_id)
        elif game_type == "tictactoe":
            return await get_tictactoe_game_state(sessionId=session_id)
        elif game_type == "dodgedash":
            return await get_dodgedash_game_state(sessionId=session_id)
        else:  # cryptobubbles
            return await get_cryptobubbles_game_state(sessionId=session_id)
        
    except Exception as e:
        logger.error(f"Error getting game state: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/move")
@app.post("/tournament-hub/move")
async def submit_move(session_id: str, request: MoveRequest):
    """Submit a move in the game - handles both chess and CryptoBubbles"""
    try:
        if session_id not in sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session = sessions[session_id]
        game_type = session.get("game_type", "cryptobubbles")
        
        # Redirect to appropriate move endpoint
        if game_type == "chess":
            # For chess, we need from_pos and to_pos, but MoveRequest only has x,y
            # This is a limitation - chess moves should use the chess-specific endpoint
            raise HTTPException(status_code=400, detail="Chess moves must use /chess_move endpoint with from_pos and to_pos")
        elif game_type == "tictactoe":
            # For Tic Tac Toe, we need row and col, but MoveRequest only has x,y
            # This is a limitation - Tic Tac Toe moves should use the tictactoe-specific endpoint
            raise HTTPException(status_code=400, detail="Tic Tac Toe moves must use /tictactoe_move endpoint with row and col")
        elif game_type == "dodgedash":
            raise HTTPException(status_code=400, detail="Use /dodgedash_move endpoint with ax, ay, dash")
        else:  # cryptobubbles
            cryptobubbles_request = CryptoBubblesMoveRequest(
                sessionId=session_id,
                player=request.player,
                x=request.x or 0,
                y=request.y or 0
            )
            return await submit_cryptobubbles_move(cryptobubbles_request)
        
    except Exception as e:
        logger.error(f"Error submitting move: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/start_game")
@app.post("/tournament-hub/start_game")
async def start_game(session_id: str):
    """Start the game"""
    try:
        if session_id not in sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session = sessions[session_id]
        
        if session["status"] != "ready":
            raise HTTPException(status_code=400, detail="Session not ready")
        
        session["status"] = "playing"
        session["started_at"] = time.time()
        
        # Clean up existing game if exists (for all game types)
        remove_cryptobubbles_game(session_id)  # TODO: Make this generic for all game types
        
        # Create game instance based on session's game type
        game_type = session.get("game_type", "cryptobubbles")
        create_game_instance(game_type, session_id, session["players"])
        
        logger.info(f"Started game for session {session_id}")
        return {"status": "started"}
        
    except Exception as e:
        logger.error(f"Error starting game: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# CryptoBubbles specific endpoints

@app.get("/cryptobubbles_game_state")
async def get_cryptobubbles_game_state(sessionId: str):
    """Get current CryptoBubbles game state"""
    game = get_cryptobubbles_game(sessionId)
    if not game:
        raise HTTPException(status_code=404, detail="CryptoBubbles game not found")
    
    return game.get_game_state()
@app.get("/dodgedash_game_state")
async def get_dodgedash_game_state(sessionId: str):
    game = get_dodgedash_game(sessionId)
    if not game:
        raise HTTPException(status_code=404, detail="DodgeDash game not found")
    return game.get_game_state()

class DodgeDashMoveRequest(BaseModel):
    sessionId: str
    player: str
    ax: float = 0
    ay: float = 0
    dash: bool = False

@app.post("/dodgedash_move")
@app.post("/tournament-hub/dodgedash_move")
async def dodgedash_move(req: DodgeDashMoveRequest):
    game = get_dodgedash_game(req.sessionId)
    if not game:
        # Auto-create engine for this session to avoid race on first inputs
        try:
            game = create_dodgedash_game(req.sessionId, [req.player])
            sessions.setdefault(req.sessionId, {"id": req.sessionId, "players": [req.player], "game_type": "dodgedash", "status": "waiting", "created_at": time.time()})
            logger.info(f"Auto-created DodgeDash game for session {req.sessionId}")
        except Exception:
            raise HTTPException(status_code=404, detail="DodgeDash game not found")
    game.move_player(req.player, req.ax, req.ay, req.dash)
    return { 'status': 'ok' }

@app.post("/join_dodgedash_session")
@app.post("/tournament-hub/join_dodgedash_session")
async def join_dodgedash_session(sessionId: str, player: str):
    game = get_dodgedash_game(sessionId)
    if not game:
        # Create engine if missing and add player
        game = create_dodgedash_game(sessionId, [player])
        sessions.setdefault(sessionId, {"id": sessionId, "players": [player], "game_type": "dodgedash", "status": "waiting", "created_at": time.time()})
    game.add_player(player)
    logger.info(f"Player {player} joined DodgeDash session {sessionId}")
    return { 'status': 'joined' }

@app.post("/start_cryptobubbles_game")
@app.post("/tournament-hub/start_cryptobubbles_game")
async def start_cryptobubbles_game(request: StartCryptoBubblesGameRequest):
    """Start a CryptoBubbles game"""
    game = get_cryptobubbles_game(request.sessionId)
    if not game:
        raise HTTPException(status_code=404, detail="CryptoBubbles game not found")
    
    # Start the game
    game.state.start_time = time.time()
    return {"status": "started"}

@app.post("/cryptobubbles_move")
@app.post("/tournament-hub/cryptobubbles_move")
async def submit_cryptobubbles_move(request: CryptoBubblesMoveRequest):
    """Submit a move in CryptoBubbles game"""
    game = get_cryptobubbles_game(request.sessionId)
    if not game:
        raise HTTPException(status_code=404, detail="CryptoBubbles game not found")
    
    # Move the player
    game.move_player(request.player, request.x, request.y)
    return {"status": "moved"}

@app.post("/join_cryptobubbles_session")
@app.post("/tournament-hub/join_cryptobubbles_session")
async def join_cryptobubbles_session(sessionId: str, player: str):
    """Join an existing CryptoBubbles session"""
    try:
        game = get_cryptobubbles_game(sessionId)
        if not game:
            raise HTTPException(status_code=404, detail="CryptoBubbles game not found")
        
        # Add player to game if not already present
        if player not in game.players:
            game.players.append(player)
            
            # Position the new player in a safe location
            arena_size = game.state.arena_size
            import random
            
            # Find a position away from other players
            attempts = 0
            while attempts < 10:
                x = random.randint(200, arena_size[0] - 200)
                y = random.randint(200, arena_size[1] - 200)
                
                # Check if position is far enough from other players
                too_close = False
                for cell in game.state.cells.values():
                    if hasattr(cell, 'state') and cell.state == 'alive':
                        distance = ((x - cell.x) ** 2 + (y - cell.y) ** 2) ** 0.5
                        if distance < 300:  # Minimum 300 pixels from other players
                            too_close = True
                            break
                
                if not too_close:
                    break
                attempts += 1
            
            # Create new cell for the player
            from cryptobubbles_game_engine import Cell, CellState
            game.state.cells[player] = Cell(
                x=x, y=y, size=game.min_cell_size, player=player, state=CellState.ALIVE
            )
            
            logger.info(f"Player {player} joined session {sessionId} at position ({x}, {y})")
        
        return {"status": "joined"}
    except Exception as e:
        logger.error(f"Error joining CryptoBubbles session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Chess-specific endpoints
@app.get("/chess_game_state")
async def get_chess_game_state(sessionId: str):
    """Get the current state of a chess game"""
    try:
        game = get_chess_game(sessionId)
        if not game:
            raise HTTPException(status_code=404, detail="Chess game not found")
        data = game.get_game_state()
        # Attach recent emojis (last 10 in past 60s)
        sess = sessions.get(sessionId, {})
        now = time.time()
        emojis = [e for e in sess.get('emojis', []) if now - e.get('ts', 0) < 60]
        sess['emojis'] = emojis
        data['emojis'] = emojis[-10:]
        return data
    except Exception as e:
        logger.error(f"Error getting chess game state: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chess_move")
@app.post("/tournament-hub/chess_move")
async def submit_chess_move(request: ChessMoveRequest):
    """Submit a move in a chess game"""
    try:
        game = get_chess_game(request.sessionId)
        if not game:
            raise HTTPException(status_code=404, detail="Chess game not found")
        
        # Parse position strings
        try:
            from_x, from_y = map(int, request.from_pos.split(','))
            to_x, to_y = map(int, request.to_pos.split(','))
            from_pos = (from_x, from_y)
            to_pos = (to_x, to_y)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid position format. Use 'x,y' (e.g., '0,1')")
        
        # Helpful validation before making the move
        current_player = game.state.white_player if game.state.current_turn.value == 'white' else game.state.black_player
        if request.player != current_player:
            raise HTTPException(status_code=400, detail="Not your turn")
        piece = game.state.board.get(from_pos)
        if not piece:
            raise HTTPException(status_code=400, detail="No piece on the origin square")
        if piece.color.value != game.state.current_turn.value:
            raise HTTPException(status_code=400, detail="That's not your piece")
        dest = game.state.board.get(to_pos)
        if dest and dest.color.value == piece.color.value:
            raise HTTPException(status_code=400, detail="Destination occupied by your piece")
        if not game.is_valid_move(from_pos, to_pos, game.state.current_turn):
            try:
                if game._would_move_leave_king_in_check(from_pos, to_pos, game.state.current_turn):
                    raise HTTPException(status_code=400, detail="Move leaves your king in check")
            except Exception:
                pass
            raise HTTPException(status_code=400, detail="Illegal move for that piece or path is blocked")

        # Make the move
        success = game.make_move(from_pos, to_pos, request.player, request.promotion)
        if not success:
            raise HTTPException(status_code=400, detail="Invalid move")
        
        return {"status": "moved", "game_state": game.get_game_state()}
    except Exception as e:
        logger.error(f"Error making chess move: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/start_chess_game")
@app.post("/tournament-hub/start_chess_game")
async def start_chess_game(sessionId: str):
    """Start a chess game (games start automatically when created)"""
    try:
        game = get_chess_game(sessionId)
        if not game:
            raise HTTPException(status_code=404, detail="Chess game not found")
        
        # Chess games start automatically when created
        return {"status": "started", "game_state": game.get_game_state()}
    except Exception as e:
        logger.error(f"Error starting chess game: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Emojis for chess sessions
@app.post("/chess_emoji")
@app.post("/tournament-hub/chess_emoji")
async def post_chess_emoji(req: ChessEmojiRequest):
    try:
        if req.sessionId not in sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        # Allow short emojis or text messages (up to 200 chars)
        if req.emoji and len(req.emoji) <= 200:
            sess = sessions[req.sessionId]
            if 'emojis' not in sess:
                sess['emojis'] = []
            sess['emojis'].append({ 'player': req.player, 'emoji': req.emoji, 'ts': time.time() })
            # Limit size
            if len(sess['emojis']) > 50:
                sess['emojis'] = sess['emojis'][-50:]
        return { 'status': 'ok' }
    except Exception as e:
        logger.error(f"Error posting chess emoji: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Aliases for compatibility
@app.post("/chess-emoji")
@app.post("/tournament-hub/chess-emoji")
async def post_chess_emoji_dash(req: ChessEmojiRequest):
    return await post_chess_emoji(req)

@app.post("/emoji")
@app.post("/tournament-hub/emoji")
async def post_emoji(req: ChessEmojiRequest):
    return await post_chess_emoji(req)

# Tic Tac Toe specific endpoints
@app.get("/tictactoe_game_state")
@app.get("/tournament-hub/tictactoe_game_state")
async def get_tictactoe_game_state(sessionId: str):
    """Get the current state of a Tic Tac Toe game"""
    try:
        # Add validation for sessionId
        if not sessionId or sessionId == "null" or sessionId.strip() == "":
            logger.warning(f"Invalid sessionId provided: '{sessionId}'")
            return {"error": "Invalid sessionId provided", "sessionId": sessionId, "status": "error"}
        
        logger.info(f"Fetching Tic Tac Toe game state for session: {sessionId}")
        game = get_tictactoe_game(sessionId)
        if not game:
            logger.warning(f"Tic Tac Toe game not found for session: {sessionId}")
            return {"error": "Tic Tac Toe game not found", "sessionId": sessionId, "status": "not_found"}
        
        game_state = game.get_game_state()
        logger.info(f"Successfully retrieved game state for session: {sessionId}")
        return game_state
    except Exception as e:
        logger.error(f"Error getting Tic Tac Toe game state for session {sessionId}: {e}")
        return {"error": str(e), "sessionId": sessionId, "status": "error"}

@app.post("/tictactoe_move")
@app.post("/tournament-hub/tictactoe_move")
async def submit_tictactoe_move(request: TicTacToeMoveRequest):
    """Submit a move in a Tic Tac Toe game"""
    logger.info("=== TICTACTOE_MOVE ROUTE CALLED ===")
    try:
        logger.info(f"Tic Tac Toe move request: sessionId={request.sessionId}, player={request.player}, row={request.row}, col={request.col}")
        game = get_tictactoe_game(request.sessionId)
        if not game:
            logger.warning(f"Tic Tac Toe game not found for session: {request.sessionId}")
            raise HTTPException(status_code=404, detail="Tic Tac Toe game not found")
        
        # Make the move
        success = game.make_move(request.row, request.col, request.player)
        if not success:
            logger.warning(f"Invalid move attempted: player={request.player}, row={request.row}, col={request.col}")
            raise HTTPException(status_code=400, detail="Invalid move")
        
        logger.info(f"Move successful for player {request.player} at ({request.row}, {request.col})")
        return {"status": "moved", "game_state": game.get_game_state()}
    except Exception as e:
        logger.error(f"Error making Tic Tac Toe move: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/start_tictactoe_game")
@app.post("/tournament-hub/start_tictactoe_game")
async def start_tictactoe_game(sessionId: str):
    """Start a Tic Tac Toe game (games start automatically when created)"""
    try:
        game = get_tictactoe_game(sessionId)
        if not game:
            raise HTTPException(status_code=404, detail="Tic Tac Toe game not found")
        
        # Tic Tac Toe games start automatically when created
        return {"status": "started", "game_state": game.get_game_state()}
    except Exception as e:
        logger.error(f"Error starting Tic Tac Toe game: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/game_config")
async def get_game_config(game_type: str):
    """Get game configuration"""
    configs = {
        "cryptobubbles": {
            "name": "CryptoBubbles",
            "description": "Real-time cell battle game",
            "max_players": 8,
            "min_players": 1,
        },
        "chess": {
            "name": "Chess",
            "description": "Strategic board game",
            "max_players": 2,
            "min_players": 2,
        }
    }
    
    if game_type not in configs:
        raise HTTPException(status_code=404, detail="Game type not found")
    
    return configs[game_type]

@app.get("/game-configs")
async def get_game_configs():
    """Get available game configurations"""
    return {
        "2": {
            "name": "Chess",
            "minPlayers": 2,
            "maxPlayers": 2,
            "gameType": "turn_based",
            "description": "Strategic board game"
        },
        "5": {
            "name": "CryptoBubbles",
            "minPlayers": 1,
            "maxPlayers": 8,
            "gameType": "real_time_battle",
            "description": "Real-time cell battle game"
        }
    }

# Game update loop for CryptoBubbles
def update_cryptobubbles_games():
    """Background task to update all active CryptoBubbles games"""
    while True:
        try:
            from cryptobubbles_game_engine import active_games
            
            for session_id, game in active_games.items():
                if isinstance(game, CryptoBubblesGameEngine):
                    game.update_game_state()
                    
                    # Check if game finished and submit results
                    # Only submit results if there were originally multiple players
                    if (game.state.game_over and game.state.winner and 
                        len(game.players) > 1 and 
                        not getattr(game, 'results_submitted', False)):
                        logger.info(f"CryptoBubbles game {session_id} finished! Winner: {game.state.winner}")
                        
                        # Mark as submitted to prevent repeated processing
                        game.results_submitted = True
                        
                        # Extract tournament_id from session_id
                        # Session ID format: either "session_timestamp_tournamentId" or just "tournamentId"
                        try:
                            if session_id.startswith('session_'):
                                # Old format: session_timestamp_tournamentId
                                parts = session_id.split('_')
                                if len(parts) >= 3:
                                    tournament_id = int(parts[2])
                                else:
                                    logger.warning(f"Could not extract tournament_id from session_id: {session_id}")
                                    continue
                            else:
                                # New format: just the tournament_id
                                tournament_id = int(session_id)
                                
                            # Create podium list with only the winner (contract expects podium_size = 1)
                            podium = [game.state.winner]
                            
                            # Sign and submit results
                            signature = sign_results_for_tournament(tournament_id, podium)
                            if signature:
                                tx_hash = submit_results_to_contract_with_signature(tournament_id, podium, signature)
                                if tx_hash:
                                    logger.info(f"Results submitted for tournament {tournament_id}: {tx_hash}")
                                else:
                                    logger.error(f"Failed to submit results for tournament {tournament_id}")
                            else:
                                logger.error(f"Failed to sign results for tournament {tournament_id}")
                        except Exception as e:
                            logger.error(f"Error processing game results for {session_id}: {e}")
            
            time.sleep(0.1)  # Update every 100ms for better collision detection
            
        except Exception as e:
            logger.error(f"Error updating CryptoBubbles games: {e}")
            time.sleep(5)  # Wait longer on error

def check_and_submit_game_results():
    """Background task to check if Chess and TicTacToe games are finished and submit results"""
    while True:
        try:
            from chess_game_engine import chess_games
            from tictactoe_game_engine import tictactoe_games
            
            # Check Chess games
            for session_id, game in chess_games.items():
                if not getattr(game, 'results_submitted', False):
                    game_state = game.get_game_state()
                    if game_state.get('game_over', False) and game_state.get('winner'):
                        logger.info(f"Chess game {session_id} finished! Winner: {game_state['winner']}")
                        
                        # Mark as submitted to prevent repeated processing
                        game.results_submitted = True
                        
                        # Extract tournament_id from session_id
                        try:
                            if session_id.startswith('session_'):
                                parts = session_id.split('_')
                                if len(parts) >= 3:
                                    tournament_id = int(parts[2])
                                else:
                                    logger.warning(f"Could not extract tournament_id from session_id: {session_id}")
                                    continue
                            else:
                                tournament_id = int(session_id)
                                
                            # Create podium list with only the winner
                            podium = [game_state['winner']]
                            
                            # Sign and submit results
                            signature = sign_results_for_tournament(tournament_id, podium)
                            if signature:
                                tx_hash = submit_results_to_contract_with_signature(tournament_id, podium, signature)
                                if tx_hash:
                                    logger.info(f"Chess results submitted for tournament {tournament_id}: {tx_hash}")
                                else:
                                    logger.error(f"Failed to submit Chess results for tournament {tournament_id}")
                            else:
                                logger.error(f"Failed to sign Chess results for tournament {tournament_id}")
                        except Exception as e:
                            logger.error(f"Error processing Chess game results for {session_id}: {e}")
            
            # Check TicTacToe games
            for session_id, game in tictactoe_games.items():
                if not getattr(game, 'results_submitted', False):
                    game_state = game.get_game_state()
                    if game_state.get('game_over', False) and game_state.get('winner'):
                        logger.info(f"TicTacToe game {session_id} finished! Winner: {game_state['winner']}")
                        game.results_submitted = True
                        try:
                            tournament_id = int(session_id.split('_')[-1]) if session_id.startswith('session_') else int(session_id)
                            podium = [game_state['winner']]
                            signature = sign_results_for_tournament(tournament_id, podium)
                            if signature:
                                tx_hash = submit_results_to_contract_with_signature(tournament_id, podium, signature)
                                if tx_hash:
                                    logger.info(f"TicTacToe results submitted for tournament {tournament_id}: {tx_hash}")
                        except Exception as e:
                            logger.error(f"Error processing TicTacToe game results for {session_id}: {e}")

            # Check Color Rush games
            for session_id, game in colorrush_games.items():
                if not getattr(game, 'results_submitted', False):
                    game_state = game.get_game_state()
                    if game_state.get('game_over', False) and game_state.get('winner'):
                        logger.info(f"Color Rush game {session_id} finished! Winner: {game_state['winner']}")
                        game.results_submitted = True
                        try:
                            tournament_id = int(session_id.split('_')[-1]) if session_id.startswith('session_') else int(session_id)
                            podium = [game_state['winner']]
                            signature = sign_results_for_tournament(tournament_id, podium)
                            if signature:
                                tx_hash = submit_results_to_contract_with_signature(tournament_id, podium, signature)
                                if tx_hash:
                                    logger.info(f"Color Rush results submitted for tournament {tournament_id}: {tx_hash}")
                                else:
                                    logger.error(f"Failed to submit Color Rush results for tournament {tournament_id}")
                            else:
                                logger.error(f"Failed to sign Color Rush results for tournament {tournament_id}")
                        except Exception as e:
                            logger.error(f"Error processing Color Rush game results for {session_id}: {e}")

            # Update DodgeDash games and submit results
            for session_id, game in dodgedash_games.items():
                game.update_game_state()
                if not getattr(game, 'results_submitted', False) and game.game_over and game.winner:
                    try:
                        tournament_id = int(session_id.split('_')[-1]) if session_id.startswith('session_') else int(session_id)
                        podium = [game.winner]
                        signature = sign_results_for_tournament(tournament_id, podium)
                        if signature:
                            tx_hash = submit_results_to_contract_with_signature(tournament_id, podium, signature)
                            if tx_hash:
                                logger.info(f"DodgeDash results submitted for tournament {tournament_id}: {tx_hash}")
                                game.results_submitted = True
                    except Exception as e:
                        logger.error(f"Error submitting DodgeDash results for {session_id}: {e}")
            
            time.sleep(1)  # Check every second
            
        except Exception as e:
            logger.error(f"Error checking game results: {e}")
            time.sleep(5)  # Wait longer on error

# Color Rush API Endpoints
@app.post("/join_colorrush_session")
@app.post("/tournament-hub/join_colorrush_session")
async def join_colorrush_session(sessionId: str, player: str):
    """Join a Color Rush game session"""
    try:
        if sessionId not in colorrush_games:
            # Create new game if it doesn't exist
            create_colorrush_game(sessionId, [player])
            logger.info(f"Created new Color Rush game session {sessionId} for player {player}")
        else:
            game = get_colorrush_game(sessionId)
            if player not in game.players:
                game.players.append(player)
                game.state.scores[player] = 0
                logger.info(f"Player {player} joined Color Rush game session {sessionId}")
        
        return {"success": True, "message": "Joined Color Rush session"}
    except Exception as e:
        logger.error(f"Error joining Color Rush session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/start_colorrush_game")
@app.post("/tournament-hub/start_colorrush_game")
async def start_colorrush_game(sessionId: str, player: str):
    """Start a Color Rush game"""
    try:
        game = get_colorrush_game(sessionId)
        if not game:
            raise HTTPException(status_code=404, detail="Game session not found")
        
        if game.start_game(player):
            logger.info(f"Color Rush game started for session {sessionId}")
            return {"success": True, "message": "Game started"}
        else:
            raise HTTPException(status_code=400, detail="Cannot start game")
    except Exception as e:
        logger.error(f"Error starting Color Rush game: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/colorrush_game_state")
async def get_colorrush_game_state(sessionId: str):
    """Get Color Rush game state"""
    try:
        game = get_colorrush_game(sessionId)
        if not game:
            raise HTTPException(status_code=404, detail="Game session not found")
        
        return game.get_game_state()
    except Exception as e:
        logger.error(f"Error getting Color Rush game state: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/submit_colorrush_score")
@app.post("/tournament-hub/submit_colorrush_score")
async def submit_colorrush_score(sessionId: str, player: str, score: int, tilesCleared: int, combo: int):
    """Submit final score for Color Rush game"""
    try:
        game = get_colorrush_game(sessionId)
        if not game:
            raise HTTPException(status_code=404, detail="Game session not found")
        
        if game.submit_score(player, score, tilesCleared, combo):
            logger.info(f"Score submitted for Color Rush game {sessionId}: {score} points")
            return {"success": True, "message": "Score submitted"}
        else:
            raise HTTPException(status_code=400, detail="Failed to submit score")
    except Exception as e:
        logger.error(f"Error submitting Color Rush score: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/colorrush_tile_click")
@app.post("/tournament-hub/colorrush_tile_click")
async def colorrush_tile_click(sessionId: str, player: str, tileId: str):
    """Handle tile click in Color Rush game"""
    try:
        game = get_colorrush_game(sessionId)
        if not game:
            raise HTTPException(status_code=404, detail="Game session not found")
        
        result = game.select_tile(tileId, player)
        if result["success"]:
            return result
        else:
            raise HTTPException(status_code=400, detail=result["message"])
    except Exception as e:
        logger.error(f"Error handling Color Rush tile click: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Start background update thread
update_thread = threading.Thread(target=update_cryptobubbles_games, daemon=True)
update_thread.start()

# Start background thread for checking game results
results_thread = threading.Thread(target=check_and_submit_game_results, daemon=True)
results_thread.start()

# Catch-all route removed - it was interfering with valid routes

# Start notifier subscriber on startup
@app.on_event("startup")
async def startup_event():
    logger.info("Starting Tournament Hub Game Server...")
    
    # Check if we have a contract address configured
    contract_address = os.getenv("MX_TOURNAMENT_CONTRACT")
    if not contract_address:
        logger.warning("MX_TOURNAMENT_CONTRACT not set - notifier events will not be filtered by contract address")
    
    # Temporarily disable notifiers due to DNS resolution issues
    # All MultiversX notifier endpoints are currently failing DNS resolution
    logger.warning("Notifiers temporarily disabled due to DNS resolution issues")
    logger.info("Game server will run without blockchain event notifications")
    logger.info("Tournament events will need to be processed manually or via other means")
    
    # TODO: Re-enable notifiers when DNS issues are resolved
    # The following code is commented out until notifier endpoints are working:
    """
    # Try to start notifiers with graceful fallback
    notifier_started = False
    
    # Prefer RabbitMQ notifier if AMQP config provided
    use_amqp = any([
        os.getenv("MX_AMQP_URL"),
        os.getenv("MX_AMQP_HOST"),
        os.getenv("MX_AMQP_USER"),
        os.getenv("MX_AMQP_PASS"),
    ])
    
    if use_amqp:
        try:
            # Start RabbitMQ subscriber in background thread
            subscriber = RabbitNotifierSubscriber(
                amqp_host=os.getenv("MX_AMQP_HOST", "devnet-external-k8s-proxy.multiversx.com"),
                amqp_port=int(os.getenv("MX_AMQP_PORT", "30006")),
                amqp_vhost=os.getenv("MX_AMQP_VHOST", "devnet2"),
                amqp_user=os.getenv("MX_AMQP_USER", ""),
                amqp_pass=os.getenv("MX_AMQP_PASS", ""),
                exchange=os.getenv("MX_AMQP_EXCHANGE", "all_events"),
                event_callback=handle_notifier_event,
            )
            subscriber.start()
            logger.info("Started RabbitMQ notifier subscriber")
            notifier_started = True
        except Exception as e:
            logger.warning(f"Failed to start RabbitMQ notifier subscriber: {e}")
    
    # Fallback to WebSocket notifier
    if not notifier_started:
        try:
            asyncio.create_task(start_notifier_subscriber(handle_notifier_event))
            logger.info("Started WebSocket notifier subscriber")
            notifier_started = True
        except Exception as e:
            logger.error(f"Failed to start WebSocket notifier subscriber: {e}")
    
    if not notifier_started:
        logger.error("Failed to start any notifier subscriber - events will not be received from the blockchain")
        logger.info("Game server will continue to run but tournament events will not be processed automatically")
    else:
        logger.info("Notifier subscriber started successfully")
    """

if __name__ == "__main__":
    root_path = os.getenv("ROOT_PATH", "")
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8000,
        root_path=root_path  # ✅ Add this line
    )