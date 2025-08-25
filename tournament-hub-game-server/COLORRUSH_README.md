# Color Rush Game

## Overview

Color Rush is a fast-paced, mobile-friendly tile-matching game designed for the Tournament Hub platform. Players match tiles of the same color to score points while building combos for higher scores.

## Game Features

- **8x8 Grid**: Perfect size for mobile devices
- **60-Second Timer**: Fast-paced gameplay with time pressure
- **Combo System**: Chain matches for multiplier bonuses
- **Colorful Tiles**: 8 vibrant colors for engaging gameplay
- **Mobile Optimized**: Touch-friendly interface
- **Tournament Ready**: Integrated scoring and result submission

## How to Play

1. **Start Game**: Click the "Start Game" button to begin
2. **Match Tiles**: Tap two tiles of the same color to match them
3. **Build Combos**: Successful matches increase your combo multiplier
4. **Score Points**: Each match gives points based on combo level
5. **Beat the Clock**: Clear as many tiles as possible in 60 seconds

## Scoring System

- **Base Score**: 10 points per match
- **Combo Multiplier**: Increases with each successful match (max x5)
- **Final Score**: Base score × Combo multiplier
- **Time Bonus**: Additional points for fast completion

## Technical Implementation

### Frontend (React + TypeScript)

- **Component**: `ColorRush.tsx`
- **State Management**: Local game state with backend sync
- **UI Framework**: Chakra UI for responsive design
- **Mobile First**: Optimized for touch devices

### Backend (Python + FastAPI)

- **Game Engine**: `colorrush_game_engine.py`
- **API Endpoints**: RESTful endpoints for game management
- **Session Management**: Player tracking and game state
- **Result Submission**: Tournament integration

### API Endpoints

- `POST /join_colorrush_session` - Join game session
- `POST /start_colorrush_game` - Start the game
- `GET /colorrush_game_state` - Get current game state
- `POST /submit_colorrush_score` - Submit final score
- `POST /colorrush_tile_click` - Handle tile selection

## Game States

1. **WAITING**: Players joining, game not started
2. **PLAYING**: Active gameplay with timer running
3. **FINISHED**: Game completed, results available

## Integration

### Tournament System

- **Game ID**: 4 (in tournament contract)
- **Scoring**: Point-based ranking system
- **Results**: Automatic submission to blockchain
- **Winner**: Player with highest score

### Mobile Optimization

- **Touch Controls**: Simple tap interface
- **Responsive Grid**: Adapts to screen size
- **Visual Feedback**: Clear tile states and animations
- **Performance**: Optimized for smooth gameplay

## Customization

### Colors

The game uses 8 predefined colors that can be easily modified in the `COLORS` array:

```python
COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F']
```

### Board Size

Change `BOARD_SIZE` constant for different grid dimensions (default: 8x8).

### Game Duration

Modify `game_duration` in the game engine for longer/shorter games.

## Testing

Run the test script to verify game functionality:

```bash
python test_colorrush.py
```

## Future Enhancements

- **Power-ups**: Special tiles with bonus effects
- **Levels**: Increasing difficulty and complexity
- **Multiplayer**: Real-time competitive play
- **Achievements**: Unlockable rewards and badges
- **Sound Effects**: Audio feedback for better UX

## Dependencies

- **Frontend**: React, TypeScript, Chakra UI
- **Backend**: Python 3.8+, FastAPI, Pydantic
- **Game Logic**: Custom game engine with state management

## Performance

- **Rendering**: Optimized grid rendering with React
- **State Updates**: Efficient state management and updates
- **API Calls**: Minimal backend communication
- **Memory**: Lightweight game objects and state

## Security

- **Input Validation**: All player inputs validated
- **Session Management**: Secure player identification
- **Score Verification**: Backend score validation
- **Rate Limiting**: API endpoint protection

## Deployment

The game is ready for production deployment and integrates seamlessly with the existing Tournament Hub infrastructure. All necessary endpoints and game logic are implemented and tested.
