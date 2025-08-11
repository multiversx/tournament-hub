import random
import time
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

class PieceType(Enum):
    PAWN = "pawn"
    ROOK = "rook"
    KNIGHT = "knight"
    BISHOP = "bishop"
    QUEEN = "queen"
    KING = "king"

class Color(Enum):
    WHITE = "white"
    BLACK = "black"

@dataclass
class Piece:
    type: PieceType
    color: Color
    position: Tuple[int, int]
    has_moved: bool = False

@dataclass
class Move:
    from_pos: Tuple[int, int]
    to_pos: Tuple[int, int]
    piece_type: PieceType
    color: Color
    is_capture: bool = False
    is_castle: bool = False
    is_en_passant: bool = False
    is_promotion: bool = False
    promotion_piece: Optional[PieceType] = None

@dataclass
class GameState:
    board: Dict[Tuple[int, int], Piece]
    current_turn: Color
    winner: Optional[str] = None
    game_over: bool = False
    start_time: Optional[float] = None
    move_history: List[Move] = None
    white_player: Optional[str] = None
    black_player: Optional[str] = None
    white_king_pos: Tuple[int, int] = (4, 0)
    black_king_pos: Tuple[int, int] = (4, 7)
    en_passant_target: Optional[Tuple[int, int]] = None
    captured_by_white: List[Piece] = None  # Pieces captured by white player
    captured_by_black: List[Piece] = None  # Pieces captured by black player

    def __post_init__(self):
        if self.move_history is None:
            self.move_history = []
        if self.captured_by_white is None:
            self.captured_by_white = []
        if self.captured_by_black is None:
            self.captured_by_black = []

class ChessGameEngine:
    def __init__(self, session_id: str, players: List[str]):
        self.session_id = session_id
        self.players = players
        self.state = GameState(
            board={},
            current_turn=Color.WHITE,
            move_history=[],
            white_player=players[0] if len(players) > 0 else None,
            black_player=players[1] if len(players) > 1 else None
        )
        
        # Game settings
        self.game_duration = 1800  # 30 minutes
        self.move_timeout = 300  # 5 minutes per move
        
        # Initialize game
        self._initialize_game()
    
    def _initialize_game(self):
        """Initialize the chess board with pieces in starting positions"""
        # Clear the board
        self.state.board = {}
        
        # Set up pawns
        for x in range(8):
            self.state.board[(x, 1)] = Piece(PieceType.PAWN, Color.WHITE, (x, 1))
            self.state.board[(x, 6)] = Piece(PieceType.PAWN, Color.BLACK, (x, 6))
        
        # Set up other pieces
        # White pieces (bottom)
        self.state.board[(0, 0)] = Piece(PieceType.ROOK, Color.WHITE, (0, 0))
        self.state.board[(1, 0)] = Piece(PieceType.KNIGHT, Color.WHITE, (1, 0))
        self.state.board[(2, 0)] = Piece(PieceType.BISHOP, Color.WHITE, (2, 0))
        self.state.board[(3, 0)] = Piece(PieceType.QUEEN, Color.WHITE, (3, 0))
        self.state.board[(4, 0)] = Piece(PieceType.KING, Color.WHITE, (4, 0))
        self.state.board[(5, 0)] = Piece(PieceType.BISHOP, Color.WHITE, (5, 0))
        self.state.board[(6, 0)] = Piece(PieceType.KNIGHT, Color.WHITE, (6, 0))
        self.state.board[(7, 0)] = Piece(PieceType.ROOK, Color.WHITE, (7, 0))
        
        # Black pieces (top)
        self.state.board[(0, 7)] = Piece(PieceType.ROOK, Color.BLACK, (0, 7))
        self.state.board[(1, 7)] = Piece(PieceType.KNIGHT, Color.BLACK, (1, 7))
        self.state.board[(2, 7)] = Piece(PieceType.BISHOP, Color.BLACK, (2, 7))
        self.state.board[(3, 7)] = Piece(PieceType.QUEEN, Color.BLACK, (3, 7))
        self.state.board[(4, 7)] = Piece(PieceType.KING, Color.BLACK, (4, 7))
        self.state.board[(5, 7)] = Piece(PieceType.BISHOP, Color.BLACK, (5, 7))
        self.state.board[(6, 7)] = Piece(PieceType.KNIGHT, Color.BLACK, (6, 7))
        self.state.board[(7, 7)] = Piece(PieceType.ROOK, Color.BLACK, (7, 7))
        
        # Set start time
        self.state.start_time = time.time()
    
    def is_valid_move(self, from_pos: Tuple[int, int], to_pos: Tuple[int, int], color: Color) -> bool:
        """Check if a move is valid for the given piece and color"""
        if from_pos not in self.state.board:
            return False
        
        piece = self.state.board[from_pos]
        if piece.color != color:
            return False
        
        # Check if destination is occupied by own piece
        if to_pos in self.state.board and self.state.board[to_pos].color == color:
            return False
        
        # CHESS RULE: Cannot capture the king directly
        if to_pos in self.state.board and self.state.board[to_pos].type == PieceType.KING:
            return False
        
        # Check piece-specific move validation
        is_valid_piece_move = False
        if piece.type == PieceType.PAWN:
            is_valid_piece_move = self._is_valid_pawn_move(from_pos, to_pos, piece.color)
        elif piece.type == PieceType.ROOK:
            is_valid_piece_move = self._is_valid_rook_move(from_pos, to_pos)
        elif piece.type == PieceType.KNIGHT:
            is_valid_piece_move = self._is_valid_knight_move(from_pos, to_pos)
        elif piece.type == PieceType.BISHOP:
            is_valid_piece_move = self._is_valid_bishop_move(from_pos, to_pos)
        elif piece.type == PieceType.QUEEN:
            is_valid_piece_move = self._is_valid_queen_move(from_pos, to_pos)
        elif piece.type == PieceType.KING:
            is_valid_piece_move = self._is_valid_king_move(from_pos, to_pos)
        
        if not is_valid_piece_move:
            return False
        
        # CRITICAL CHESS RULE: Check if move would leave own king in check
        return not self._would_move_leave_king_in_check(from_pos, to_pos, color)
    
    def _is_valid_pawn_move(self, from_pos: Tuple[int, int], to_pos: Tuple[int, int], color: Color) -> bool:
        """Check if pawn move is valid"""
        from_x, from_y = from_pos
        to_x, to_y = to_pos
        
        direction = 1 if color == Color.WHITE else -1
        
        # Forward move (one square)
        if from_x == to_x and to_y == from_y + direction:
            return to_pos not in self.state.board
        
        # Initial two-square move
        if (from_x == to_x and to_y == from_y + 2 * direction and 
            not self.state.board[from_pos].has_moved):
            intermediate_pos = (from_x, from_y + direction)
            return (intermediate_pos not in self.state.board and 
                   to_pos not in self.state.board)
        
        # Capture move (diagonal)
        if abs(to_x - from_x) == 1 and to_y == from_y + direction:
            return to_pos in self.state.board
        
        # En passant capture
        if (abs(to_x - from_x) == 1 and to_y == from_y + direction and 
            self.state.en_passant_target == to_pos):
            return True
        
        return False
    
    def _is_valid_rook_move(self, from_pos: Tuple[int, int], to_pos: Tuple[int, int]) -> bool:
        """Check if rook move is valid"""
        from_x, from_y = from_pos
        to_x, to_y = to_pos
        
        # Rook moves horizontally or vertically
        if from_x != to_x and from_y != to_y:
            return False
        
        # Check if path is clear
        if from_x == to_x:  # Vertical move
            start_y, end_y = min(from_y, to_y), max(from_y, to_y)
            for y in range(start_y + 1, end_y):
                if (from_x, y) in self.state.board:
                    return False
        else:  # Horizontal move
            start_x, end_x = min(from_x, to_x), max(from_x, to_x)
            for x in range(start_x + 1, end_x):
                if (x, from_y) in self.state.board:
                    return False
        
        return True
    
    def _is_valid_knight_move(self, from_pos: Tuple[int, int], to_pos: Tuple[int, int]) -> bool:
        """Check if knight move is valid"""
        from_x, from_y = from_pos
        to_x, to_y = to_pos
        
        dx = abs(to_x - from_x)
        dy = abs(to_y - from_y)
        
        return (dx == 2 and dy == 1) or (dx == 1 and dy == 2)
    
    def _is_valid_bishop_move(self, from_pos: Tuple[int, int], to_pos: Tuple[int, int]) -> bool:
        """Check if bishop move is valid"""
        from_x, from_y = from_pos
        to_x, to_y = to_pos
        
        # Bishop moves diagonally
        if abs(to_x - from_x) != abs(to_y - from_y):
            return False
        
        # Check if path is clear
        dx = 1 if to_x > from_x else -1
        dy = 1 if to_y > from_y else -1
        
        x, y = from_x + dx, from_y + dy
        while x != to_x and y != to_y:
            if (x, y) in self.state.board:
                return False
            x += dx
            y += dy
        
        return True
    
    def _is_valid_queen_move(self, from_pos: Tuple[int, int], to_pos: Tuple[int, int]) -> bool:
        """Check if queen move is valid (combines rook and bishop moves)"""
        return (self._is_valid_rook_move(from_pos, to_pos) or 
                self._is_valid_bishop_move(from_pos, to_pos))
    
    def _is_valid_king_move(self, from_pos: Tuple[int, int], to_pos: Tuple[int, int]) -> bool:
        """Check if king move is valid"""
        from_x, from_y = from_pos
        to_x, to_y = to_pos
        
        dx = abs(to_x - from_x)
        dy = abs(to_y - from_y)
        
        # Normal king move (one square in any direction)
        if dx <= 1 and dy <= 1:
            return True
        
        # Castling: king moves two squares towards rook
        if dy == 0 and dx == 2:
            return self._is_valid_castle(from_pos, to_pos)
        
        return False
    
    def make_move(self, from_pos: Tuple[int, int], to_pos: Tuple[int, int], player: str) -> bool:
        """Make a move on the board"""
        # Validate player turn
        current_player = self.state.white_player if self.state.current_turn == Color.WHITE else self.state.black_player
        if player != current_player:
            return False
        
        # Validate move
        if not self.is_valid_move(from_pos, to_pos, self.state.current_turn):
            return False
        
        # Create move record
        piece = self.state.board[from_pos]
        is_capture = to_pos in self.state.board
        captured_piece = None
        
        # If capturing, save the captured piece
        if is_capture:
            captured_piece = self.state.board[to_pos]
            # Add to appropriate captured pieces list
            if piece.color == Color.WHITE:
                self.state.captured_by_white.append(captured_piece)
            else:
                self.state.captured_by_black.append(captured_piece)
        
        is_promotion = (piece.type == PieceType.PAWN and 
                       ((piece.color == Color.WHITE and to_pos[1] == 7) or 
                        (piece.color == Color.BLACK and to_pos[1] == 0)))
        
        move = Move(
            from_pos=from_pos,
            to_pos=to_pos,
            piece_type=piece.type,
            color=piece.color,
            is_capture=is_capture,
            is_castle=is_castle,
            is_en_passant=is_en_passant,
            is_promotion=is_promotion
        )
        
        # Handle special moves
        is_castle = False
        is_en_passant = False
        
        # Check for castling
        if (piece.type == PieceType.KING and 
            abs(to_pos[0] - from_pos[0]) == 2 and 
            to_pos[1] == from_pos[1]):
            is_castle = True
            self._execute_castle(from_pos, to_pos)
        else:
            # Regular move execution
            self.state.board[to_pos] = piece
            piece.position = to_pos
            piece.has_moved = True
            del self.state.board[from_pos]
        
        # Handle en passant capture
        if (piece.type == PieceType.PAWN and 
            abs(to_pos[0] - from_pos[0]) == 1 and 
            to_pos[1] == from_pos[1] + (1 if piece.color == Color.WHITE else -1) and
            to_pos not in self.state.board):
            # This is an en passant capture
            is_en_passant = True
            captured_pawn_pos = (to_pos[0], from_pos[1])
            if captured_pawn_pos in self.state.board:
                captured_piece = self.state.board[captured_pawn_pos]
                if piece.color == Color.WHITE:
                    self.state.captured_by_white.append(captured_piece)
                else:
                    self.state.captured_by_black.append(captured_piece)
                del self.state.board[captured_pawn_pos]
        
        # Handle pawn promotion (simplified - always promote to queen)
        if is_promotion:
            self.state.board[to_pos] = Piece(PieceType.QUEEN, piece.color, to_pos, True)
        
        # Update king position
        if piece.type == PieceType.KING:
            if piece.color == Color.WHITE:
                self.state.white_king_pos = to_pos
            else:
                self.state.black_king_pos = to_pos
        
        # Update en passant target
        if (piece.type == PieceType.PAWN and 
            abs(from_pos[1] - to_pos[1]) == 2):
            self.state.en_passant_target = (from_pos[0], (from_pos[1] + to_pos[1]) // 2)
        else:
            self.state.en_passant_target = None
        
        # Add move to history
        self.state.move_history.append(move)
        
        # Switch turns
        self.state.current_turn = Color.BLACK if self.state.current_turn == Color.WHITE else Color.WHITE
        
        # Check for game end conditions
        self._check_game_end()
        
        return True
    
    def _check_game_end(self):
        """Check if the game has ended"""
        # Check for checkmate (simplified)
        if self._is_checkmate():
            winner_color = Color.BLACK if self.state.current_turn == Color.WHITE else Color.WHITE
            self.state.winner = (self.state.white_player if winner_color == Color.WHITE 
                               else self.state.black_player)
            self.state.game_over = True
        
        # Check for stalemate (simplified)
        elif self._is_stalemate():
            self.state.game_over = True
        
        # Check for timeout
        elif time.time() - self.state.start_time > self.game_duration:
            # Determine winner based on material advantage (simplified)
            self._determine_winner_by_material()
            self.state.game_over = True
    
    def _is_in_check(self, color: Color) -> bool:
        """Check if the king of the given color is in check"""
        # Find the king
        king_pos = None
        for pos, piece in self.state.board.items():
            if piece.type == PieceType.KING and piece.color == color:
                king_pos = pos
                break
        
        if not king_pos:
            return False  # No king found (shouldn't happen)
        
        # Check if any opponent piece can attack the king
        opponent_color = Color.BLACK if color == Color.WHITE else Color.WHITE
        for pos, piece in self.state.board.items():
            if piece.color == opponent_color:
                # Check if this piece can attack the king's position
                # (temporarily ignore the "can't capture king" rule for this check)
                if self._is_valid_piece_move(piece, pos, king_pos):
                    return True
        
        return False
    
    def _is_valid_piece_move(self, piece, from_pos: Tuple[int, int], to_pos: Tuple[int, int]) -> bool:
        """Check if a piece can move to a position (used for check detection)"""
        # Similar to is_valid_move but without the king capture restriction
        if piece.type == PieceType.PAWN:
            return self._is_valid_pawn_move(from_pos, to_pos, piece.color)
        elif piece.type == PieceType.ROOK:
            return self._is_valid_rook_move(from_pos, to_pos)
        elif piece.type == PieceType.KNIGHT:
            return self._is_valid_knight_move(from_pos, to_pos)
        elif piece.type == PieceType.BISHOP:
            return self._is_valid_bishop_move(from_pos, to_pos)
        elif piece.type == PieceType.QUEEN:
            return self._is_valid_queen_move(from_pos, to_pos)
        elif piece.type == PieceType.KING:
            return self._is_valid_king_move(from_pos, to_pos)
        return False
    
    def _would_move_leave_king_in_check(self, from_pos: Tuple[int, int], to_pos: Tuple[int, int], color: Color) -> bool:
        """Check if a move would leave the player's own king in check"""
        # Temporarily make the move
        piece = self.state.board[from_pos]
        captured_piece = self.state.board.get(to_pos)
        
        # Execute move temporarily
        self.state.board[to_pos] = piece
        piece.position = to_pos
        del self.state.board[from_pos]
        
        # Update king position if it's the king being moved
        original_king_pos = None
        if piece.type == PieceType.KING:
            if piece.color == Color.WHITE:
                original_king_pos = self.state.white_king_pos
                self.state.white_king_pos = to_pos
            else:
                original_king_pos = self.state.black_king_pos
                self.state.black_king_pos = to_pos
        
        # Check if king is in check after the move
        in_check = self._is_in_check(color)
        
        # Undo the move
        self.state.board[from_pos] = piece
        piece.position = from_pos
        if captured_piece:
            self.state.board[to_pos] = captured_piece
        else:
            del self.state.board[to_pos]
        
        # Restore king position
        if piece.type == PieceType.KING and original_king_pos:
            if piece.color == Color.WHITE:
                self.state.white_king_pos = original_king_pos
            else:
                self.state.black_king_pos = original_king_pos
        
        return in_check
    
    def _is_valid_castle(self, from_pos: Tuple[int, int], to_pos: Tuple[int, int]) -> bool:
        """Check if castling is valid"""
        from_x, from_y = from_pos
        to_x, to_y = to_pos
        
        # King must not have moved
        king = self.state.board[from_pos]
        if king.has_moved:
            return False
        
        # King must not be in check
        if self._is_in_check(king.color):
            return False
        
        # Determine which side to castle (kingside or queenside)
        if to_x > from_x:  # Kingside castle
            rook_x = 7
            rook_pos = (7, from_y)
            squares_to_check = [(5, from_y), (6, from_y)]
        else:  # Queenside castle
            rook_x = 0
            rook_pos = (0, from_y)
            squares_to_check = [(1, from_y), (2, from_y), (3, from_y)]
        
        # Rook must exist and not have moved
        if rook_pos not in self.state.board:
            return False
        rook = self.state.board[rook_pos]
        if rook.type != PieceType.ROOK or rook.color != king.color or rook.has_moved:
            return False
        
        # Squares between king and rook must be empty
        for square in squares_to_check:
            if square in self.state.board:
                return False
        
        # King must not pass through check
        for square in squares_to_check:
            if self._is_square_under_attack(square, king.color):
                return False
        
        return True
    
    def _is_square_under_attack(self, square: Tuple[int, int], by_color: Color) -> bool:
        """Check if a square is under attack by the given color"""
        opponent_color = Color.BLACK if by_color == Color.WHITE else Color.WHITE
        for pos, piece in self.state.board.items():
            if piece.color == opponent_color:
                if self._is_valid_piece_move(piece, pos, square):
                    return True
        return False
    
    def _execute_castle(self, from_pos: Tuple[int, int], to_pos: Tuple[int, int]):
        """Execute a castling move"""
        from_x, from_y = from_pos
        to_x, to_y = to_pos
        
        king = self.state.board[from_pos]
        
        # Move the king
        self.state.board[to_pos] = king
        king.position = to_pos
        king.has_moved = True
        del self.state.board[from_pos]
        
        # Move the rook
        if to_x > from_x:  # Kingside castle
            rook_from = (7, from_y)
            rook_to = (5, from_y)
        else:  # Queenside castle
            rook_from = (0, from_y)
            rook_to = (3, from_y)
        
        rook = self.state.board[rook_from]
        self.state.board[rook_to] = rook
        rook.position = rook_to
        rook.has_moved = True
        del self.state.board[rook_from]

    def _is_checkmate(self) -> bool:
        """Check if current player is in checkmate"""
        # Check if the current player's king is in check
        if not self._is_in_check(self.state.current_turn):
            return False
        
        # Check if any legal move can escape check
        return not self._has_legal_moves()
    
    def _is_stalemate(self) -> bool:
        """Check if current player is in stalemate"""
        # King must not be in check
        if self._is_in_check(self.state.current_turn):
            return False
        
        # No legal moves available
        return not self._has_legal_moves()
    
    def _has_legal_moves(self) -> bool:
        """Check if the current player has any legal moves"""
        current_color = self.state.current_turn
        
        # Check all pieces of the current color
        for from_pos, piece in self.state.board.items():
            if piece.color == current_color:
                # Check all possible destination squares
                for to_x in range(8):
                    for to_y in range(8):
                        to_pos = (to_x, to_y)
                        if self.is_valid_move(from_pos, to_pos, current_color):
                            return True
        
        return False
    
    def _determine_winner_by_material(self):
        """Determine winner based on material advantage"""
        white_material = self._calculate_material(Color.WHITE)
        black_material = self._calculate_material(Color.BLACK)
        
        if white_material > black_material:
            self.state.winner = self.state.white_player
        elif black_material > white_material:
            self.state.winner = self.state.black_player
        # If equal, it's a draw (no winner)
    
    def _calculate_material(self, color: Color) -> int:
        """Calculate material value for a color"""
        piece_values = {
            PieceType.PAWN: 1,
            PieceType.KNIGHT: 3,
            PieceType.BISHOP: 3,
            PieceType.ROOK: 5,
            PieceType.QUEEN: 9,
            PieceType.KING: 0  # King has no material value
        }
        
        total = 0
        for piece in self.state.board.values():
            if piece.color == color:
                total += piece_values[piece.type]
        
        return total
    
    def get_game_state(self) -> dict:
        """Get the current game state as a dictionary"""
        # Convert board to serializable format
        board_state = {}
        for pos, piece in self.state.board.items():
            board_state[f"{pos[0]},{pos[1]}"] = {
                "type": piece.type.value,
                "color": piece.color.value,
                "has_moved": piece.has_moved
            }
        
        return {
            "session_id": self.session_id,
            "board": board_state,
            "current_turn": self.state.current_turn.value,
            "winner": self.state.winner,
            "game_over": self.state.game_over,
            "white_player": self.state.white_player,
            "black_player": self.state.black_player,
            "captured_by_white": [
                {
                    "type": piece.type.value,
                    "color": piece.color.value
                }
                for piece in self.state.captured_by_white
            ],
            "captured_by_black": [
                {
                    "type": piece.type.value,
                    "color": piece.color.value
                }
                for piece in self.state.captured_by_black
            ],
            "move_history": [
                {
                    "from": f"{move.from_pos[0]},{move.from_pos[1]}",
                    "to": f"{move.to_pos[0]},{move.to_pos[1]}",
                    "piece": move.piece_type.value,
                    "color": move.color.value,
                    "is_capture": move.is_capture,
                    "is_promotion": move.is_promotion
                }
                for move in self.state.move_history
            ],
            "game_type": "chess"
        }

# Global game storage
chess_games: Dict[str, ChessGameEngine] = {}

def create_chess_game(session_id: str, players: List[str]) -> ChessGameEngine:
    """Create a new chess game"""
    game = ChessGameEngine(session_id, players)
    chess_games[session_id] = game
    return game

def get_chess_game(session_id: str) -> Optional[ChessGameEngine]:
    """Get an existing chess game"""
    return chess_games.get(session_id)

def remove_chess_game(session_id: str):
    """Remove a chess game from storage"""
    if session_id in chess_games:
        del chess_games[session_id] 