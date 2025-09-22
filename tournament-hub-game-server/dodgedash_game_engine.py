from __future__ import annotations
from typing import Dict, List, Optional
import time
import math
import random


class DodgeDashGameEngine:
    def __init__(self, session_id: str, players: List[str]):
        self.session_id = session_id
        self.players = players[:]  # addresses
        self.created_at = time.time()
        self.arena_size = (1600, 1000)
        # Player state
        # x, y, vx, vy, lives, alive
        self.player_state: Dict[str, Dict] = {}
        # Hazards list of dict {x,y,vx,vy,r}
        self.hazards: List[Dict] = []
        self.spawn_interval = 1.0
        self._last_spawn = 0.0
        self.game_over = False
        self.winner: Optional[str] = None
        self.results_submitted = False
        self.last_survivor: Optional[str] = None
        self._init_players()

    def _init_players(self):
        w, h = self.arena_size
        for i, p in enumerate(self.players):
            self.player_state[p] = {
                'x': w * (0.3 + 0.4 * (i % 2)),
                'y': h * (0.3 + 0.4 * (i // 2)),
                'vx': 0.0,
                'vy': 0.0,
                'lives': 3,
                'alive': True,
            }

    def move_player(self, player: str, ax: float, ay: float, dash: bool = False):
        if self.game_over or player not in self.player_state:
            return
        st = self.player_state[player]
        if not st['alive']:
            return
        # Integrate acceleration into velocity
        # Clamp acceleration
        ax = max(-800.0, min(800.0, ax))
        ay = max(-800.0, min(800.0, ay))
        st['vx'] += ax * 0.02
        st['vy'] += ay * 0.02
        # Dash
        if dash:
            vlen = math.hypot(st['vx'], st['vy'])
            if vlen > 1:
                st['vx'] *= 1.7
                st['vy'] *= 1.7
            else:
                st['vy'] -= 400.0 * 0.02
        # Clamp speed
        vmax = 260.0
        vlen = math.hypot(st['vx'], st['vy'])
        if vlen > vmax:
            scale = vmax / vlen
            st['vx'] *= scale
            st['vy'] *= scale

    def add_player(self, player: str):
        # Validate player address format
        if not player or not isinstance(player, str):
            return
        if not player.startswith('erd') or len(player) < 60:
            return
        if any(ord(c) < 32 or ord(c) > 126 for c in player):  # Check for non-printable characters
            return
            
        if player in self.player_state:
            return
        self.players.append(player)
        w, h = self.arena_size
        self.player_state[player] = {
            'x': random.random() * w,
            'y': random.random() * h,
            'vx': 0.0,
            'vy': 0.0,
            'lives': 3,
            'alive': True,
        }

    def _spawn_hazard(self):
        w, h = self.arena_size
        edge = random.randint(0, 3)
        if edge == 0:
            x, y, vx, vy = -10, random.random() * h, random.uniform(120, 260), 0
        elif edge == 1:
            x, y, vx, vy = w + 10, random.random() * h, -random.uniform(120, 260), 0
        elif edge == 2:
            x, y, vx, vy = random.random() * w, -10, 0, random.uniform(120, 260)
        else:
            x, y, vx, vy = random.random() * w, h + 10, 0, -random.uniform(120, 260)
        r = random.uniform(10, 18)
        self.hazards.append({'x': x, 'y': y, 'vx': vx, 'vy': vy, 'r': r})

    def update_game_state(self):
        if self.game_over:
            return
        now = time.time()
        # Spawn hazards
        if now - self._last_spawn >= self.spawn_interval:
            self._last_spawn = now
            # spawn more hazards as game progresses
            for _ in range(1 + int((now - self.created_at) / 15)):
                self._spawn_hazard()

        # Integrate hazards
        w, h = self.arena_size
        for hz in self.hazards:
            hz['x'] += hz['vx'] * 0.02
            hz['y'] += hz['vy'] * 0.02
            # bounce on walls
            if hz['x'] < 0 or hz['x'] > w:
                hz['vx'] *= -1
            if hz['y'] < 0 or hz['y'] > h:
                hz['vy'] *= -1

        # Integrate players positions
        for p, st in self.player_state.items():
            if not st['alive']:
                continue
            st['x'] = max(0, min(w, st['x'] + st['vx'] * 0.02))
            st['y'] = max(0, min(h, st['y'] + st['vy'] * 0.02))
            # friction
            st['vx'] *= 0.98
            st['vy'] *= 0.98
            # collisions
            for hz in self.hazards:
                dx = hz['x'] - st['x']
                dy = hz['y'] - st['y']
                if dx * dx + dy * dy <= (hz['r'] + 12) ** 2:
                    st['lives'] -= 1
                    # knock-back
                    st['vx'] -= dx * 0.5
                    st['vy'] -= dy * 0.5
                    # move hazard off-screen
                    hz['x'] = -1000
                    hz['y'] = -1000
                    if st['lives'] <= 0:
                        st['alive'] = False
                        # Update last survivor candidate
                        alive_humans = [pp for pp in self.players if self.player_state.get(pp, {}).get('alive')]
                        if len(alive_humans) == 1:
                            self.last_survivor = alive_humans[0]
                        break

        # Determine game over
        alive_humans = [p for p in self.players if self.player_state.get(p, {}).get('alive')]
        if len(alive_humans) <= 1:
            self.game_over = True
            # Find a valid winner from alive players, last survivor, or valid players
            potential_winners = []
            if alive_humans:
                potential_winners.extend(alive_humans)
            if self.last_survivor:
                potential_winners.append(self.last_survivor)
            if self.players:
                potential_winners.extend(self.players)
            
            # Find first valid address
            for candidate in potential_winners:
                if (candidate and isinstance(candidate, str) and 
                    candidate.startswith('erd') and len(candidate) >= 60 and
                    not any(ord(c) < 32 or ord(c) > 126 for c in candidate)):
                    self.winner = candidate
                    break
            else:
                self.winner = None  # No valid winner found

    def cleanup_corrupted_players(self):
        """Remove corrupted player addresses from the game"""
        corrupted_players = []
        for player in self.players:
            if (not player or not isinstance(player, str) or 
                not player.startswith('erd') or len(player) < 60 or
                any(ord(c) < 32 or ord(c) > 126 for c in player)):
                corrupted_players.append(player)
        
        for player in corrupted_players:
            if player in self.players:
                self.players.remove(player)
            if player in self.player_state:
                del self.player_state[player]
        
        if corrupted_players:
            print(f"Cleaned up corrupted players: {corrupted_players}")

    def get_game_state(self) -> Dict:
        # Clean up any corrupted players first
        self.cleanup_corrupted_players()
        
        # Calculate current wave based on game time
        current_wave = int((time.time() - self.created_at) / 15) + 1
        
        return {
            'session_id': self.session_id,
            'game_type': 'dodgedash',
            'arena_size': self.arena_size,
            'created_at': self.created_at,
            'wave': current_wave,
            'players': {
                p: {
                    'x': st['x'], 'y': st['y'], 'vx': st['vx'], 'vy': st['vy'], 'lives': st['lives'], 'alive': st['alive']
                } for p, st in self.player_state.items()
            },
            'hazards': self.hazards,
            'game_over': self.game_over,
            'winner': self.winner
        }


# Global storage similar to other engines
dodgedash_games: Dict[str, DodgeDashGameEngine] = {}


def create_dodgedash_game(session_id: str, players: List[str]) -> DodgeDashGameEngine:
    game = DodgeDashGameEngine(session_id, players)
    dodgedash_games[session_id] = game
    return game


def get_dodgedash_game(session_id: str) -> Optional[DodgeDashGameEngine]:
    return dodgedash_games.get(session_id)


def remove_dodgedash_game(session_id: str):
    if session_id in dodgedash_games:
        del dodgedash_games[session_id]

