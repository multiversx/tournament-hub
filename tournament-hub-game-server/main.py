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

# Import Chess game engine
from chess_game_engine import create_chess_game, get_chess_game, remove_chess_game, ChessGameEngine

# Import Tic Tac Toe game engine
from tictactoe_game_engine import create_tictactoe_game, get_tictactoe_game, remove_tictactoe_game, TicTacToeGameEngine

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

# Helper function to determine game type
def determine_game_type(game_type_id: Optional[int]) -> str:
    """Determine game type string from game type ID"""
    if game_type_id == 1:  # Tic Tac Toe
        return "tictactoe"
    elif game_type_id == 2:  # Chess
        return "chess"
    elif game_type_id == 3:  # 4-Player Card Game
        return "cardgame"
    elif game_type_id == 4:  # 8-Player Battle Royale
        return "battleroyale"
    elif game_type_id == 5:  # CryptoBubbles
        return "cryptobubbles"
    elif game_type_id == 6:  # Checkers
        return "checkers"
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
    else:  # All other games default to CryptoBubbles for now
        logger.info(f"Game type '{game_type}' not implemented yet, using CryptoBubbles as fallback")
        create_cryptobubbles_game(session_id, players)

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

# Pydantic models for Tic Tac Toe endpoints
class TicTacToeMoveRequest(BaseModel):
    sessionId: str
    player: str
    row: int
    col: int

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
            # Determine game type based on request.game_type
            game_type = determine_game_type(request.game_type)
            
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
            
            # Create game instance based on game type
            create_game_instance(game_type, session_id, players)
            
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
        else:  # cryptobubbles
            return await get_cryptobubbles_game_state(sessionId=session_id)
        
    except Exception as e:
        logger.error(f"Error getting game state: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/move")
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
        
        return game.get_game_state()
    except Exception as e:
        logger.error(f"Error getting chess game state: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chess_move")
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
        
        # Make the move
        success = game.make_move(from_pos, to_pos, request.player)
        if not success:
            raise HTTPException(status_code=400, detail="Invalid move")
        
        return {"status": "moved", "game_state": game.get_game_state()}
    except Exception as e:
        logger.error(f"Error making chess move: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/start_chess_game")
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

# Tic Tac Toe specific endpoints
@app.get("/tictactoe_game_state")
async def get_tictactoe_game_state(sessionId: str):
    """Get the current state of a Tic Tac Toe game"""
    try:
        game = get_tictactoe_game(sessionId)
        if not game:
            raise HTTPException(status_code=404, detail="Tic Tac Toe game not found")
        
        return game.get_game_state()
    except Exception as e:
        logger.error(f"Error getting Tic Tac Toe game state: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/tictactoe_move")
async def submit_tictactoe_move(request: TicTacToeMoveRequest):
    """Submit a move in a Tic Tac Toe game"""
    try:
        game = get_tictactoe_game(request.sessionId)
        if not game:
            raise HTTPException(status_code=404, detail="Tic Tac Toe game not found")
        
        # Make the move
        success = game.make_move(request.row, request.col, request.player)
        if not success:
            raise HTTPException(status_code=400, detail="Invalid move")
        
        return {"status": "moved", "game_state": game.get_game_state()}
    except Exception as e:
        logger.error(f"Error making Tic Tac Toe move: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/start_tictactoe_game")
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
            "game_duration": 600
        },
        "chess": {
            "name": "Chess",
            "description": "Strategic board game",
            "max_players": 2,
            "min_players": 2,
            "game_duration": 1800
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
                                    logger.info(f"TicTacToe results submitted for tournament {tournament_id}: {tx_hash}")
                                else:
                                    logger.error(f"Failed to submit TicTacToe results for tournament {tournament_id}")
                            else:
                                logger.error(f"Failed to sign TicTacToe results for tournament {tournament_id}")
                        except Exception as e:
                            logger.error(f"Error processing TicTacToe game results for {session_id}: {e}")
            
            time.sleep(1)  # Check every second
            
        except Exception as e:
            logger.error(f"Error checking game results: {e}")
            time.sleep(5)  # Wait longer on error

# Start background update thread
update_thread = threading.Thread(target=update_cryptobubbles_games, daemon=True)
update_thread.start()

# Start background thread for checking game results
results_thread = threading.Thread(target=check_and_submit_game_results, daemon=True)
results_thread.start()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000) 