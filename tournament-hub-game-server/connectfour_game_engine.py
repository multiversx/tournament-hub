import random
import time
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

class Player(Enum):
    RED = "red"
    YELLOW = "yellow"

@dataclass
class GameState:
    board: List[List[str]]  # 6x7 board (6 rows, 7 columns)
    current_turn: Player
    winner: Optional[str] = None
    game_over: bool = False
    start_time: Optional[float] = None
    move_history: List[Dict] = None
    red_player: Optional[str] = None
    yellow_player: Optional[str] = None
    last_move: Optional[Tuple[int, int]] = None  # (row, col) of last piece placed

    def __post_init__(self):
        if self.move_history is None:
            self.move_history = []

class ConnectFourGameEngine:
    def __init__(self, session_id: str, players: List[str]):
        self.session_id = session_id
        self.players = players
        self.state = GameState(
            board=[["" for _ in range(7)] for _ in range(6)],  # 6 rows, 7 columns
            current_turn=Player.RED,
            move_history=[],
            red_player=players[0] if len(players) > 0 else None,
            yellow_player=players[1] if len(players) > 1 else None
        )
        
        # Game settings
        self.game_duration = 900  # 15 minutes
        self.move_timeout = 120  # 2 minutes per move
        self.rows = 6
        self.cols = 7
        self.results_submitted = False  # Track if results have been submitted to contract
        self.results_submitted = False  # Track if results have been submitted to contract
        
        # Set start time
        self.state.start_time = time.time()
    
    def add_player(self, player: str) -> bool:
        """Add a player to the game if there's an available slot"""
        if self.state.game_over:
            return False
        
        # If no red player, assign to red
        if not self.state.red_player:
            self.state.red_player = player
            return True
        
        # If no yellow player, assign to yellow
        if not self.state.yellow_player:
            self.state.yellow_player = player
            return True
        
        # Both slots are taken
        return False
    
    def is_valid_move(self, col: int, player: str) -> bool:
        """Check if a move is valid"""
        # Check if it's the player's turn
        current_player = self.state.red_player if self.state.current_turn == Player.RED else self.state.yellow_player
        if player != current_player:
            return False
        
        # Check if game is over
        if self.state.game_over:
            return False
        
        # Check if column is within bounds
        if col < 0 or col >= self.cols:
            return False
        
        # Check if column has space (top row must be empty)
        if self.state.board[0][col] != "":
            return False
        
        return True
    
    def get_next_open_row(self, col: int) -> Optional[int]:
        """Find the next open row in the specified column (pieces fall down)"""
        for row in range(self.rows - 1, -1, -1):
            if self.state.board[row][col] == "":
                return row
        return None
    
    def make_move(self, col: int, player: str) -> bool:
        """Make a move by dropping a piece in the specified column"""
        if not self.is_valid_move(col, player):
            return False
        
        # Find the row where the piece will land
        row = self.get_next_open_row(col)
        if row is None:
            return False
        
        # Place the piece
        self.state.board[row][col] = self.state.current_turn.value
        self.state.last_move = (row, col)
        
        # Record the move
        move = {
            "player": player,
            "color": self.state.current_turn.value,
            "column": col,
            "row": row,
            "timestamp": time.time()
        }
        self.state.move_history.append(move)
        
        # Check for win
        if self._check_win(row, col):
            self.state.winner = player
            self.state.game_over = True
        elif self._check_draw():
            self.state.game_over = True
        
        # Check for timeout
        if time.time() - self.state.start_time > self.game_duration:
            self.state.game_over = True
            # If no winner, it's a draw
        
        # Switch turns
        self.state.current_turn = Player.YELLOW if self.state.current_turn == Player.RED else Player.RED
        
        return True
    
    def _check_win(self, row: int, col: int) -> bool:
        """Check if the last move resulted in a win (4 in a row)"""
        color = self.state.board[row][col]
        
        # Check horizontal
        if self._check_direction(row, col, 0, 1, color):  # Right
            return True
        
        # Check vertical
        if self._check_direction(row, col, 1, 0, color):  # Down
            return True
        
        # Check diagonal (bottom-left to top-right)
        if self._check_direction(row, col, 1, 1, color):  # Down-right
            return True
        
        # Check diagonal (top-left to bottom-right)
        if self._check_direction(row, col, 1, -1, color):  # Down-left
            return True
        
        return False
    
    def _check_direction(self, row: int, col: int, delta_row: int, delta_col: int, color: str) -> bool:
        """Check if there are 4 pieces in a row in a specific direction"""
        count = 1  # Count the piece we just placed
        
        # Check in positive direction
        count += self._count_consecutive(row, col, delta_row, delta_col, color)
        
        # Check in negative direction
        count += self._count_consecutive(row, col, -delta_row, -delta_col, color)
        
        return count >= 4
    
    def _count_consecutive(self, row: int, col: int, delta_row: int, delta_col: int, color: str) -> int:
        """Count consecutive pieces of the same color in a direction"""
        count = 0
        current_row = row + delta_row
        current_col = col + delta_col
        
        while (0 <= current_row < self.rows and 
               0 <= current_col < self.cols and 
               self.state.board[current_row][current_col] == color):
            count += 1
            current_row += delta_row
            current_col += delta_col
        
        return count
    
    def _check_draw(self) -> bool:
        """Check if the game is a draw (board is full)"""
        return all(self.state.board[0][c] != "" for c in range(self.cols))
    
    def get_game_state(self) -> dict:
        """Get the current game state as a dictionary"""
        return {
            "session_id": self.session_id,
            "board": self.state.board,
            "current_turn": self.state.current_turn.value,
            "winner": self.state.winner,
            "game_over": self.state.game_over,
            "red_player": self.state.red_player,
            "yellow_player": self.state.yellow_player,
            "move_history": self.state.move_history,
            "last_move": self.state.last_move,
            "game_type": "connectfour",
            "rows": self.rows,
            "cols": self.cols
        }

# Global game storage
connectfour_games: Dict[str, ConnectFourGameEngine] = {}

def create_connectfour_game(session_id: str, players: List[str]) -> ConnectFourGameEngine:
    """Create a new Connect Four game"""
    game = ConnectFourGameEngine(session_id, players)
    connectfour_games[session_id] = game
    return game

def get_connectfour_game(session_id: str) -> Optional[ConnectFourGameEngine]:
    """Get an existing Connect Four game"""
    return connectfour_games.get(session_id)

def remove_connectfour_game(session_id: str):
    """Remove a Connect Four game from storage"""
    if session_id in connectfour_games:
        del connectfour_games[session_id]

