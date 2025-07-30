import asyncio
import json
import logging
import threading
import time
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# Import CryptoBubbles game engine
from cryptobubbles_game_engine import create_cryptobubbles_game, get_cryptobubbles_game, remove_cryptobubbles_game, CryptoBubblesGameEngine

# Import contract interaction
from contract.submit_results import sign_results_for_tournament, submit_results_to_contract_with_signature

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Tournament Hub Game Server", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global session storage
sessions: Dict[str, Dict] = {}

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

def error_response(message: str, status_code: int = 400):
    return {"error": message, "status_code": status_code}

@app.post("/start_session")
async def start_session(request: StartSessionRequest):
    """Start a new game session"""
    try:
        # Debug logging
        logger.info(f"Received start_session request: sessionId={request.sessionId}, tournamentId={request.tournamentId}, players={request.players}, game_type={request.game_type}")
        
        # Handle new format (tournament-based sessions)
        if request.tournamentId:
            game_type = "cryptobubbles"
            
            # Check if a session already exists for this tournament
            existing_session_id = None
            for session_id, session_data in sessions.items():
                if session_id.endswith(f"_{request.tournamentId}"):
                    existing_session_id = session_id
                    break
            
            if existing_session_id:
                # Return existing session
                logger.info(f"Returning existing session: {existing_session_id} for tournament: {request.tournamentId}")
                return {"session_id": existing_session_id, "game_type": game_type}
            
            # Create new session if none exists
            session_id = f"session_{int(time.time() * 1000)}_{request.tournamentId}"
            
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
            
            # Create CryptoBubbles game instance
            create_cryptobubbles_game(session_id, players)
            
            logger.info(f"Started {game_type} session: {session_id} with players: {players}")
            return {"session_id": session_id, "game_type": game_type}
        
        # Handle sessionId format (legacy)
        elif request.sessionId:
            session_id = request.sessionId
            game_type = "cryptobubbles"
            
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
            
            # Create CryptoBubbles game instance
            create_cryptobubbles_game(session_id, players)
            
            logger.info(f"Started {game_type} session: {session_id}")
            return {"session_id": session_id, "game_type": game_type}
        
        # Handle old format (direct players list)
        elif request.players:
            session_id = f"session_{int(time.time() * 1000)}"
            game_type = "cryptobubbles"
            
            session = {
                "id": session_id,
                "players": request.players,
                "game_type": game_type,
                "status": "waiting",
                "created_at": time.time()
            }
            
            sessions[session_id] = session
            
            # Create CryptoBubbles game instance
            create_cryptobubbles_game(session_id, request.players)
            
            logger.info(f"Started {game_type} session: {session_id}")
            return {"session_id": session_id, "game_type": game_type}
        
        else:
            logger.error(f"Invalid request: sessionId={request.sessionId}, tournamentId={request.tournamentId}, players={request.players}")
            raise HTTPException(status_code=422, detail="Either 'players', 'sessionId', or 'tournamentId' must be provided")
        
    except Exception as e:
        logger.error(f"Error starting session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/join_session")
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
            
            # Create CryptoBubbles game instance
            create_cryptobubbles_game(session_id, [player])
        
        logger.info(f"Player {player} joined session {session_id}")
        return {"status": "joined", "session_status": session["status"]}
        
    except Exception as e:
        logger.error(f"Error joining session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/game_state")
async def get_game_state(session_id: str):
    """Get current game state - redirects to CryptoBubbles"""
    try:
        if session_id not in sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Redirect to CryptoBubbles game state
        return await get_cryptobubbles_game_state(sessionId=session_id)
        
    except Exception as e:
        logger.error(f"Error getting game state: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/move")
async def submit_move(session_id: str, request: MoveRequest):
    """Submit a move in the game - redirects to CryptoBubbles"""
    try:
        if session_id not in sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Redirect to CryptoBubbles move
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
        
        # Clean up existing game if exists
        remove_cryptobubbles_game(session_id)
        
        # Create new CryptoBubbles game instance
        create_cryptobubbles_game(session_id, session["players"])
        
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

@app.post("/start_cryptobubbles_game")
async def start_cryptobubbles_game(request: StartCryptoBubblesGameRequest):
    """Start a CryptoBubbles game"""
    game = get_cryptobubbles_game(request.sessionId)
    if not game:
        raise HTTPException(status_code=404, detail="CryptoBubbles game not found")
    
    # Start the game
    game.state.start_time = time.time()
    return {"status": "started"}

@app.post("/cryptobubbles_move")
async def submit_cryptobubbles_move(request: CryptoBubblesMoveRequest):
    """Submit a move in CryptoBubbles game"""
    game = get_cryptobubbles_game(request.sessionId)
    if not game:
        raise HTTPException(status_code=404, detail="CryptoBubbles game not found")
    
    # Move the player
    game.move_player(request.player, request.x, request.y)
    return {"status": "moved"}

@app.post("/join_cryptobubbles_session")
async def join_cryptobubbles_session(sessionId: str, player: str):
    """Join an existing CryptoBubbles session"""
    game = get_cryptobubbles_game(sessionId)
    if not game:
        raise HTTPException(status_code=404, detail="CryptoBubbles game not found")
    
    # Add player to game if not already present
    if player not in game.players:
        game.players.append(player)
        game.state.cells[player] = game.state.cells[game.players[0]].__class__(
            x=200, y=200, size=game.min_cell_size, player=player
        )
    
    return {"status": "joined"}

@app.get("/game_config")
async def get_game_config(game_type: str):
    """Get game configuration"""
    configs = {
        "cryptobubbles": {
            "name": "CryptoBubbles",
            "description": "Real-time cell battle game",
            "max_players": 2,
            "min_players": 2,
            "game_duration": 300
        }
    }
    
    if game_type not in configs:
        raise HTTPException(status_code=404, detail="Game type not found")
    
    return configs[game_type]

@app.get("/game-configs")
async def get_game_configs():
    """Get available game configurations"""
    return {
        "5": {
            "name": "CryptoBubbles",
            "minPlayers": 2,
            "maxPlayers": 2,
            "gameType": "real_time_duel",
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
                    if game.state.game_over and game.state.winner and not getattr(game, 'results_submitted', False):
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

# Start background update thread
update_thread = threading.Thread(target=update_cryptobubbles_games, daemon=True)
update_thread.start()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000) 