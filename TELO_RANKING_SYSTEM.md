# TELO Ranking System

## Overview

The **TELO (Tournament ELO)** ranking system is a skill-based rating system for tournament players, similar to the ELO system used in chess and Warcraft 3. It provides a numerical representation of a player's skill level that dynamically adjusts based on tournament performance.

## Key Features

- **Starting Rating**: Every player starts with **1500 TELO points**
- **Dynamic Point Changes**: Rating changes range from **2 to 20 points** per tournament
- **Skill-Based Adjustments**: Point changes are calculated based on the rating difference between winners and losers
- **Position-Based Rewards**: Tournament placement affects the magnitude of rating changes

## How It Works

### Rating Calculation Logic

The TELO system uses a simplified ELO-like formula that considers:

1. **Rating Difference**: The gap between winner and loser ratings
2. **Expected Outcome**: Favorites gain fewer points, underdogs gain more
3. **Tournament Position**: Higher placements earn more points

### Point Distribution Table

| Rating Difference | Scenario | Points Awarded |
|------------------|----------|----------------|
| +400 or more | Huge favorite wins | 2 points (minimum) |
| +200 to +399 | Strong favorite wins | 5 points |
| +100 to +199 | Moderate favorite wins | 8 points |
| +50 to +99 | Slight favorite wins | 11 points |
| -50 to +50 | Even match | 13 points |
| -100 to -51 | Slight underdog wins | 15 points |
| -200 to -101 | Moderate underdog wins | 17 points |
| -400 to -201 | Strong underdog wins | 19 points |
| -400 or less | Huge underdog wins | 20 points (maximum) |

### Position Multipliers

Winners receive different point amounts based on their tournament placement:

- **1st Place**: 100% of calculated points
- **2nd Place**: 75% of calculated points
- **3rd Place**: 50% of calculated points
- **4th+ Place**: 25% of calculated points

*Minimum of 2 points is always awarded regardless of multiplier*

### Losers

Losers lose points based on the average rating of winners:
- Points lost are calculated using the inverse of the winner calculation
- **Rating Floor**: Players cannot drop below 100 TELO rating

## Implementation Details

### Smart Contract Changes

**File**: `tournament-hub-sc/src/models.rs`
- Added `telo_rating: u32` field to `UserStats` struct
- Default value: 1500

**File**: `tournament-hub-sc/src/tournament_logic/ranking_system.rs`
- New module implementing the TELO calculation logic
- `calculate_telo_change()`: Calculates point changes based on rating difference
- `update_tournament_ratings()`: Updates all participant ratings after tournament completion

**File**: `tournament-hub-sc/src/tournament_logic/results_management.rs`
- Integrated rating updates into the tournament completion flow
- Ratings are updated automatically when results are submitted

### Frontend Changes

**Files Updated**:
- `hooks/useUserStats.ts`: Added `teloRating` field to UserStats interface
- `hooks/useSimpleDashboard.ts`: Added `teloRating` to SimpleUserStats interface
- `helpers/index.ts`: Updated `parseUserStatsHex()` to parse TELO rating from contract
- `pages/Dashboard/Dashboard.tsx`: Added TELO rating display card

**Display**:
- TELO rating is shown prominently on the user dashboard
- Displayed with a yellow color scheme to indicate skill/ranking
- Label: "TELO Rating" with subtitle "Skill rating"

## Examples

### Example 1: Evenly Matched Players
- **Player A** (1500 TELO) defeats **Player B** (1480 TELO)
- Rating difference: +20 (slight favorite)
- Player A wins 1st place: +11 points → **1511 TELO**
- Player B loses: -11 points → **1469 TELO**

### Example 2: Underdog Victory
- **Player C** (1300 TELO) defeats **Player D** (1600 TELO)
- Rating difference: -300 (strong underdog)
- Player C wins 1st place: +19 points → **1319 TELO**
- Player D loses: -19 points → **1581 TELO**

### Example 3: Multi-Winner Tournament
- **Winner 1** (1500 TELO): +15 points (100%) → **1515 TELO**
- **Winner 2** (1480 TELO): +11 points (75% of 15) → **1491 TELO**
- **Winner 3** (1520 TELO): +7 points (50% of 15) → **1527 TELO**
- **Losers**: Each loses proportional points based on average winner rating

## Benefits

1. **Fair Skill Assessment**: Accurately reflects player skill over time
2. **Upset Rewards**: Encourages competitive play by rewarding underdog victories
3. **Balanced Progression**: Prevents rating inflation/deflation
4. **Transparent System**: Clear rules that players can understand
5. **Competitive Motivation**: Gives players a tangible goal to improve

## Future Enhancements

Potential improvements to consider:

- **Leaderboards**: Display top-rated players globally or by game type
- **Rating Tiers**: Bronze, Silver, Gold, Platinum, Diamond rankings
- **Seasonal Resets**: Periodic rating resets with rewards
- **Game-Specific Ratings**: Separate TELO ratings for different game types
- **Rating History**: Track rating changes over time with graphs
- **Matchmaking**: Use TELO ratings to create balanced tournaments

## Technical Notes

- **Storage**: TELO rating is stored as a `u32` in the smart contract
- **Precision**: Integer-based calculations avoid floating-point issues
- **Gas Efficiency**: Optimized for minimal gas consumption
- **Backward Compatibility**: Existing users automatically get 1500 TELO rating
- **No Draws**: Draw tournaments (no winners) don't affect TELO ratings

## Abbreviation Origin

**TELO** = **T**ournament **ELO**

Named in honor of the ELO rating system (created by Arpad Elo) and adapted specifically for tournament-style gameplay. The "T" prefix distinguishes it from traditional ELO while maintaining the familiar concept.

