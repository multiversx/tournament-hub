import random
import time
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

class Player(Enum):
    X = "X"
    O = "O"

@dataclass
class GameState:
    board: List[List[str]]  # 3x3 board
    current_turn: Player
    winner: Optional[str] = None
    game_over: bool = False
    start_time: Optional[float] = None
    move_history: List[Dict] = None
    x_player: Optional[str] = None
    o_player: Optional[str] = None

    def __post_init__(self):
        if self.move_history is None:
            self.move_history = []

class TicTacToeGameEngine:
    def __init__(self, session_id: str, players: List[str]):
        self.session_id = session_id
        self.players = players
        self.state = GameState(
            board=[["" for _ in range(3)] for _ in range(3)],
            current_turn=Player.X,
            move_history=[],
            x_player=players[0] if len(players) > 0 else None,
            o_player=players[1] if len(players) > 1 else None
        )
        
        # Game settings
        self.game_duration = 600  # 10 minutes
        self.move_timeout = 120  # 2 minutes per move
        
        # Set start time
        self.state.start_time = time.time()
    
    def is_valid_move(self, row: int, col: int, player: str) -> bool:
        """Check if a move is valid"""
        # Check if it's the player's turn
        current_player = self.state.x_player if self.state.current_turn == Player.X else self.state.o_player
        if player != current_player:
            return False
        
        # Check if position is within bounds
        if row < 0 or row >= 3 or col < 0 or col >= 3:
            return False
        
        # Check if position is empty
        if self.state.board[row][col] != "":
            return False
        
        return True
    
    def make_move(self, row: int, col: int, player: str) -> bool:
        """Make a move on the board"""
        if not self.is_valid_move(row, col, player):
            return False
        
        # Make the move
        self.state.board[row][col] = self.state.current_turn.value
        
        # Record the move
        move = {
            "player": player,
            "symbol": self.state.current_turn.value,
            "position": [row, col],
            "timestamp": time.time()
        }
        self.state.move_history.append(move)
        
        # Check for win
        if self._check_win(row, col):
            self.state.winner = player
            self.state.game_over = True
        elif self._check_draw():
            self.state.game_over = True
        
        # Switch turns
        self.state.current_turn = Player.O if self.state.current_turn == Player.X else Player.X
        
        return True
    
    def _check_win(self, row: int, col: int) -> bool:
        """Check if the last move resulted in a win"""
        symbol = self.state.board[row][col]
        
        # Check row
        if all(self.state.board[row][c] == symbol for c in range(3)):
            return True
        
        # Check column
        if all(self.state.board[r][col] == symbol for r in range(3)):
            return True
        
        # Check diagonals
        if row == col:  # Main diagonal
            if all(self.state.board[i][i] == symbol for i in range(3)):
                return True
        
        if row + col == 2:  # Anti-diagonal
            if all(self.state.board[i][2-i] == symbol for i in range(3)):
                return True
        
        return False
    
    def _check_draw(self) -> bool:
        """Check if the game is a draw"""
        return all(self.state.board[r][c] != "" for r in range(3) for c in range(3))
    
    def get_game_state(self) -> dict:
        """Get the current game state as a dictionary"""
        return {
            "session_id": self.session_id,
            "board": self.state.board,
            "current_turn": self.state.current_turn.value,
            "winner": self.state.winner,
            "game_over": self.state.game_over,
            "x_player": self.state.x_player,
            "o_player": self.state.o_player,
            "move_history": self.state.move_history,
            "game_type": "tictactoe"
        }

# Global game storage
tictactoe_games: Dict[str, TicTacToeGameEngine] = {}

def create_tictactoe_game(session_id: str, players: List[str]) -> TicTacToeGameEngine:
    """Create a new Tic Tac Toe game"""
    game = TicTacToeGameEngine(session_id, players)
    tictactoe_games[session_id] = game
    return game

def get_tictactoe_game(session_id: str) -> Optional[TicTacToeGameEngine]:
    """Get an existing Tic Tac Toe game"""
    return tictactoe_games.get(session_id)

def remove_tictactoe_game(session_id: str):
    """Remove a Tic Tac Toe game from storage"""
    if session_id in tictactoe_games:
        del tictactoe_games[session_id] 