import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CryptoBubblesGame } from '../components/CryptoBubblesGame';
import { CryptoBubblesGamePhaser } from '../components/CryptoBubblesGamePhaser';
import { ChessGamePro } from '../components/ChessGamePro';
import { TicTacToeGame } from '../components/TicTacToeGame';
import { ConnectFourGame } from '../components/ConnectFourGame';
import BattleshipGame from './Battleship/BattleshipGame';
import DodgeDash from '../components/DodgeDash';
import { Box, Text, VStack, HStack, Spinner, useToast, Button } from '@chakra-ui/react';
import { useGetAccount } from 'lib';
import { getTournamentDetailsFromContract, getTournamentDetailsFromContractFresh } from '../helpers';
import { BACKEND_BASE_URL } from '../config/backend';

export const GameSession: React.FC = () => {
    const { address: playerAddress } = useGetAccount();
    const { sessionId, tournamentId } = useParams<{ sessionId?: string; tournamentId?: string }>();
    const [gameType, setGameType] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [actualSessionId, setActualSessionId] = useState<string | null>(null);
    const [sessionCreationFailed, setSessionCreationFailed] = useState(false);
    const toast = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        const initializeGameSession = async () => {
            // If we have a tournamentId but no sessionId, we need to create a game session
            if (tournamentId && !sessionId) {
                try {
                    // Prefer fresh/timeout-bounded fetch to avoid hanging on stale cache/network
                    let tournamentDetails = await getTournamentDetailsFromContractFresh(BigInt(tournamentId));
                    if (!tournamentDetails) {
                        tournamentDetails = await getTournamentDetailsFromContract(BigInt(tournamentId));
                    }

                    if (tournamentDetails) {
                        const gameId = Number(tournamentDetails.game_id);
                        const participants = tournamentDetails.participants;

                        console.log('Tournament details:', {
                            gameId,
                            participants,
                            participantsLength: participants.length,
                            tournamentDetails: tournamentDetails
                        });

                        // Debug: Make the debug function available globally for this tournament
                        if (typeof window !== 'undefined') {
                            (window as any).debugThisTournament = () => {
                                return (window as any).debugTournamentParticipants(Number(tournamentId));
                            };
                            console.log('Debug function available: debugThisTournament()');
                        }

                        // Create game session based on game type
                        const gameTypeMap: { [key: number]: string } = {
                            1: 'tictactoe',
                            2: 'chess',
                            3: 'cryptobubbles',
                            5: 'cryptobubbles',
                            6: 'dodgedash',
                            7: 'connectfour',
                            8: 'battleship'
                        };

                        const gameType = gameTypeMap[gameId] || 'cryptobubbles';
                        setGameType(gameType);

                        // Use actual tournament participants
                        const players = participants.slice(0, 2); // Take first 2 players for Tic Tac Toe

                        console.log('Creating game session with players:', players);

                        // Check if we have enough players for the game
                        if (players.length < 2) {
                            console.log('Not enough players for Tic Tac Toe. Need at least 2 players.');
                            setLoading(false);
                            return;
                        }

                        // Check if session already exists for this tournament with a short retry loop
                        console.log('Checking for existing session for tournament:', tournamentId);
                        let sessionId = null as string | null;
                        const maxChecks = 5;
                        for (let attempt = 0; attempt < maxChecks && !sessionId; attempt++) {
                            const existingSessionResponse = await fetch(`${BACKEND_BASE_URL}/get_tournament_session?tournamentId=${tournamentId}`);
                            if (existingSessionResponse.ok) {
                                const existingSessionData = await existingSessionResponse.json();
                                console.log('Existing session response:', existingSessionData);
                                if (existingSessionData.session_id) {
                                    sessionId = existingSessionData.session_id as string;
                                    console.log('Using existing session:', sessionId);
                                    break;
                                }
                            }
                            if (!sessionId) {
                                // Small delay before next check to handle race after transaction
                                await new Promise(resolve => setTimeout(resolve, 500));
                            }
                        }

                        // Create new session only if none exists
                        if (!sessionId) {
                            const sessionData = {
                                tournamentId: String(tournamentId),
                                game_type: gameId,
                                playerAddresses: players
                            };

                            console.log('Creating game session with data:', sessionData);

                            const sessionResponse = await fetch(`${BACKEND_BASE_URL}/start_session`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(sessionData)
                            });

                            if (sessionResponse.ok) {
                                const sessionData = await sessionResponse.json();
                                sessionId = sessionData.session_id;
                                console.log('Created new session:', sessionId);
                            } else {
                                console.error('Failed to create session:', sessionResponse.status, await sessionResponse.text());
                            }
                        }

                        if (sessionId) {
                            setActualSessionId(sessionId);
                            setLoading(false);
                        } else {
                            console.error('Failed to create or retrieve session');
                            setSessionCreationFailed(true);
                            setLoading(false);
                        }
                    } else {
                        console.error('Failed to get tournament details');
                        setSessionCreationFailed(true);
                        setLoading(false);
                    }
                } catch (error) {
                    console.error('Error creating game session:', error);
                    setSessionCreationFailed(true);
                    setLoading(false);
                }
            } else if (sessionId) {
                // Use existing sessionId
                setActualSessionId(sessionId);
                setLoading(false);
            } else {
                setLoading(false);
            }
        };

        initializeGameSession();
    }, [tournamentId, sessionId, toast]);

    if (loading) {
        return (
            <Box textAlign="center" py={8}>
                <Spinner size="xl" color="blue.400" />
                <Text mt={4}>Loading game session...</Text>
            </Box>
        );
    }

    if (!actualSessionId && !tournamentId) {
        return (
            <Box textAlign="center" py={8}>
                <Text>No session ID or tournament ID provided</Text>
            </Box>
        );
    }

    // If we have a tournamentId but no actualSessionId and no loading, show insufficient players message
    // Only show this if we've actually tried to create a session and failed
    if (tournamentId && !actualSessionId && !loading && sessionCreationFailed) {
        return (
            <Box textAlign="center" py={8}>
                <Text fontSize="xl" mb={4}>Tournament Not Ready</Text>
                <Text mb={4}>This tournament needs at least 2 participants to start a game.</Text>
                <HStack justify="center" spacing={4}>
                    <Button
                        colorScheme="blue"
                        onClick={() => navigate('/tournaments')}
                        leftIcon={<span>←</span>}
                    >
                        Back to Tournaments
                    </Button>
                    <Button
                        colorScheme="green"
                        onClick={() => {
                            setSessionCreationFailed(false);
                            setLoading(true);
                            // Re-trigger the initialization
                            const initializeGameSession = async () => {
                                try {
                                    const tournamentDetails = await getTournamentDetailsFromContract(BigInt(tournamentId!));
                                    if (tournamentDetails) {
                                        const gameId = Number(tournamentDetails.game_id);
                                        const participants = tournamentDetails.participants;
                                        const players = participants.slice(0, 2);

                                        if (players.length < 2) {
                                            setSessionCreationFailed(true);
                                            setLoading(false);
                                            return;
                                        }

                                        const gameTypeMap: { [key: number]: string } = {
                                            1: 'tictactoe', 2: 'chess', 3: 'cryptobubbles', 5: 'cryptobubbles',
                                            6: 'dodgedash', 7: 'connectfour', 8: 'battleship'
                                        };
                                        setGameType(gameTypeMap[gameId] || 'cryptobubbles');

                                        const existingSessionResponse = await fetch(`${BACKEND_BASE_URL}/get_tournament_session?tournamentId=${tournamentId}`);
                                        let sessionId = null;

                                        if (existingSessionResponse.ok) {
                                            const existingSessionData = await existingSessionResponse.json();
                                            if (existingSessionData.session_id) {
                                                sessionId = existingSessionData.session_id;
                                            }
                                        }

                                        if (!sessionId) {
                                            const sessionData = {
                                                tournamentId: String(tournamentId),
                                                game_type: gameId,
                                                playerAddresses: players
                                            };

                                            const sessionResponse = await fetch(`${BACKEND_BASE_URL}/start_session`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify(sessionData)
                                            });

                                            if (sessionResponse.ok) {
                                                const sessionData = await sessionResponse.json();
                                                sessionId = sessionData.session_id;
                                            }
                                        }

                                        if (sessionId) {
                                            setActualSessionId(sessionId);
                                            setLoading(false);
                                        } else {
                                            setSessionCreationFailed(true);
                                            setLoading(false);
                                        }
                                    } else {
                                        setSessionCreationFailed(true);
                                        setLoading(false);
                                    }
                                } catch (error) {
                                    console.error('Error retrying game session creation:', error);
                                    setSessionCreationFailed(true);
                                    setLoading(false);
                                }
                            };
                            initializeGameSession();
                        }}
                    >
                        Retry
                    </Button>
                </HStack>
            </Box>
        );
    }

    // If we have a tournamentId but no actualSessionId yet, show loading only while initializing
    if (tournamentId && !actualSessionId && loading) {
        return (
            <Box textAlign="center" py={8}>
                <Spinner size="xl" color="blue.400" />
                <Text mt={4}>Creating game session...</Text>
            </Box>
        );
    }

    if (!playerAddress) {
        return (
            <Box textAlign="center" py={8}>
                <Text>Please connect your wallet to play</Text>
            </Box>
        );
    }

    // If we have a sessionId but no gameType, try to determine it
    if (actualSessionId && !gameType) {
        // Try to determine game type from session
        const determineGameType = async () => {
            try {
                // First try to get session info from the backend
                const sessionResponse = await fetch(`${BACKEND_BASE_URL}/get_session_info?session_id=${actualSessionId}`);
                if (sessionResponse.ok) {
                    const sessionData = await sessionResponse.json();
                    if (sessionData.game_type) {
                        console.log('Got game type from session info:', sessionData.game_type);
                        setGameType(sessionData.game_type);
                        return;
                    }
                }

                // Fallback: try to determine game type from game state
                const response = await fetch(`${BACKEND_BASE_URL}/game_state?session_id=${actualSessionId}`);
                if (response.ok) {
                    const data = await response.json();
                    console.log('Game state data for type detection:', data);

                    // Check for chess (has current_turn and white_player)
                    if (data.current_turn && data.white_player) {
                        console.log('Detected game type: chess');
                        setGameType('chess');
                    }
                    // Check for Connect Four (6x7 board and red_player/yellow_player)
                    else if (data.board && Array.isArray(data.board) && data.board.length === 6 && data.board[0] && data.board[0].length === 7 && data.red_player) {
                        console.log('Detected game type: connectfour');
                        setGameType('connectfour');
                    }
                    // Check for tic tac toe (3x3 board)
                    else if (data.board && Array.isArray(data.board) && data.board.length === 3 && data.board[0] && data.board[0].length === 3) {
                        console.log('Detected game type: tictactoe');
                        setGameType('tictactoe');
                    }
                    // Check for dodge dash (has specific dodge dash fields)
                    else if (data.lives !== undefined && data.wave !== undefined) {
                        console.log('Detected game type: dodgedash');
                        setGameType('dodgedash');
                    }
                    // Check for battleship (has player1, player2, and game_phase)
                    else if (data.player1 && data.player2 && data.game_phase !== undefined) {
                        console.log('Detected game type: battleship');
                        setGameType('battleship');
                    }
                    // Default to cryptobubbles
                    else {
                        console.log('Detected game type: cryptobubbles (default)');
                        console.log('Board info:', {
                            hasBoard: !!data.board,
                            isArray: Array.isArray(data.board),
                            length: data.board?.length,
                            firstRowLength: data.board?.[0]?.length,
                            firstTile: data.board?.[0]?.[0],
                            hasColor: data.board?.[0]?.[0]?.color
                        });
                        setGameType('cryptobubbles');
                    }
                }
            } catch (error) {
                console.error('Error determining game type:', error);
                setGameType('cryptobubbles'); // Default fallback
            }
        };

        determineGameType();
        return (
            <Box textAlign="center" py={8}>
                <Spinner size="xl" color="blue.400" />
                <Text mt={4}>Determining game type...</Text>
            </Box>
        );
    }

    return (
        <VStack spacing={6} align="stretch" p={6}>
            {gameType === 'tictactoe' ? (
                <TicTacToeGame sessionId={actualSessionId!} playerAddress={playerAddress} />
            ) : gameType === 'chess' ? (
                <ChessGamePro sessionId={actualSessionId!} playerAddress={playerAddress} />
            ) : gameType === 'connectfour' ? (
                <ConnectFourGame sessionId={actualSessionId!} playerAddress={playerAddress} />
            ) : gameType === 'battleship' ? (
                <BattleshipGame sessionId={actualSessionId!} />
            ) : gameType === 'cryptobubbles' ? (
                <Box position="relative">
                    <CryptoBubblesGamePhaser sessionId={actualSessionId!} playerAddress={playerAddress} />
                    <Button
                        position="absolute"
                        top={4}
                        right={4}
                        size="sm"
                        colorScheme="red"
                        onClick={() => navigate('/tournaments')}
                        zIndex={200}
                        leftIcon={<span>←</span>}
                        boxShadow="0 4px 12px rgba(0,0,0,0.3)"
                    >
                        Exit
                    </Button>
                </Box>
            ) : gameType === 'dodgedash' ? (
                <Box position="relative">
                    <DodgeDash sessionId={actualSessionId!} playerAddress={playerAddress} />
                    <Button
                        position="absolute"
                        top={2}
                        right={2}
                        size="sm"
                        colorScheme="red"
                        onClick={() => navigate('/tournaments')}
                        zIndex={200}
                    >
                        Exit Game
                    </Button>
                </Box>
            ) : (
                <Box textAlign="center" py={8}>
                    <Text>Unknown game type: {gameType}</Text>
                </Box>
            )}
        </VStack>
    );
};

// Add default export
export default GameSession; 