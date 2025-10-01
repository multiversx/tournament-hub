import random
import time
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

class ShipType(Enum):
    CARRIER = "carrier"      # 5 squares
    BATTLESHIP = "battleship"  # 4 squares
    CRUISER = "cruiser"      # 3 squares
    SUBMARINE = "submarine"   # 3 squares
    DESTROYER = "destroyer"   # 2 squares

class Orientation(Enum):
    HORIZONTAL = "horizontal"
    VERTICAL = "vertical"

class GamePhase(Enum):
    SETUP = "setup"          # Players placing ships
    BATTLE = "battle"        # Players firing at each other
    FINISHED = "finished"    # Game over

@dataclass
class Ship:
    ship_type: ShipType
    positions: List[Tuple[int, int]]  # List of (x, y) coordinates
    hits: List[bool]  # Track which positions are hit
    is_sunk: bool = False

@dataclass
class GameState:
    # Game setup
    phase: GamePhase
    current_turn: Optional[str] = None  # Player whose turn it is
    winner: Optional[str] = None
    game_over: bool = False
    start_time: Optional[float] = None
    
    # Players
    player1: Optional[str] = None
    player2: Optional[str] = None
    
    # Ship placement tracking
    player1_ships_placed: int = 0
    player2_ships_placed: int = 0
    required_ships: int = 5  # Total ships each player must place
    
    # Game boards (10x10 grid)
    player1_board: List[List[str]] = None  # Player 1's ships
    player2_board: List[List[str]] = None  # Player 2's ships
    player1_opponent_view: List[List[str]] = None  # What player 1 sees of player 2's board
    player2_opponent_view: List[List[str]] = None  # What player 2 sees of player 1's board
    
    # Ship tracking
    player1_ships: List[Ship] = None
    player2_ships: List[Ship] = None
    
    # Move history
    move_history: List[Dict] = None
    
    # Game settings
    board_size: int = 10
    ship_types: List[ShipType] = None

    def __post_init__(self):
        if self.player1_board is None:
            self.player1_board = [["" for _ in range(self.board_size)] for _ in range(self.board_size)]
        if self.player2_board is None:
            self.player2_board = [["" for _ in range(self.board_size)] for _ in range(self.board_size)]
        if self.player1_opponent_view is None:
            self.player1_opponent_view = [["" for _ in range(self.board_size)] for _ in range(self.board_size)]
        if self.player2_opponent_view is None:
            self.player2_opponent_view = [["" for _ in range(self.board_size)] for _ in range(self.board_size)]
        if self.player1_ships is None:
            self.player1_ships = []
        if self.player2_ships is None:
            self.player2_ships = []
        if self.move_history is None:
            self.move_history = []
        if self.ship_types is None:
            self.ship_types = [ShipType.CARRIER, ShipType.BATTLESHIP, ShipType.CRUISER, ShipType.SUBMARINE, ShipType.DESTROYER]

class BattleshipGameEngine:
    def __init__(self, session_id: str, players: List[str]):
        self.session_id = session_id
        self.players = players
        self.state = GameState(
            phase=GamePhase.SETUP,
            player1=players[0] if len(players) > 0 else None,
            player2=players[1] if len(players) > 1 else None,
            move_history=[]
        )
        
        # Game settings
        self.game_duration = 1800  # 30 minutes total
        self.setup_timeout = 300   # 5 minutes for ship placement
        self.move_timeout = 60     # 1 minute per move
        
        # Ship sizes
        self.ship_sizes = {
            ShipType.CARRIER: 5,
            ShipType.BATTLESHIP: 4,
            ShipType.CRUISER: 3,
            ShipType.SUBMARINE: 3,
            ShipType.DESTROYER: 2
        }
        
        # Set start time
        self.state.start_time = time.time()
        self.results_submitted = False  # Track if results have been submitted to contract
    
    def add_player(self, player: str) -> bool:
        """Add a player to the game if there's an available slot"""
        if self.state.game_over:
            return False
        
        if not self.state.player1:
            self.state.player1 = player
            return True
        
        if not self.state.player2:
            self.state.player2 = player
            return True
        
        return False
    
    def is_valid_ship_placement(self, player: str, ship_type: ShipType, x: int, y: int, orientation: Orientation) -> bool:
        """Check if a ship can be placed at the given position"""
        if self.state.phase != GamePhase.SETUP:
            return False
        
        if player not in [self.state.player1, self.state.player2]:
            return False
        
        # Check if player has already placed this ship type
        player_ships = self.state.player1_ships if player == self.state.player1 else self.state.player2_ships
        for ship in player_ships:
            if ship.ship_type == ship_type:
                return False
        
        # Get ship size
        ship_size = self.ship_sizes[ship_type]
        
        # Check bounds
        if orientation == Orientation.HORIZONTAL:
            if x + ship_size > self.state.board_size:
                return False
        else:  # VERTICAL
            if y + ship_size > self.state.board_size:
                return False
        
        # Check for overlaps with existing ships
        board = self.state.player1_board if player == self.state.player1 else self.state.player2_board
        
        for i in range(ship_size):
            if orientation == Orientation.HORIZONTAL:
                check_x, check_y = x + i, y
            else:
                check_x, check_y = x, y + i
            
            if board[check_y][check_x] != "":
                return False
        
        return True
    
    def place_ship(self, player: str, ship_type: ShipType, x: int, y: int, orientation: Orientation) -> bool:
        """Place a ship on the board"""
        if not self.is_valid_ship_placement(player, ship_type, x, y, orientation):
            return False
        
        # Create ship object
        ship_size = self.ship_sizes[ship_type]
        positions = []
        
        for i in range(ship_size):
            if orientation == Orientation.HORIZONTAL:
                pos_x, pos_y = x + i, y
            else:
                pos_x, pos_y = x, y + i
            positions.append((pos_x, pos_y))
        
        ship = Ship(
            ship_type=ship_type,
            positions=positions,
            hits=[False] * ship_size
        )
        
        # Add ship to player's ships
        if player == self.state.player1:
            self.state.player1_ships.append(ship)
            board = self.state.player1_board
            self.state.player1_ships_placed += 1
        else:
            self.state.player2_ships.append(ship)
            board = self.state.player2_board
            self.state.player2_ships_placed += 1
        
        # Mark positions on board
        for pos_x, pos_y in positions:
            board[pos_y][pos_x] = ship_type.value
        
        # Check if both players have placed all ships
        if (self.state.player1_ships_placed >= self.state.required_ships and 
            self.state.player2_ships_placed >= self.state.required_ships):
            self.state.phase = GamePhase.BATTLE
            self.state.current_turn = self.state.player1  # Player 1 goes first
        
        return True
    
    def is_valid_shot(self, player: str, x: int, y: int) -> bool:
        """Check if a shot is valid"""
        if self.state.phase != GamePhase.BATTLE:
            return False
        
        if self.state.game_over:
            return False
        
        # Check if it's the player's turn
        if player != self.state.current_turn:
            return False
        
        # Check bounds
        if x < 0 or x >= self.state.board_size or y < 0 or y >= self.state.board_size:
            return False
        
        # Check if already shot at this position
        opponent_view = (self.state.player1_opponent_view if player == self.state.player1 
                        else self.state.player2_opponent_view)
        
        if opponent_view[y][x] in ["hit", "miss"]:
            return False
        
        return True
    
    def fire_shot(self, player: str, x: int, y: int) -> Dict:
        """Fire a shot at the opponent's board"""
        if not self.is_valid_shot(player, x, y):
            return {"success": False, "error": "Invalid shot"}
        
        # Determine opponent
        opponent = self.state.player2 if player == self.state.player1 else self.state.player1
        opponent_board = self.state.player2_board if player == self.state.player1 else self.state.player1_board
        opponent_ships = self.state.player2_ships if player == self.state.player1 else self.state.player1_ships
        player_view = (self.state.player1_opponent_view if player == self.state.player1 
                      else self.state.player2_opponent_view)
        
        # Check if shot hits
        hit = opponent_board[y][x] != ""
        result = {"success": True, "hit": hit, "x": x, "y": y}
        
        if hit:
            # Mark as hit on player's view
            player_view[y][x] = "hit"
            
            # Find and update the hit ship
            ship_hit = None
            for ship in opponent_ships:
                for i, (ship_x, ship_y) in enumerate(ship.positions):
                    if ship_x == x and ship_y == y:
                        ship.hits[i] = True
                        ship_hit = ship
                        break
                if ship_hit:
                    break
            
            # Check if ship is sunk
            if ship_hit and all(ship_hit.hits):
                ship_hit.is_sunk = True
                result["ship_sunk"] = ship_hit.ship_type.value
                
                # Check if all ships are sunk (game over)
                if all(ship.is_sunk for ship in opponent_ships):
                    self.state.winner = player
                    self.state.game_over = True
                    self.state.phase = GamePhase.FINISHED
                    result["game_over"] = True
                    result["winner"] = player
        else:
            # Mark as miss
            player_view[y][x] = "miss"
        
        # Record move
        move = {
            "player": player,
            "x": x,
            "y": y,
            "hit": hit,
            "timestamp": time.time()
        }
        if "ship_sunk" in result:
            move["ship_sunk"] = result["ship_sunk"]
        self.state.move_history.append(move)
        
        # Switch turns (only if game not over)
        if not self.state.game_over:
            self.state.current_turn = opponent
        
        return result
    
    def get_game_state(self, requesting_player: str = None) -> dict:
        """Get the current game state as a dictionary"""
        # Determine which player's view to return based on requesting player
        # If no requesting player specified, default to player1 for backward compatibility
        if requesting_player is None:
            requesting_player = self.state.player1
        
        if requesting_player == self.state.player1:
            my_board = self.state.player1_board
            opponent_view = self.state.player1_opponent_view
            my_ships = self.state.player1_ships
        else:
            my_board = self.state.player2_board
            opponent_view = self.state.player2_opponent_view
            my_ships = self.state.player2_ships
        
        return {
            "session_id": self.session_id,
            "phase": self.state.phase.value,
            "current_turn": self.state.current_turn,
            "winner": self.state.winner,
            "game_over": self.state.game_over,
            "player1": self.state.player1,
            "player2": self.state.player2,
            "player1_ships_placed": self.state.player1_ships_placed,
            "player2_ships_placed": self.state.player2_ships_placed,
            "required_ships": self.state.required_ships,
            "my_board": my_board,
            "opponent_view": opponent_view,
            "my_ships": [
                {
                    "type": ship.ship_type.value,
                    "positions": ship.positions,
                    "hits": ship.hits,
                    "is_sunk": ship.is_sunk
                }
                for ship in my_ships
            ],
            "move_history": self.state.move_history,
            "game_type": "battleship",
            "board_size": self.state.board_size,
            "ship_types": [ship_type.value for ship_type in self.state.ship_types]
        }
    
    def get_opponent_view(self, player: str) -> List[List[str]]:
        """Get what a player can see of the opponent's board"""
        if player == self.state.player1:
            return self.state.player1_opponent_view
        else:
            return self.state.player2_opponent_view

# Global game storage
battleship_games: Dict[str, BattleshipGameEngine] = {}

def create_battleship_game(session_id: str, players: List[str]) -> BattleshipGameEngine:
    """Create a new Battleship game"""
    game = BattleshipGameEngine(session_id, players)
    battleship_games[session_id] = game
    return game

def get_battleship_game(session_id: str) -> Optional[BattleshipGameEngine]:
    """Get an existing Battleship game"""
    return battleship_games.get(session_id)

def remove_battleship_game(session_id: str):
    """Remove a Battleship game from storage"""
    if session_id in battleship_games:
        del battleship_games[session_id]
