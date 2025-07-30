import axios from 'axios';

const API_BASE = process.env.REACT_APP_GAME_SERVER_URL || 'http://localhost:8000';

export async function startSession(tournamentId: number, playerAddress: string) {
    const res = await axios.post(`${API_BASE}/start_session`, { tournament_id: tournamentId, player: playerAddress });
    // Expected response: { sessionId: string }
    return res.data;
}

export async function getGameState(sessionId: string) {
    const res = await axios.get(`${API_BASE}/game_state`, { params: { sessionId } });
    // Expected response: { board: string[], currentTurn: string, gameOver: boolean, winner: string|null, players: string[] }
    return res.data;
}

export async function sendMove(sessionId: string, playerAddress: string, index: number) {
    await axios.post(`${API_BASE}/move`, { sessionId, player: playerAddress, move: index });
}

export async function submitResult(sessionId: string, winner: string) {
    await axios.post(`${API_BASE}/submit_results`, { sessionId, winner });
} 