#!/usr/bin/env python3

import requests
import json
import time

def test_bot_killing():
    """Test that killed bots disappear from the game"""
    
    # Start a new session
    session_data = {
        "tournamentId": "test_bot_kill",
        "playerAddresses": [
            "erd19npdl5d964l6ausfm7l78lj5jrg0sk8wml6t7sjs5rl7hlpjqpjsee0fps",
            "erd1thvc8uzzdvkq4nuvqygfdkqu32evkkh3fdtt8hc672085ed3dthqhrkvvm"
        ]
    }
    
    response = requests.post("http://localhost:8000/start_session", json=session_data)
    session_info = response.json()
    session_id = session_info["session_id"]
    
    print(f"Created session: {session_id}")
    
    # Get initial game state
    response = requests.get(f"http://localhost:8000/cryptobubbles_game_state?sessionId={session_id}")
    game_state = response.json()
    
    print("\nInitial bots:")
    for bot_name, bot_data in game_state["cells"].items():
        if bot_name.startswith("Bot_"):
            print(f"  {bot_name}: state={bot_data['state']}, size={bot_data['size']}")
    
    # Simulate killing Bot_1 by making a player much bigger and moving to Bot_1's position
    player_address = "erd19npdl5d964l6ausfm7l78lj5jrg0sk8wml6t7sjs5rl7hlpjqpjsee0fps"
    
    # First, let's make the player bigger by eating pellets
    for _ in range(50):  # Eat many pellets to grow
        response = requests.post(f"http://localhost:8000/cryptobubbles_move", json={
            "sessionId": session_id,
            "player": player_address,
            "targetX": 1000,
            "targetY": 1000
        })
        time.sleep(0.1)
    
    # Now move to Bot_1's position to trigger collision
    bot1 = game_state["cells"]["Bot_1"]
    print(f"\nMoving player to Bot_1 position: ({bot1['x']}, {bot1['y']})")
    
    response = requests.post(f"http://localhost:8000/cryptobubbles_move", json={
        "sessionId": session_id,
        "player": player_address,
        "targetX": bot1["x"],
        "targetY": bot1["y"]
    })
    
    # Wait a moment for collision detection
    time.sleep(2)
    
    # Check game state again
    response = requests.get(f"http://localhost:8000/cryptobubbles_game_state?sessionId={session_id}")
    game_state = response.json()
    
    print("\nAfter collision attempt:")
    for bot_name, bot_data in game_state["cells"].items():
        if bot_name.startswith("Bot_"):
            print(f"  {bot_name}: state={bot_data['state']}, size={bot_data['size']}")
    
    # Check if Bot_1 is dead
    bot1_after = game_state["cells"].get("Bot_1")
    if bot1_after and bot1_after["state"] == "dead":
        print("\n✅ SUCCESS: Bot_1 is now dead and should disappear from the frontend!")
    else:
        print("\n❌ FAILED: Bot_1 is still alive or not found")

if __name__ == "__main__":
    test_bot_killing() 