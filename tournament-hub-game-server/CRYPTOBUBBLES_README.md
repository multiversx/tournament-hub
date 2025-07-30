# CryptoBubbles Game Implementation

## Overview

This document describes the simplified 2-player CryptoBubbles-style game implementation for the Tournament Hub.

## Game Mechanics

The CryptoBubbles game is a real-time 1v1 cell battle where players:

- Control circular cells that can move around a large arena
- Consume pellets to grow larger
- Consume smaller opponent cells to eliminate them
- Win by being the last player standing or having the largest size when time runs out
- Experience dynamic map expansion as they explore the edges

## Architecture

### Backend Components

1. **`cryptobubbles_game_engine.py`** - Core game logic
   - `CryptoBubblesGameEngine` class handles game state
   - Real-time physics and collision detection
   - Dynamic map expansion system
   - Win condition checking

2. **`main.py`** - FastAPI server with endpoints:
   - `/cryptobubbles_game_state` - Get current game state
   - `/start_cryptobubbles_game` - Start a game session
   - `/cryptobubbles_move` - Submit player movement
   - `/join_cryptobubbles_session` - Join existing session

### Frontend Components

1. **`CryptoBubblesGame.tsx`** - React component with:
   - HTML5 Canvas rendering
   - Real-time mouse tracking
   - Viewport system for large maps
   - Mini-map display
   - Continuous movement system

## Testing

### Backend Testing

Run the backend test script:

```bash
python test_auto_submission.py
```

### Manual Testing

1. Start the backend server:
   ```bash
   python main.py
   ```

2. Start the frontend:
   ```bash
   cd ../tournament-hub-frontend
   npm run dev
   ```

3. Create a tournament with game type 5 (CryptoBubbles)

4. Join the tournament and start playing

## API Endpoints

### GET `/cryptobubbles_game_state?sessionId={id}`

Returns the current game state:

```json
{
  "session_id": "session_123",
  "players": ["player1", "player2"],
  "cells": {
    "player1": {
      "x": 100,
      "y": 200,
      "size": 25,
      "state": "alive"
    }
  },
  "pellets": [
    {
      "x": 150,
      "y": 250,
      "size": 5
    }
  ],
  "winner": null,
  "game_over": false,
  "start_time": 1234567890,
  "arena_size": [3000, 2500],
  "expansion_history": [],
  "max_arena_size": [10000, 8000]
}
```

### POST `/start_cryptobubbles_game`

Starts a CryptoBubbles game session:

```json
{
  "sessionId": "session_123"
}
```

### POST `/cryptobubbles_move`

Submits player movement:

```json
{
  "sessionId": "session_123",
  "player": "player1",
  "x": 150,
  "y": 200
}
```

## Integration

The CryptoBubbles game integrates seamlessly with the existing tournament system:

- Uses the same session management as other games
- Automatically submits results to the blockchain when games finish
- Supports the same tournament creation and joining flow
- Maintains compatibility with the existing smart contract

## Game Features

- **Real-time Movement**: Smooth cursor-following movement
- **Dynamic Map**: Expands as players explore edges
- **Collision Detection**: Precise cell-to-cell and cell-to-pellet collisions
- **Growth System**: Cells grow by consuming pellets
- **Elimination**: Larger cells can consume smaller ones
- **Time Limit**: Games end after 5 minutes with largest cell winning
- **Viewport System**: Players see a portion of the large world
- **Mini-map**: Shows world overview and player positions