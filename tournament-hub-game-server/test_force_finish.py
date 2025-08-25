#!/usr/bin/env python3
"""
Test script to force a CryptoBubbles game to finish and test automatic submission
"""

import requests
import time
import json

# Configuration
BACKEND_URL = "http://localhost:8000"
PLAYER1 = "erd1thvc8uzzdvkq4nuvqygfdkqu32evkkh3fdtt8hc672085ed3dthqhrkvvm"
PLAYER2 = "erd19npdl5d964l6ausfm7l78lj5jrg0sk8wml6t7sjs5rl7hlpjqpjsee0fps"

def test_force_finish():
    print("🧪 Testing Force Finish for CryptoBubbles Games")
    print("=" * 60)
    
    # Step 1: Create a session
    print("1. Creating session...")
    session_data = {
        "players": [PLAYER1, PLAYER2],
        "game_type": 5  # CryptoBubbles game type
    }
    
    response = requests.post(f"{BACKEND_URL}/start_session", json=session_data)
    if response.status_code != 200:
        print(f"❌ Failed to create session: {response.text}")
        return False
    
    session_id = response.json()["session_id"]
    print(f"✅ Session created: {session_id}")
    
    # Step 2: Join session with second player
    print("2. Joining session with second player...")
    
    response = requests.post(f"{BACKEND_URL}/join_cryptobubbles_session?sessionId={session_id}&player={PLAYER2}")
    if response.status_code != 200:
        print(f"❌ Failed to join session: {response.text}")
        return False
    
    print("✅ Second player joined session")
    
    # Step 3: Start the CryptoBubbles game
    print("3. Starting CryptoBubbles game...")
    
    response = requests.post(f"{BACKEND_URL}/start_cryptobubbles_game", json={"sessionId": session_id})
    if response.status_code != 200:
        print(f"❌ Failed to start game: {response.text}")
        return False
    
    print("✅ CryptoBubbles game started")
    
    # Step 4: Force game to finish by making aggressive moves
    print("4. Forcing game to finish with aggressive moves...")
    
    # Make aggressive moves to force collision
    for i in range(50):
        # Player 1 moves towards center
        move_data = {
            "sessionId": session_id,
            "player": PLAYER1,
            "x": 1500,
            "y": 1250
        }
        requests.post(f"{BACKEND_URL}/cryptobubbles_move", json=move_data)
        
        # Player 2 moves towards center
        move_data = {
            "sessionId": session_id,
            "player": PLAYER2,
            "x": 1500,
            "y": 1250
        }
        requests.post(f"{BACKEND_URL}/cryptobubbles_move", json=move_data)
        
        time.sleep(0.1)
    
    print("✅ Aggressive moves completed")
    
    # Step 5: Check if game finished
    print("5. Checking if game finished...")
    
    response = requests.get(f"{BACKEND_URL}/cryptobubbles_game_state?sessionId={session_id}")
    if response.status_code != 200:
        print(f"❌ Failed to get game state: {response.text}")
        return False
    
    game_state = response.json()
    print(f"✅ Game state retrieved. Game over: {game_state.get('game_over', False)}")
    
    if game_state.get('game_over', False):
        winner = game_state.get('winner')
        print(f"🎉 Game finished! Winner: {winner}")
        
        # Check if the automatic submission message appears in logs
        print("6. Checking for automatic submission...")
        print("   - Look for: 'CryptoBubbles game {session_id} finished! Winner: {winner}'")
        print("   - Look for: 'Results submitted for tournament X: {tx_hash}'")
        
        return True
    else:
        print("❌ Game did not finish after aggressive moves")
        return False

if __name__ == "__main__":
    success = test_force_finish()
    if success:
        print("\n🎉 Test completed successfully!")
    else:
        print("\n💥 Test failed!")
        exit(1)