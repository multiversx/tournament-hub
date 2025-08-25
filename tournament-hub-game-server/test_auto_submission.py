#!/usr/bin/env python3
"""
Test script to verify automatic submission of CryptoBubbles game results
"""

import requests
import time
import json

# Configuration
BACKEND_URL = "http://localhost:8000"
PLAYER1 = "erd1thvc8uzzdvkq4nuvqygfdkqu32evkkh3fdtt8hc672085ed3dthqhrkvvm"
PLAYER2 = "erd19npdl5d964l6ausfm7l78lj5jrg0sk8wml6t7sjs5rl7hlpjqpjsee0fps"

def test_automatic_submission():
    print("🧪 Testing Automatic Result Submission for CryptoBubbles Games")
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
    join_data = {"player": PLAYER2}
    
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
    
    # Step 4: Simulate some moves
    print("4. Simulating moves...")
    
    # Make some moves to trigger game logic
    for i in range(10):
        move_data = {
            "sessionId": session_id,
            "player": PLAYER1,
            "x": 100 + i * 10,
            "y": 100 + i * 10
        }
        
        response = requests.post(f"{BACKEND_URL}/cryptobubbles_move", json=move_data)
        if response.status_code != 200:
            print(f"❌ Failed to make move: {response.text}")
            return False
        
        time.sleep(0.1)
    
    print("✅ Moves simulated")
    
    # Step 5: Check game state
    print("5. Checking game state...")
    
    response = requests.get(f"{BACKEND_URL}/cryptobubbles_game_state?sessionId={session_id}")
    if response.status_code != 200:
        print(f"❌ Failed to get game state: {response.text}")
        return False
    
    game_state = response.json()
    print(f"✅ Game state retrieved. Game over: {game_state.get('game_over', False)}")
    
    # Step 6: Wait for game to finish (if not already finished)
    print("6. Waiting for game to finish...")
    
    max_wait = 60  # Wait up to 60 seconds
    start_time = time.time()
    
    while time.time() - start_time < max_wait:
        response = requests.get(f"{BACKEND_URL}/cryptobubbles_game_state?sessionId={session_id}")
        if response.status_code == 200:
            game_state = response.json()
            if game_state.get('game_over', False):
                winner = game_state.get('winner')
                print(f"✅ Game finished! Winner: {winner}")
                
                # Check if the automatic submission message appears in logs
                print("7. Checking for automatic submission...")
                print("   - Look for: 'CryptoBubbles game {session_id} finished! Winner: {winner}'")
                print("   - Look for: 'Results submitted for tournament X: {tx_hash}'")
                
                return True
        
        time.sleep(1)
    
    print("❌ Game did not finish within expected time")
    return False

if __name__ == "__main__":
    success = test_automatic_submission()
    if success:
        print("\n🎉 Test completed successfully!")
    else:
        print("\n💥 Test failed!")
        exit(1)