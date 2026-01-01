#!/usr/bin/env python3
"""
Script to clean up stuck tournaments 66 and 67 that have corrupted addresses
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from dodgedash_game_engine import dodgedash_games

def cleanup_stuck_tournaments():
    """Clean up tournaments 66 and 67 that are stuck with corrupted addresses"""
    
    print("Current DodgeDash games in memory:")
    for session_id, game in dodgedash_games.items():
        print(f"  Session: {session_id}")
        print(f"    Players: {game.players}")
        print(f"    Winner: {game.winner}")
        print(f"    Game Over: {game.game_over}")
        print(f"    Results Submitted: {getattr(game, 'results_submitted', False)}")
        print()
    
    # Find sessions related to tournaments 66 and 67
    stuck_sessions = []
    for session_id, game in dodgedash_games.items():
        if ('66' in session_id or '67' in session_id) and game.game_over:
            stuck_sessions.append(session_id)
            print(f"Found stuck session: {session_id}")
            print(f"  Winner: {repr(game.winner)}")
            print(f"  Players: {game.players}")
            print()
    
    if not stuck_sessions:
        print("No stuck sessions found for tournaments 66 and 67")
        return
    
    # Clean up corrupted players and mark as submitted to stop retrying
    for session_id in stuck_sessions:
        game = dodgedash_games[session_id]
        print(f"Cleaning up session: {session_id}")
        
        # Clean up corrupted players
        game.cleanup_corrupted_players()
        
        # If no valid players remain, remove the game entirely
        if not game.players or all(not p.startswith('erd') or len(p) < 60 for p in game.players):
            print(f"  Removing session {session_id} - no valid players")
            del dodgedash_games[session_id]
        else:
            # Mark as submitted to stop retrying
            game.results_submitted = True
            print(f"  Marked session {session_id} as submitted to stop retrying")
    
    print(f"\nCleanup complete. Remaining games: {len(dodgedash_games)}")
    for session_id, game in dodgedash_games.items():
        print(f"  {session_id}: {len(game.players)} players, winner: {repr(game.winner)}")

if __name__ == "__main__":
    cleanup_stuck_tournaments()
