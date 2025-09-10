import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CryptoBubblesGame } from '../components/CryptoBubblesGame';
import { CryptoBubblesGamePhaser } from '../components/CryptoBubblesGamePhaser';
import { ChessGamePro } from '../components/ChessGamePro';
import { TicTacToeGame } from '../components/TicTacToeGame';
import { ColorRush } from '../components/ColorRush';
import DodgeDash from '../components/DodgeDash';
import { Box, Text, VStack, Spinner, useToast, Button } from '@chakra-ui/react';
import { useGetAccount } from 'lib';
import { getTournamentDetailsFromContract } from '../helpers';
import { BACKEND_BASE_URL } from '../config/backend';

export const GameSession: React.FC = () => {
    const { address: playerAddress } = useGetAccount();
    const { sessionId, tournamentId } = useParams<{ sessionId?: string; tournamentId?: string }>();
    const [gameType, setGameType] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [actualSessionId, setActualSessionId] = useState<string | null>(null);
    const toast = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        const initializeGameSession = async () => {
            // If we have a tournamentId but no sessionId, we need to create a game session
            if (tournamentId && !sessionId) {
                try {
                    // Get tournament details using the existing helper function
                    const tournamentDetails = await getTournamentDetailsFromContract(BigInt(tournamentId));

                    if (tournamentDetails) {
                        const gameId = Number(tournamentDetails.game_id);
                        const participants = tournamentDetails.participants;

                        console.log('Tournament details:', {
                            gameId,
                            participants,
                            participantsLength: participants.length
                        });

                        // Create game session based on game type
                        const gameTypeMap: { [key: number]: string } = {
                            1: 'tictactoe',
                            2: 'chess',
                            3: 'cryptobubbles',
                            4: 'colorrush'
                        };

                        const gameType = gameTypeMap[gameId] || (gameId === 6 ? 'dodgedash' : 'cryptobubbles');
                        setGameType(gameType);

                        // Use actual tournament participants
                        const players = participants.slice(0, 2); // Take first 2 players for Tic Tac Toe

                        console.log('Creating game session with players:', players);

                        // Create game session
                        const sessionResponse = await fetch(`${BACKEND_BASE_URL}/start_session`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                tournamentId: String(tournamentId),
                                game_type: gameId,
                                playerAddresses: players
                            })
                        });

                        if (sessionResponse.ok) {
                            const sessionData = await sessionResponse.json();
                            setActualSessionId(sessionData.session_id);
                        }
                    }
                } catch (error) {
                    console.error('Error creating game session:', error);
                }
            } else if (sessionId) {
                // Use existing sessionId
                setActualSessionId(sessionId);
            }

            setLoading(false);
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

    // If we have a tournamentId but no actualSessionId yet, show loading
    if (tournamentId && !actualSessionId) {
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
                const response = await fetch(`${BACKEND_BASE_URL}/game_state?session_id=${actualSessionId}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.board && typeof data.board === 'object' && data.current_turn && data.white_player) {
                        setGameType('chess');
                    } else if (data.board && Array.isArray(data.board) && data.board.length === 3) {
                        setGameType('tictactoe');
                    } else if (data.board && Array.isArray(data.board) && data.board.length === 8 && data.board[0] && data.board[0].length === 8) {
                        setGameType('colorrush');
                    } else {
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
            ) : gameType === 'cryptobubbles' ? (
                <Box position="relative">
                    <CryptoBubblesGamePhaser sessionId={actualSessionId!} playerAddress={playerAddress} />
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
            ) : gameType === 'colorrush' ? (
                <Box position="relative">
                    <ColorRush sessionId={actualSessionId!} playerAddress={playerAddress} />
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
                    <Text>Unknown game type</Text>
                </Box>
            )}
        </VStack>
    );
};

// Add default export
export default GameSession; 