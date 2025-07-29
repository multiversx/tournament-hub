import React, { useEffect, useState } from 'react';
import { getGameState, sendMove, submitResult } from '../services/ticTacToeService';
import { useNavigate } from 'react-router-dom';
import { Button } from '@chakra-ui/react';

interface TicTacToeGameProps {
    sessionId: string;
    playerAddress: string;
}

export const TicTacToeGame: React.FC<TicTacToeGameProps> = ({ sessionId, playerAddress }) => {
    const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
    const [currentTurn, setCurrentTurn] = useState<string | null>(null);
    const [gameOver, setGameOver] = useState(false);
    const [winner, setWinner] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [waitingForOpponent, setWaitingForOpponent] = useState(false);
    const [players, setPlayers] = useState<string[]>([]);
    const [winLine, setWinLine] = useState<number[] | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);
    const navigate = useNavigate();

    // Helper to find winning line
    function getWinningLine(board: (string | null)[]): number[] | null {
        const winPatterns = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
            [0, 4, 8], [2, 4, 6]          // diags
        ];
        for (const pattern of winPatterns) {
            const [a, b, c] = pattern;
            if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                return pattern;
            }
        }
        return null;
    }

    // Poll for game state
    useEffect(() => {
        let interval: NodeJS.Timeout;
        const fetchState = async () => {
            try {
                setLoading(true);
                const state = await getGameState(sessionId);
                setBoard(state.board);
                setCurrentTurn(state.currentTurn);
                setGameOver(state.gameOver);
                setWinner(state.winner);
                setPlayers(state.players || []);
                setWaitingForOpponent((state.players || []).length < 2);
                setLoading(false);
            } catch (err: any) {
                setError('Failed to fetch game state');
                setLoading(false);
            }
        };
        fetchState();
        interval = setInterval(fetchState, 2000);
        return () => clearInterval(interval);
    }, [sessionId]);

    // Update win line when game over
    useEffect(() => {
        if (gameOver) {
            setWinLine(getWinningLine(board));
        } else {
            setWinLine(null);
        }
    }, [gameOver, board]);

    const handleCellClick = async (index: number) => {
        if (gameOver || board[index] !== null || currentTurn !== playerAddress || waitingForOpponent) return;
        try {
            setLoading(true);
            await sendMove(sessionId, playerAddress, index);
            setLoading(false);
        } catch (err: any) {
            setError('Failed to send move');
            setLoading(false);
        }
    };

    useEffect(() => {
        if (gameOver && winner) {
            (async () => {
                try {
                    await submitResult(sessionId, winner);
                    // The transaction hash will be available later through the tournament details
                } catch (error) {
                    console.error('Error submitting result:', error);
                }
            })();
        }
    }, [gameOver, winner, sessionId]);

    // Error message auto-dismiss
    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    return (
        <div style={{ textAlign: 'center' }}>
            <h2 style={{ marginTop: 32 }}>Tic Tac Toe</h2>
            {loading && <div>Loading...</div>}
            {error && <div style={{ color: '#e53e3e', marginBottom: 8, fontSize: 16 }}>{error}</div>}
            {waitingForOpponent ? (
                <div style={{ color: 'orange', margin: '20px 0', fontSize: 18 }}>Waiting for opponent to join...</div>
            ) : (
                <>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 60px)',
                            gap: '5px',
                            margin: '40px 0',
                            justifyContent: 'center',
                        }}
                    >
                        {board.map((cell, idx) => {
                            const isWinCell = winLine && winLine.includes(idx);
                            return (
                                <button
                                    key={idx}
                                    onClick={() => handleCellClick(idx)}
                                    disabled={gameOver || cell !== null || currentTurn !== playerAddress || loading}
                                    style={{
                                        width: 60,
                                        height: 60,
                                        fontSize: 32,
                                        fontWeight: 'bold',
                                        color: cell === 'X' ? '#3182ce' : cell === 'O' ? '#e53e3e' : '#fff',
                                        background: isWinCell ? '#38a169' : '#222',
                                        border: isWinCell ? '3px solid #38a169' : '2px solid #444',
                                        borderRadius: 8,
                                        cursor:
                                            cell === null && !gameOver && currentTurn === playerAddress && !loading
                                                ? 'pointer'
                                                : 'default',
                                        transition: 'background 0.2s, border 0.2s, transform 0.2s',
                                        transform: cell ? 'scale(1.1)' : 'scale(1)',
                                        opacity: cell ? 1 : 0.7,
                                        boxShadow: isWinCell ? '0 0 8px #38a169' : undefined,
                                    }}
                                >
                                    <span
                                        style={{
                                            display: 'inline-block',
                                            transition: 'transform 0.3s, opacity 0.3s',
                                            transform: cell ? 'scale(1.2)' : 'scale(1)',
                                            opacity: cell ? 1 : 0,
                                        }}
                                    >
                                        {cell}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    <div style={{ fontSize: 18, margin: '16px 0' }}>
                        {gameOver ? (
                            <div style={{ color: '#38a169', fontWeight: 'bold', fontSize: 20 }}>
                                Game Over! Winner:<br />
                                <span style={{ color: '#fff', fontWeight: 'normal', fontSize: 16 }}>{winner || 'Draw'}</span>
                                {txHash && (
                                    <div style={{ marginTop: 16 }}>
                                        <a
                                            href={`https://devnet-explorer.multiversx.com/transactions/${txHash}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ color: '#3182ce', fontWeight: 'bold', textDecoration: 'underline' }}
                                        >
                                            View on Explorer
                                        </a>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div>
                                Current turn: <span style={{ color: currentTurn === playerAddress ? '#3182ce' : '#e53e3e' }}>{currentTurn === playerAddress ? 'You' : 'Opponent'}</span>
                            </div>
                        )}
                    </div>
                    <Button
                        colorScheme="blue"
                        variant="solid"
                        size="md"
                        mt={4}
                        fontWeight="bold"
                        onClick={() => navigate('/tournaments')}
                    >
                        Exit
                    </Button>
                </>
            )}
        </div>
    );
}; 