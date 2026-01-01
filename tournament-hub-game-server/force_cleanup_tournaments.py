#!/usr/bin/env python3
"""
Script to force cleanup of stuck tournaments by directly accessing the game engines
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

def force_cleanup_tournaments():
    """Force cleanup of tournaments 66 and 67 from all game engines"""
    
    print("Force cleaning up tournaments 66 and 67...")
    
    # Import all game engines
    try:
        from dodgedash_game_engine import dodgedash_games
        print(f"DodgeDash games: {len(dodgedash_games)}")
        for session_id, game in list(dodgedash_games.items()):
            if '66' in session_id or '67' in session_id:
                print(f"  Removing DodgeDash session: {session_id}")
                del dodgedash_games[session_id]
    except Exception as e:
        print(f"Error with DodgeDash games: {e}")
    
    try:
        from tictactoe_game_engine import tictactoe_games
        print(f"TicTacToe games: {len(tictactoe_games)}")
        for session_id, game in list(tictactoe_games.items()):
            if '66' in session_id or '67' in session_id:
                print(f"  Removing TicTacToe session: {session_id}")
                del tictactoe_games[session_id]
    except Exception as e:
        print(f"Error with TicTacToe games: {e}")
    
    try:
        from chess_game_engine import chess_games
        print(f"Chess games: {len(chess_games)}")
        for session_id, game in list(chess_games.items()):
            if '66' in session_id or '67' in session_id:
                print(f"  Removing Chess session: {session_id}")
                del chess_games[session_id]
    except Exception as e:
        print(f"Error with Chess games: {e}")
    
    try:
        from colorrush_game_engine import colorrush_games
        print(f"ColorRush games: {len(colorrush_games)}")
        for session_id, game in list(colorrush_games.items()):
            if '66' in session_id or '67' in session_id:
                print(f"  Removing ColorRush session: {session_id}")
                del colorrush_games[session_id]
    except Exception as e:
        print(f"Error with ColorRush games: {e}")
    
    try:
        from cryptobubbles_game_engine import cryptobubbles_games
        print(f"CryptoBubbles games: {len(cryptobubbles_games)}")
        for session_id, game in list(cryptobubbles_games.items()):
            if '66' in session_id or '67' in session_id:
                print(f"  Removing CryptoBubbles session: {session_id}")
                del cryptobubbles_games[session_id]
    except Exception as e:
        print(f"Error with CryptoBubbles games: {e}")
    
    print("Force cleanup complete!")

if __name__ == "__main__":
    force_cleanup_tournaments()
