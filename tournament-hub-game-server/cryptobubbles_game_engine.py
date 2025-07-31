import random
import math
import time
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

class CellState(Enum):
    ALIVE = "alive"
    DEAD = "dead"

@dataclass
class Cell:
    x: float
    y: float
    size: float
    player: str
    state: CellState = CellState.ALIVE

@dataclass
class Pellet:
    x: float
    y: float
    size: float = 5.0

@dataclass
class GameState:
    cells: Dict[str, Cell]
    pellets: List[Pellet]
    winner: Optional[str] = None
    game_over: bool = False
    start_time: Optional[float] = None
    arena_size: Tuple[int, int] = (3000, 2500)
    expansion_history: List[Dict] = None

    def __post_init__(self):
        if self.expansion_history is None:
            self.expansion_history = []

class CryptoBubblesGameEngine:
    def __init__(self, session_id: str, players: List[str]):
        self.session_id = session_id
        self.players = players
        self.state = GameState(
            cells={},
            pellets=[],
            arena_size=(3000, 2500),
            expansion_history=[]
        )
        
        # Game settings
        self.min_cell_size = 20
        self.max_cell_size = 200
        self.game_duration = 300  # 5 minutes
        self.expansion_threshold = 400  # Increased to trigger expansion earlier
        self.expansion_amount = 1000
        self.max_arena_size = (10000, 8000)
        
        # Dynamic settings based on player count (will be set in _initialize_game)
        self.pellet_count = 200
        self.bot_count = 3
        
        # Initialize game
        self._initialize_game()
    
    def _initialize_game(self):
        """Initialize the game with players and pellets"""
        # Calculate arena size based on player count
        self._calculate_arena_size()
        
        # Scale pellet and bot count based on player count
        self._scale_game_resources()
        
        # Position players dynamically
        self._position_players()
        
        # Add bots
        self._add_bots()
        
        # Generate pellets
        self._generate_pellets()
    
    def _calculate_arena_size(self):
        """Calculate arena size based on number of players"""
        num_players = len(self.players)
        
        # Base arena size for 2 players
        base_width, base_height = 3000, 2500
        
        # Scale arena size based on player count
        if num_players <= 2:
            self.state.arena_size = (base_width, base_height)
        elif num_players <= 4:
            self.state.arena_size = (4000, 3500)
        elif num_players <= 6:
            self.state.arena_size = (5000, 4000)
        else:  # 7-8 players
            self.state.arena_size = (6000, 5000)
        
        # Update max arena size for expansion - use the fixed maximum size
        # This ensures consistent expansion regardless of initial arena size
        self.max_arena_size = (10000, 8000)
    
    def _position_players(self):
        """Position players evenly across the arena"""
        arena_size = self.state.arena_size
        num_players = len(self.players)
        
        if num_players == 1:
            # Single player starts in center
            self.state.cells[self.players[0]] = Cell(
                x=arena_size[0] // 2, y=arena_size[1] // 2,
                size=self.min_cell_size, player=self.players[0]
            )
        elif num_players == 2:
            # Two players at opposite corners
            self.state.cells[self.players[0]] = Cell(
                x=200, y=200, size=self.min_cell_size, player=self.players[0]
            )
            self.state.cells[self.players[1]] = Cell(
                x=arena_size[0] - 200, y=arena_size[1] - 200,
                size=self.min_cell_size, player=self.players[1]
            )
        else:
            # Multiple players in a circle pattern
            center_x, center_y = arena_size[0] // 2, arena_size[1] // 2
            radius = min(arena_size[0], arena_size[1]) * 0.25  # 25% of arena size
            
            for i, player in enumerate(self.players):
                angle = (2 * math.pi * i) / num_players
                x = center_x + radius * math.cos(angle)
                y = center_y + radius * math.sin(angle)
                
                # Ensure players are within arena bounds
                x = max(200, min(x, arena_size[0] - 200))
                y = max(200, min(y, arena_size[1] - 200))
                
                self.state.cells[player] = Cell(
                    x=x, y=y, size=self.min_cell_size, player=player
                                 )
    
    def _scale_game_resources(self):
        """Scale pellet count and bot count based on player count"""
        num_players = len(self.players)
        
        # Scale pellet count: base 100 per player, minimum 200
        self.pellet_count = max(200, 100 * num_players)
        
        # Scale bot count: 1 bot per 2 players, minimum 2, maximum 6
        self.bot_count = max(2, min(6, num_players // 2))
    
    def _generate_pellets(self):
        """Generate pellets randomly across the arena"""
        arena_size = self.state.arena_size
        self.state.pellets = []
        
        for _ in range(self.pellet_count):
            pellet = Pellet(
                x=random.randint(100, arena_size[0] - 100),
                y=random.randint(100, arena_size[1] - 100)
            )
            self.state.pellets.append(pellet)
    
    def _add_bots(self):
        """Add bots to the game"""
        arena_size = self.state.arena_size
        
        for i in range(self.bot_count):
            bot_name = f"Bot_{i+1}"
            
            # Place bots in different areas of the map
            if i == 0:
                # Bot 1: Top-left area
                x = random.randint(500, arena_size[0] // 3)
                y = random.randint(500, arena_size[1] // 3)
            elif i == 1:
                # Bot 2: Top-right area
                x = random.randint(2 * arena_size[0] // 3, arena_size[0] - 500)
                y = random.randint(500, arena_size[1] // 3)
            elif i == 2:
                # Bot 3: Bottom-left area
                x = random.randint(500, arena_size[0] // 3)
                y = random.randint(2 * arena_size[1] // 3, arena_size[1] - 500)
            elif i == 3:
                # Bot 4: Bottom-right area
                x = random.randint(2 * arena_size[0] // 3, arena_size[0] - 500)
                y = random.randint(2 * arena_size[1] // 3, arena_size[1] - 500)
            elif i == 4:
                # Bot 5: Center area
                x = random.randint(arena_size[0] // 3, 2 * arena_size[0] // 3)
                y = random.randint(arena_size[1] // 3, 2 * arena_size[1] // 3)
            else:
                # Bot 6+: Random position
                x = random.randint(500, arena_size[0] - 500)
                y = random.randint(500, arena_size[1] - 500)
            
            # Random size between min and max
            bot_size = random.randint(self.min_cell_size, self.min_cell_size + 10)
            
            self.state.cells[bot_name] = Cell(
                x=x, y=y, size=bot_size, player=bot_name
            )
    
    def _move_bots(self):
        """Move bots randomly around the arena"""
        arena_size = self.state.arena_size
        
        for bot_name, bot in self.state.cells.items():
            if bot_name.startswith("Bot_") and bot.state == CellState.ALIVE:
                # Initialize bot target if not exists
                if not hasattr(bot, 'target_x') or not hasattr(bot, 'target_y'):
                    bot.target_x = random.randint(100, arena_size[0] - 100)
                    bot.target_y = random.randint(100, arena_size[1] - 100)
                
                # Check if bot reached target or should change direction
                distance_to_target = math.sqrt((bot.x - bot.target_x)**2 + (bot.y - bot.target_y)**2)
                
                # Look for nearby pellets to eat
                nearest_pellet = None
                nearest_pellet_distance = float('inf')
                
                for pellet in self.state.pellets:
                    pellet_distance = math.sqrt((bot.x - pellet.x)**2 + (bot.y - pellet.y)**2)
                    if pellet_distance < nearest_pellet_distance and pellet_distance < 200:  # Within 200 pixels
                        nearest_pellet = pellet
                        nearest_pellet_distance = pellet_distance
                
                # Change target if reached current target, found nearby pellet, or randomly (15% chance)
                if distance_to_target < 50 or nearest_pellet or random.random() < 0.15:
                    if nearest_pellet:
                        # Move towards nearest pellet
                        bot.target_x = nearest_pellet.x
                        bot.target_y = nearest_pellet.y
                    else:
                        # Generate new random target
                        bot.target_x = random.randint(100, arena_size[0] - 100)
                        bot.target_y = random.randint(100, arena_size[1] - 100)
                
                # Move towards current target
                dx = bot.target_x - bot.x
                dy = bot.target_y - bot.y
                distance = math.sqrt(dx**2 + dy**2)
                
                if distance > 0:
                    # Normalize direction
                    dx /= distance
                    dy /= distance
                    
                    # Bot speed (slightly slower than players, but more consistent)
                    speed = max(3, 8 - (bot.size - self.min_cell_size) / 12)
                    
                    # Move bot
                    bot.x += dx * speed
                    bot.y += dy * speed
                    
                    # Keep bot within arena bounds
                    bot.x = max(bot.size, min(bot.x, arena_size[0] - bot.size))
                    bot.y = max(bot.size, min(bot.y, arena_size[1] - bot.size))
    
    def _check_and_expand_map(self):
        """Check if players are near edges and expand map if needed"""
        arena_size = self.state.arena_size
        
        # Check which edges need expansion
        expand_right = False
        expand_left = False
        expand_top = False
        expand_bottom = False
        
        for cell in self.state.cells.values():
            if cell.x < self.expansion_threshold:
                expand_left = True
            if cell.x > arena_size[0] - self.expansion_threshold:
                expand_right = True
            if cell.y < self.expansion_threshold:
                expand_top = True
            if cell.y > arena_size[1] - self.expansion_threshold:
                expand_bottom = True
        
        # Calculate new dimensions based on needed expansions
        new_width = arena_size[0]
        new_height = arena_size[1]
        
        if expand_right and arena_size[0] < self.max_arena_size[0]:
            new_width = min(arena_size[0] + self.expansion_amount, self.max_arena_size[0])
        if expand_left and arena_size[0] < self.max_arena_size[0]:
            new_width = min(arena_size[0] + self.expansion_amount, self.max_arena_size[0])
        if expand_top and arena_size[1] < self.max_arena_size[1]:
            new_height = min(arena_size[1] + self.expansion_amount, self.max_arena_size[1])
        if expand_bottom and arena_size[1] < self.max_arena_size[1]:
            new_height = min(arena_size[1] + self.expansion_amount, self.max_arena_size[1])
        
        # Only expand if needed
        if new_width > arena_size[0] or new_height > arena_size[1]:
            print(f"MAP EXPANSION: {arena_size} -> ({new_width}, {new_height})")
            print(f"  Reasons: right={expand_right}, left={expand_left}, top={expand_top}, bottom={expand_bottom}")
            
            # Add expansion to history
            self.state.expansion_history.append({
                'timestamp': time.time(),
                'old_size': arena_size,
                'new_size': (new_width, new_height),
                'reason': f'expand_{"right" if expand_right else ""}{"left" if expand_left else ""}{"top" if expand_top else ""}{"bottom" if expand_bottom else ""}'
            })
            
            # Keep only last 5 expansions
            if len(self.state.expansion_history) > 5:
                self.state.expansion_history = self.state.expansion_history[-5:]
            
            # Update arena size
            self.state.arena_size = (new_width, new_height)
            
            # Add more pellets to the expanded area
            new_pellets = random.randint(50, 100)
            for _ in range(new_pellets):
                pellet = Pellet(
                    x=random.randint(100, new_width - 100),
                    y=random.randint(100, new_height - 100)
                )
                self.state.pellets.append(pellet)
    
    def update_game_state(self):
        """Update the game state (called periodically)"""
        if self.state.game_over:
            return
        
        # Start the game timer if not started
        if self.state.start_time is None:
            self.state.start_time = time.time()
        
        # Check if game time is up
        if time.time() - self.state.start_time >= self.game_duration:
            self._end_game_by_time()
            return
        
        # Check for map expansion
        self._check_and_expand_map()
        
        # Move bots randomly
        self._move_bots()
        
        # Check for collisions
        self._check_collisions()
        
        # Check win conditions
        self._check_win_conditions()
    
    def _check_collisions(self):
        """Check for collisions between cells and pellets"""
        # Check cell-pellet collisions
        for cell in list(self.state.cells.values()):
            if cell.state == CellState.DEAD:
                continue
                
            for pellet in list(self.state.pellets):
                distance = math.sqrt((cell.x - pellet.x)**2 + (cell.y - pellet.y)**2)
                if distance < cell.size:
                    # Cell eats pellet
                    cell.size = min(cell.size + 2, self.max_cell_size)
                    self.state.pellets.remove(pellet)
        
        # Check cell-cell collisions
        cells_list = list(self.state.cells.values())
        for i, cell1 in enumerate(cells_list):
            if cell1.state == CellState.DEAD:
                continue
                
            for cell2 in cells_list[i+1:]:
                if cell2.state == CellState.DEAD:
                    continue
                    
                distance = math.sqrt((cell1.x - cell2.x)**2 + (cell1.y - cell2.y)**2)
                # Collision occurs when the distance is less than the sum of the two cell radii
                if distance < (cell1.size + cell2.size):
                    print(f"COLLISION DETECTED! Distance: {distance}, Cell1: {cell1.player} at ({cell1.x}, {cell1.y}) size {cell1.size}, Cell2: {cell2.player} at ({cell2.x}, {cell2.y}) size {cell2.size}")
                    # Determine winner based on size
                    if cell1.size > cell2.size * 1.1:  # 10% size advantage needed
                        cell2.state = CellState.DEAD
                        cell1.size = min(cell1.size + cell2.size * 0.5, self.max_cell_size)
                    elif cell2.size > cell1.size * 1.1:
                        cell1.state = CellState.DEAD
                        cell2.size = min(cell2.size + cell1.size * 0.5, self.max_cell_size)
                    else:
                        # Same size or very close - random winner (or first player wins)
                        if cell1.player < cell2.player:  # Use player address as tiebreaker
                            cell2.state = CellState.DEAD
                            cell1.size = min(cell1.size + cell2.size * 0.5, self.max_cell_size)
                        else:
                            cell1.state = CellState.DEAD
                            cell2.size = min(cell2.size + cell1.size * 0.5, self.max_cell_size)
    
    def _check_win_conditions(self):
        """Check if the game should end"""
        # Only consider human players (not bots) for win conditions
        alive_human_players = [cell for cell in self.state.cells.values() 
                              if cell.state == CellState.ALIVE and not cell.player.startswith("Bot_")]
        
        # Game only ends when there are multiple players and only one remains
        # Don't end game if there's only 1 player (waiting for others to join)
        if len(alive_human_players) == 0:
            # No human players alive - end game with no winner
            self._end_game_by_elimination()
        elif len(alive_human_players) == 1 and len(self.players) > 1:
            # Only one player remains and there were originally multiple players - end game
            self._end_game_by_elimination()
    
    def _end_game_by_elimination(self):
        """End game when no human players remain alive"""
        alive_human_players = [cell for cell in self.state.cells.values() 
                              if cell.state == CellState.ALIVE and not cell.player.startswith("Bot_")]
        
        if len(alive_human_players) == 1:
            # One player remains - they win
            self.state.winner = alive_human_players[0].player
        elif len(alive_human_players) > 1:
            # Multiple players still alive - this shouldn't happen with current logic
            # Find the largest player as winner
            largest_cell = max(alive_human_players, key=lambda c: c.size)
            self.state.winner = largest_cell.player
        else:
            # No human players alive, no winner
            self.state.winner = None
        
        self.state.game_over = True
    
    def _end_game_by_time(self):
        """End game when time runs out - largest human player wins"""
        alive_human_players = [cell for cell in self.state.cells.values() 
                              if cell.state == CellState.ALIVE and not cell.player.startswith("Bot_")]
        
        if alive_human_players:
            largest_cell = max(alive_human_players, key=lambda c: c.size)
            self.state.winner = largest_cell.player
        else:
            self.state.winner = None
        
        self.state.game_over = True
    
    def move_player(self, player: str, target_x: float, target_y: float):
        """Move a player towards a target position"""
        if player not in self.state.cells or self.state.cells[player].state == CellState.DEAD:
            return
        
        cell = self.state.cells[player]
        
        # Calculate direction
        dx = target_x - cell.x
        dy = target_y - cell.y
        distance = math.sqrt(dx**2 + dy**2)
        
        if distance > 0:
            # Normalize direction
            dx /= distance
            dy /= distance
            
            # Calculate speed (larger cells move slower, but base speed is moderate) - increased by 20%
            speed = max(4, 10 - (cell.size - self.min_cell_size) / 12)
            
            # Store original position for collision prevention
            original_x, original_y = cell.x, cell.y
            
            # Move cell
            cell.x += dx * speed
            cell.y += dy * speed
            
            # Keep cell within arena bounds
            cell.x = max(cell.size, min(cell.x, self.state.arena_size[0] - cell.size))
            cell.y = max(cell.size, min(cell.y, self.state.arena_size[1] - cell.size))
            
            # Prevent overlapping with other cells
            self._prevent_cell_overlap(cell, original_x, original_y)
    
    def _prevent_cell_overlap(self, moving_cell, original_x, original_y):
        """Prevent a cell from overlapping with other cells by pushing it back if needed"""
        for other_cell in self.state.cells.values():
            if other_cell == moving_cell or other_cell.state == CellState.DEAD:
                continue
                
            distance = math.sqrt((moving_cell.x - other_cell.x)**2 + (moving_cell.y - other_cell.y)**2)
            min_distance = moving_cell.size + other_cell.size
            
            if distance < min_distance:
                # Calculate push direction
                if distance > 0:
                    push_x = (moving_cell.x - other_cell.x) / distance
                    push_y = (moving_cell.y - other_cell.y) / distance
                else:
                    # If cells are exactly on top of each other, push in a random direction
                    push_x, push_y = 1, 0
                
                # Push the moving cell back to minimum distance
                push_distance = min_distance - distance + 1  # +1 to ensure no overlap
                moving_cell.x = other_cell.x + push_x * min_distance
                moving_cell.y = other_cell.y + push_y * min_distance
                
                # Keep within arena bounds after push
                moving_cell.x = max(moving_cell.size, min(moving_cell.x, self.state.arena_size[0] - moving_cell.size))
                moving_cell.y = max(moving_cell.size, min(moving_cell.y, self.state.arena_size[1] - moving_cell.size))
    
    def get_game_state(self) -> dict:
        """Get the current game state for API response"""
        return {
            "session_id": self.session_id,
            "players": self.players,
            "cells": {
                player: {
                    "x": cell.x,
                    "y": cell.y,
                    "size": cell.size,
                    "state": cell.state.value
                }
                for player, cell in self.state.cells.items()
            },
            "pellets": [
                {"x": pellet.x, "y": pellet.y, "size": pellet.size}
                for pellet in self.state.pellets
            ],
            "winner": self.state.winner,
            "game_over": self.state.game_over,
            "start_time": self.state.start_time,
            "arena_size": self.state.arena_size,
            "expansion_history": self.state.expansion_history[-5:],  # Last 5 expansions
            "max_arena_size": self.max_arena_size
        }

# Global game storage
active_games: Dict[str, CryptoBubblesGameEngine] = {}

def create_cryptobubbles_game(session_id: str, players: List[str]) -> CryptoBubblesGameEngine:
    """Create a new CryptoBubbles game instance"""
    game = CryptoBubblesGameEngine(session_id, players)
    active_games[session_id] = game
    return game

def get_cryptobubbles_game(session_id: str) -> Optional[CryptoBubblesGameEngine]:
    """Get an existing CryptoBubbles game instance"""
    return active_games.get(session_id)

def remove_cryptobubbles_game(session_id: str):
    """Remove a CryptoBubbles game instance"""
    if session_id in active_games:
        del active_games[session_id]