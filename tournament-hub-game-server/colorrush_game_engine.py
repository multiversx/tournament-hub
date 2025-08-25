import random
import time
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

class GameStatus(Enum):
    WAITING = "waiting"
    PLAYING = "playing"
    FINISHED = "finished"

@dataclass
class ColorTile:
    id: str
    color: str
    is_matched: bool = False
    x: int = 0
    y: int = 0

@dataclass
class GameState:
    board: List[List[ColorTile]]
    current_player: str
    winner: Optional[str] = None
    game_over: bool = False
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    scores: Dict[str, int] = None
    game_duration: int = 0
    level: int = 1
    tiles_cleared: int = 0
    combo_multiplier: int = 1
    time_bonus: int = 0
    status: GameStatus = GameStatus.WAITING

    def __post_init__(self):
        if self.scores is None:
            self.scores = {}

class ColorRushGameEngine:
    def __init__(self, session_id: str, players: List[str]):
        self.session_id = session_id
        self.players = players
        self.colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F']
        self.board_size = 8
        
        # Initialize board
        board = self._initialize_board()
        
        self.state = GameState(
            board=board,
            current_player=players[0] if len(players) > 0 else None,
            scores={player: 0 for player in players},
            status=GameStatus.WAITING
        )
        
        # Game settings
        self.game_duration = 60  # 60 seconds per level
        self.move_timeout = 30  # 30 seconds per move
        
        # Set start time
        self.state.start_time = time.time()
    
    def _initialize_board(self) -> List[List[ColorTile]]:
        """Initialize the game board with random colors"""
        board = []
        for i in range(self.board_size):
            row = []
            for j in range(self.board_size):
                color = random.choice(self.colors)
                tile = ColorTile(
                    id=f"{i}-{j}",
                    color=color,
                    is_matched=False,
                    x=i,
                    y=j
                )
                row.append(tile)
            board.append(row)
        return board
    
    def start_game(self, player: str) -> bool:
        """Start the game"""
        if player not in self.players:
            return False
        
        if self.state.status != GameStatus.WAITING:
            return False
        
        self.state.status = GameStatus.PLAYING
        self.state.start_time = time.time()
        return True
    
    def is_valid_tile_selection(self, tile_id: str, player: str) -> bool:
        """Check if a tile selection is valid"""
        if self.state.status != GameStatus.PLAYING:
            return False
        
        if player != self.state.current_player:
            return False
        
        # Parse tile coordinates
        try:
            x, y = map(int, tile_id.split('-'))
            if x < 0 or x >= self.board_size or y < 0 or y >= self.board_size:
                return False
            
            tile = self.state.board[x][y]
            if tile.is_matched:
                return False
                
            return True
        except (ValueError, IndexError):
            return False
    
    def select_tile(self, tile_id: str, player: str) -> Dict:
        """Select a tile and return game state update"""
        if not self.is_valid_tile_selection(tile_id, player):
            return {"success": False, "message": "Invalid tile selection"}
        
        # Parse tile coordinates
        x, y = map(int, tile_id.split('-'))
        tile = self.state.board[x][y]
        
        # For now, we'll implement a simple scoring system
        # In a real implementation, you'd track selected tiles and check for matches
        
        # Simulate tile clearing for demo purposes
        if random.random() < 0.3:  # 30% chance to "clear" a tile
            tile.is_matched = True
            self.state.tiles_cleared += 1
            
            # Update score
            base_score = 10
            combo_bonus = self.state.combo_multiplier
            self.state.scores[player] += base_score * combo_bonus
            
            # Increase combo multiplier
            self.state.combo_multiplier = min(self.state.combo_multiplier + 1, 5)
            
            return {
                "success": True,
                "tile_cleared": True,
                "score": self.state.scores[player],
                "combo": self.state.combo_multiplier,
                "tiles_cleared": self.state.tiles_cleared
            }
        else:
            # Reset combo on failed match
            self.state.combo_multiplier = 1
            return {
                "success": True,
                "tile_cleared": False,
                "score": self.state.scores[player],
                "combo": self.state.combo_multiplier,
                "tiles_cleared": self.state.tiles_cleared
            }
    
    def submit_score(self, player: str, score: int, tiles_cleared: int, combo: int) -> bool:
        """Submit final score for the game"""
        if player not in self.players:
            return False
        
        self.state.scores[player] = max(self.state.scores[player], score)
        self.state.tiles_cleared = max(self.state.tiles_cleared, tiles_cleared)
        
        return True
    
    def end_game(self) -> Dict:
        """End the game and determine winner"""
        if self.state.status != GameStatus.PLAYING:
            return {"success": False, "message": "Game not in progress"}
        
        self.state.status = GameStatus.FINISHED
        self.state.end_time = time.time()
        self.state.game_over = True
        
        # Calculate game duration
        if self.state.start_time:
            self.state.game_duration = int(self.state.end_time - self.state.start_time)
        
        # Determine winner
        if self.state.scores:
            winner = max(self.state.scores.items(), key=lambda x: x[1])
            self.state.winner = winner[0]
        
        return {
            "success": True,
            "winner": self.state.winner,
            "final_scores": self.state.scores,
            "game_duration": self.state.game_duration,
            "tiles_cleared": self.state.tiles_cleared
        }
    
    def get_game_state(self) -> Dict:
        """Get current game state for API response"""
        return {
            "session_id": self.session_id,
            "players": self.players,
            "board": [
                [
                    {
                        "id": tile.id,
                        "color": tile.color,
                        "isMatched": tile.is_matched,
                        "x": tile.x,
                        "y": tile.y
                    }
                    for tile in row
                ]
                for row in self.state.board
            ],
            "current_player": self.state.current_player,
            "winner": self.state.winner,
            "game_over": self.state.game_over,
            "start_time": self.state.start_time,
            "end_time": self.state.end_time,
            "scores": self.state.scores,
            "game_duration": self.state.game_duration,
            "level": self.state.level,
            "tiles_cleared": self.state.tiles_cleared,
            "combo_multiplier": self.state.combo_multiplier,
            "time_bonus": self.state.time_bonus,
            "status": self.state.status.value
        }
    
    def is_game_finished(self) -> bool:
        """Check if the game is finished"""
        return self.state.status == GameStatus.FINISHED
    
    def get_remaining_time(self) -> int:
        """Get remaining time in seconds"""
        if not self.state.start_time or self.state.status != GameStatus.PLAYING:
            return 0
        
        elapsed = time.time() - self.state.start_time
        remaining = max(0, self.game_duration - elapsed)
        
        if remaining <= 0:
            self.end_game()
            return 0
        
        return int(remaining)

# Global storage for active games
colorrush_games: Dict[str, ColorRushGameEngine] = {}

def create_colorrush_game(session_id: str, players: List[str]) -> ColorRushGameEngine:
    """Create a new Color Rush game"""
    game = ColorRushGameEngine(session_id, players)
    colorrush_games[session_id] = game
    return game

def get_colorrush_game(session_id: str) -> Optional[ColorRushGameEngine]:
    """Get an existing Color Rush game"""
    return colorrush_games.get(session_id)

def remove_colorrush_game(session_id: str) -> bool:
    """Remove a Color Rush game"""
    if session_id in colorrush_games:
        del colorrush_games[session_id]
        return True
    return False
