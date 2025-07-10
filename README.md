# Tournament Hub Smart Contract

This project implements a modular smart contract for managing tournaments, games, and spectator betting on the MultiversX blockchain. The contract is designed for clarity, maintainability, and extensibility, with logic split into focused modules.

## SC Project Structure

```
tournament-hub-sc/
├── src/
│   ├── helpers.rs              # Private helper functions used across modules
│   ├── models.rs               # Data structures and enums (GameConfig, Tournament, etc.)
│   ├── storage.rs              # Storage mappers for contract state
│   ├── views.rs                # View (query) endpoints
│   ├── tournament_hub.rs       # Main contract trait, only init/upgrade logic and trait composition
│   └── tournament_logic/
│       ├── game_registration.rs      # Game registration endpoints
│       ├── tournament_management.rs # Tournament creation, joining, starting
│       ├── results_management.rs    # Result submission and prize distribution
│       └── spectator_betting.rs     # Spectator betting and claims
└── README.md
```

## Module Overview

- **models.rs**: Contains all core data structures and enums, such as `GameConfig`, `Tournament`, `TournamentStatus`, etc.
- **storage.rs**: Defines storage mappers for persistent contract state (games, tournaments, bets, etc.).
- **helpers.rs**: Private helper functions for internal contract logic (e.g., signature verification, prize distribution).
- **views.rs**: Read-only endpoints for querying contract state (game config, tournament info, bets, etc.).
- **tournament_logic/**: Contains logic modules for each major contract feature:
  - **game_registration.rs**: Endpoints for registering new games (owner only).
  - **tournament_management.rs**: Endpoints for creating, joining, and starting tournaments.
  - **results_management.rs**: Endpoints for submitting results and distributing prizes.
  - **spectator_betting.rs**: Endpoints for placing bets and claiming winnings as a spectator.
- **tournament_hub.rs**: The main contract file. It only contains the contract trait, which composes all modules, and the `init`/`upgrade` functions.

## Key Features

- **Modular Design**: Each logical area is in its own file, making the codebase easy to navigate and extend.
- **Owner-Only Game Registration**: Only the contract owner can register new games.
- **Tournament Lifecycle**: Create, join, and start tournaments, with deadlines and entry fees.
- **Result Submission**: Secure result submission and prize distribution, including house fees and podium splits.
- **Spectator Betting**: Spectators can bet on players, with winnings distributed based on final results.
- **View Endpoints**: Query all relevant contract state for games, tournaments, and bets.

## Game Server / Signing Server Architecture

The Game Server (or Signing Server) is a critical off-chain component that manages multiplayer game sessions and securely submits results to the TournamentHub smart contract.

### Responsibilities
- **Session Management:** Hosts and manages multiplayer game sessions, tracks participants, and enforces game rules.
- **Result Determination:** At the end of a session, determines the final podium (ordered list of winners).
- **Result Signing:** Signs the result data (e.g., tournament ID and podium) with its private key, acting as a trusted attestor.
- **Result Submission:** Submits the signed result to the TournamentHub smart contract via the `submitResults` endpoint.

### Communication Flow
1. **Game Session:** Players join and play a game session managed by the Game Server.
2. **Result Generation:** When the session ends, the server determines the winners and creates a message (e.g., `{tournament_id, podium}`).
3. **Signing:** The server signs the message with its private key. The public key/address is registered in the smart contract as the trusted signer for that game.
4. **Submission:** The server (or a relayer) calls the smart contract's `submitResults` endpoint, providing the tournament ID, podium, and signature.
5. **Verification:** The smart contract verifies the signature and processes payouts if valid.

### Security Considerations
- The server's private key must be kept secure; compromise could allow fraudulent result submissions.
- The public key/address is stored on-chain in the game config, so only results from the trusted server are accepted.
- For advanced setups, the signing server could be a multi-sig or decentralized oracle.

### High-Level Flow Diagram

```mermaid
sequenceDiagram
    participant Player
    participant GameServer as Game Server / Signing Server
    participant SmartContract as TournamentHub Smart Contract

    Player->>GameServer: Join & play game session
    GameServer->>GameServer: Track session, determine winners
    GameServer->>GameServer: Sign result (tournament_id, podium)
    GameServer->>SmartContract: submitResults(tournament_id, podium, signature)
    SmartContract->>SmartContract: Verify signature, distribute prizes
```

## How to Extend

- Add new features by creating new modules in `tournament_logic/` or extending existing ones.
- Add new data structures to `models.rs` and new storage mappers to `storage.rs` as needed.
- Keep the main contract file (`tournament_hub.rs`) minimal—only trait composition and lifecycle functions.

---

For more details on each module, see the comments at the top of each file. 

## Flow diagram

```mermaid
flowchart TD
    %% Step 1: Game Registration
    subgraph Step1["1. Game Registration"]
        Owner -.->|registerGame| GameReg[Game Registration Module]
    end

    %% Step 2: Tournament Creation & Joining
    subgraph Step2["2. Tournament Creation & Joining"]
        Owner -.->|createTournament| TourManage[Tournament Management Module]
        User -.->|joinTournament| TourManage
        TourManage -.->|startTournament| TourManage
    end

    %% Step 3: Spectator Betting
    subgraph Step3["3. Spectator Betting"]
        Spectator -.->|placeSpectatorBet| SpectBet[Betting Module]
    end

    %% Step 4: Tournament Play & Results
    subgraph Step4["4. Tournament Play & Results"]
        TourManage -.->|submitResults| Results[Results Management]
        Results -.->|distributePrizes| Results
    end

    %% Step 5: Spectator Claims
    subgraph Step5["5. Spectator Claims"]
        Spectator -.->|claimSpectatorWinnings| SpectBet
    end

    %% Step 6: Views (Anytime)
    subgraph Step6["6. Views (Anytime)"]
        Anyone -.->|view endpoints| Views[Views Module]
    end

    %% Module dependencies
    GameReg -.->|uses| Shared[models.rs / storage.rs]
    TourManage -.->|uses| Shared
    SpectBet -.->|uses| Shared
    Results -.->|uses| Shared
    Views -.->|uses| Shared
    Shared -.->|helpers| Helpers[helpers.rs]

    style GameReg fill:#8ecae6,stroke:#333,stroke-width:1px
    style TourManage fill:#ffb703,stroke:#333,stroke-width:1px
    style Results fill:#bfb,stroke:#333,stroke-width:1px
    style SpectBet fill:#ffb,stroke:#333,stroke-width:1px
    style Views fill:#eee,stroke:#333,stroke-width:1px
    style Shared fill:#fff,stroke:#333,stroke-width:1px
    style Helpers fill:#fff,stroke:#333,stroke-width:1px
```