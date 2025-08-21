#!/usr/bin/env python3
"""
Simple test script for Color Rush game engine
"""

from colorrush_game_engine import create_colorrush_game, get_colorrush_game, remove_colorrush_game

def test_colorrush_game():
    """Test basic Color Rush game functionality"""
    print("🧪 Testing Color Rush Game Engine...")
    
    # Test 1: Create game
    print("\n1. Creating game...")
    session_id = "test_session_123"
    players = ["player1", "player2"]
    game = create_colorrush_game(session_id, players)
    print(f"✅ Game created: {game.session_id}")
    print(f"   Players: {game.players}")
    print(f"   Board size: {len(game.state.board)}x{len(game.state.board[0])}")
    
    # Test 2: Check initial state
    print("\n2. Checking initial state...")
    state = game.get_game_state()
    print(f"✅ Initial status: {state['status']}")
    print(f"   Scores: {state['scores']}")
    print(f"   Game over: {state['game_over']}")
    
    # Test 3: Start game
    print("\n3. Starting game...")
    if game.start_game("player1"):
        print("✅ Game started successfully")
        state = game.get_game_state()
        print(f"   New status: {state['status']}")
        print(f"   Start time: {state['start_time']}")
    else:
        print("❌ Failed to start game")
    
    # Test 4: Test tile selection
    print("\n4. Testing tile selection...")
    tile_id = "0-0"
    result = game.select_tile(tile_id, "player1")
    print(f"✅ Tile selection result: {result}")
    
    # Test 5: Check updated state
    print("\n5. Checking updated state...")
    state = game.get_game_state()
    print(f"✅ Updated scores: {state['scores']}")
    print(f"   Tiles cleared: {state['tiles_cleared']}")
    print(f"   Combo multiplier: {state['combo_multiplier']}")
    
    # Test 6: Submit score
    print("\n6. Submitting score...")
    if game.submit_score("player1", 150, 15, 3):
        print("✅ Score submitted successfully")
        state = game.get_game_state()
        print(f"   Final score: {state['scores']['player1']}")
    else:
        print("❌ Failed to submit score")
    
    # Test 7: End game
    print("\n7. Ending game...")
    result = game.end_game()
    print(f"✅ Game ended: {result}")
    
    # Test 8: Check final state
    print("\n8. Checking final state...")
    state = game.get_game_state()
    print(f"✅ Final status: {state['status']}")
    print(f"   Winner: {state['winner']}")
    print(f"   Game over: {state['game_over']}")
    print(f"   Game duration: {state['game_duration']}s")
    
    # Test 9: Cleanup
    print("\n9. Cleaning up...")
    if remove_colorrush_game(session_id):
        print("✅ Game removed successfully")
    else:
        print("❌ Failed to remove game")
    
    print("\n🎉 All tests completed!")

if __name__ == "__main__":
    test_colorrush_game()
