import { BACKEND_BASE_URL } from '../config/backend';
import { getContractAddress } from '../config/contract';

const CONTRACT_ADDRESS = getContractAddress();

export const GAME_CONFIGS = {
  1: {
    name: "Tic Tac Toe",
    minPlayers: 2,
    maxPlayers: 2,
    gameType: "turn_based",
    description: "Classic 3x3 grid game"
  },
  2: {
    name: "Chess",
    minPlayers: 2,
    maxPlayers: 2,
    gameType: "turn_based",
    description: "Strategic board game"
  },
  5: {
    name: "CryptoBubbles",
    minPlayers: 2,
    maxPlayers: 2,
    gameType: "real_time_duel",
    description: "Real-time cell battle game"
  },
  7: {
    name: "Connect Four",
    minPlayers: 2,
    maxPlayers: 2,
    gameType: "turn_based",
    description: "Classic strategy game - connect 4 in a row to win"
  },
  8: {
    name: "Battleship",
    minPlayers: 2,
    maxPlayers: 2,
    gameType: "turn_based",
    description: "Naval strategy game - sink all opponent ships to win"
  },
  // DodgeDash removed from tournament creation options
};

export interface TournamentSession {
  tournament_id: number;
  max_players: number;
  game_type: number;
  players: string[];
  status: string;
  brackets?: any[];
  current_round: number;
  created_at: number;
}

export interface GameSession {
  sessionId: string;
  tournament_id: number;
  game_type: number;
  players: string[];
  current_turn?: string;
  game_state: any;
  status: string;
  winner?: string;
  created_at: number;
}

export interface MoveRequest {
  session_id: string;
  player_address: string;
  move_data: any;
}

export interface StartSessionRequest {
  tournament_id: number;
  player_address: string;
}

export const startTournamentSession = async (tournamentId: number, gameType: number) => {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/start_session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tournamentId: String(tournamentId),
        game_type: gameType
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to start tournament session');
    }

    return await response.json();
  } catch (error) {
    console.error('Error starting tournament session:', error);
    throw error;
  }
};

export const startGameSession = async (tournamentId: string, gameType: number, playerAddresses?: string[]) => {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/start_session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tournamentId: tournamentId,
        game_type: gameType,
        playerAddresses: playerAddresses
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to start game session');
    }

    return await response.json();
  } catch (error) {
    console.error('Error starting game session:', error);
    throw error;
  }
};

export async function getGameState(sessionId: string): Promise<GameSession> {
  const response = await fetch(`${BACKEND_BASE_URL}/game_state?session_id=${sessionId}`);

  if (!response.ok) {
    throw new Error('Failed to fetch game state');
  }

  return response.json();
}

export async function makeMove(sessionId: string, playerAddress: string, moveData: any): Promise<GameSession> {
  const response = await fetch(`${BACKEND_BASE_URL}/move`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId: sessionId,
      player: playerAddress,
      move: moveData
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to make move');
  }

  return response.json();
}

export async function submitTournamentResults(sessionId: string, winner: string): Promise<any> {
  const response = await fetch(`${BACKEND_BASE_URL}/submit_results`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId: sessionId,
      winner: winner
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to submit tournament results');
  }

  const result = await response.json();

  // Clear caches after successful result submission
  try {
    const { clearApiCaches } = await import('../helpers');
    clearApiCaches();

    // Also clear localStorage cache
    localStorage.removeItem('tournament_persistent_cache');

    // Trigger a custom event to notify other components
    window.dispatchEvent(new CustomEvent('tournamentResultsSubmitted', {
      detail: { sessionId, winner }
    }));
  } catch (error) {
    console.warn('Failed to clear caches after result submission:', error);
  }

  return result;
}

export async function getGameConfigs(): Promise<any> {
  const response = await fetch(`${BACKEND_BASE_URL}/game-configs`);

  if (!response.ok) {
    throw new Error('Failed to fetch game configs');
  }

  return response.json();
}

// Legacy functions for backward compatibility
export async function startSession(tournamentId: number, playerAddress: string, gameType?: number): Promise<{ sessionId: string }> {
  try {
    const result = await startTournamentSession(tournamentId, gameType || 1);
    return { sessionId: result.session_id };
  } catch (error) {
    console.error('Error starting session:', error);
    throw error;
  }
}

interface Game {
  players: string[];
  status: string;
  winner?: string;
  session_id?: string;
}

// Tournament bracket visualization helpers
export function getTournamentBracket(tournament: TournamentSession) {
  if (!tournament.brackets) return null;

  return tournament.brackets.map((round: Game[], roundIndex: number) => ({
    round: roundIndex + 1,
    games: round.map((game: Game, gameIndex: number) => ({
      id: `${roundIndex}-${gameIndex}`,
      players: game.players,
      status: game.status,
      winner: game.winner,
      sessionId: game.session_id
    }))
  }));
}

export function getCurrentGameForPlayer(tournament: TournamentSession, playerAddress: string) {
  if (!tournament.brackets || tournament.current_round >= tournament.brackets.length) {
    return null;
  }

  const currentRound = tournament.brackets[tournament.current_round];

  for (const game of currentRound) {
    if (game.players.includes(playerAddress) && game.status === 'playing') {
      return game;
    }
  }

  return null;
}

export function isPlayerInTournament(tournament: TournamentSession, playerAddress: string): boolean {
  return tournament.players.includes(playerAddress);
}

export function canStartGame(tournament: TournamentSession, playerAddress: string): boolean {
  return (
    isPlayerInTournament(tournament, playerAddress) &&
    tournament.status === 'ready' &&
    getCurrentGameForPlayer(tournament, playerAddress) !== null
  );
}

export function getTournamentProgress(tournament: TournamentSession): {
  currentRound: number;
  totalRounds: number;
  completedGames: number;
  totalGames: number;
} {
  if (!tournament.brackets) {
    return { currentRound: 0, totalRounds: 0, completedGames: 0, totalGames: 0 };
  }

  const totalRounds = tournament.brackets.length;
  const currentRound = tournament.current_round;

  let completedGames = 0;
  let totalGames = 0;

  tournament.brackets.forEach((round: Game[]) => {
    round.forEach((game: Game) => {
      totalGames++;
      if (game.status === 'completed') {
        completedGames++;
      }
    });
  });

  return { currentRound, totalRounds, completedGames, totalGames };
} 