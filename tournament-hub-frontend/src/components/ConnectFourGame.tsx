import React, { useEffect, useState, useCallback } from 'react';
import { BACKEND_BASE_URL } from '../config/backend';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Grid,
    Text,
    Button,
    VStack,
    HStack,
    useToast,
    Spinner,
    Badge,
    Alert,
    AlertIcon,
} from '@chakra-ui/react';

interface ConnectFourGameState {
    session_id: string;
    board: string[][];  // 6 rows x 7 cols
    current_turn: string;  // 'red' or 'yellow'
    winner: string | null;
    game_over: boolean;
    red_player: string | null;
    yellow_player: string | null;
    move_history: Array<{
        player: string;
        color: string;
        column: number;
        row: number;
        timestamp: number;
    }>;
    last_move: number[] | null;  // [row, col]
    game_type: string;
    rows: number;
    cols: number;
}

interface ConnectFourGameProps {
    sessionId: string;
    playerAddress: string;
}

export const ConnectFourGame: React.FC<ConnectFourGameProps> = ({ sessionId, playerAddress }) => {
    const [gameState, setGameState] = useState<ConnectFourGameState | null>(null);
    const [loading, setLoading] = useState(true);
    const [isMyTurn, setIsMyTurn] = useState(false);
    const [hoveredColumn, setHoveredColumn] = useState<number | null>(null);
    const toast = useToast();
    const navigate = useNavigate();

    const fetchGameState = useCallback(async () => {
        if (!sessionId || sessionId === 'null' || sessionId.trim() === '') {
            console.log('ConnectFourGame: Skipping fetch - sessionId is null or invalid');
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(`${BACKEND_BASE_URL}/connectfour_game_state?sessionId=${sessionId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch game state');
            }
            const data = await response.json();
            setGameState(data);

            // Determine if it's the player's turn
            const currentTurn = data.current_turn;  // 'red' or 'yellow'
            const isPlayerRed = data.red_player === playerAddress;
            const isPlayerYellow = data.yellow_player === playerAddress;
            const isParticipant = isPlayerRed || isPlayerYellow;
            setIsMyTurn(isParticipant && ((currentTurn === 'red' && isPlayerRed) || (currentTurn === 'yellow' && isPlayerYellow)));

        } catch (error) {
            console.error('Error fetching game state:', error);
            toast({
                title: 'Error',
                description: 'Failed to fetch game state',
                status: 'error',
                duration: 5000,
                isClosable: true,
            });
        } finally {
            setLoading(false);
        }
    }, [sessionId, playerAddress, toast]);

    useEffect(() => {
        if (sessionId && sessionId !== 'null' && sessionId.trim() !== '') {
            fetchGameState();
            const interval = setInterval(fetchGameState, 2000); // Poll every 2 seconds
            return () => clearInterval(interval);
        } else {
            setLoading(false);
        }
    }, [fetchGameState, sessionId]);

    const handleColumnClick = async (col: number) => {
        if (!gameState || !isMyTurn || gameState.game_over) return;

        try {
            const response = await fetch(`${BACKEND_BASE_URL}/connectfour_move`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionId: sessionId,
                    player: playerAddress,
                    col: col,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Invalid move');
            }

            toast({
                title: 'Piece dropped',
                description: `Placed ${gameState.current_turn} piece in column ${col + 1}`,
                status: 'success',
                duration: 2000,
                isClosable: true,
            });

            // Refresh game state
            await fetchGameState();
        } catch (error) {
            console.error('Error making move:', error);
            toast({
                title: 'Invalid move',
                description: error instanceof Error ? error.message : 'Move failed',
                status: 'error',
                duration: 3000,
                isClosable: true,
            });
        }
    };

    const renderCell = (row: number, col: number) => {
        const cellValue = gameState?.board[row][col] || '';
        const isLastMove = gameState?.last_move && gameState.last_move[0] === row && gameState.last_move[1] === col;

        const getCellColor = () => {
            if (cellValue === 'red') return 'red.500';
            if (cellValue === 'yellow') return 'yellow.400';
            return 'gray.800';
        };

        return (
            <Box
                key={`${row}-${col}`}
                w="60px"
                h="60px"
                bg="blue.600"
                border="3px solid"
                borderColor="blue.800"
                display="flex"
                alignItems="center"
                justifyContent="center"
                borderRadius="md"
                position="relative"
            >
                <Box
                    w="50px"
                    h="50px"
                    bg={getCellColor()}
                    borderRadius="full"
                    border={isLastMove ? "3px solid white" : "none"}
                    boxShadow={cellValue ? "0 2px 8px rgba(0,0,0,0.3)" : "inset 0 2px 8px rgba(0,0,0,0.5)"}
                />
            </Box>
        );
    };

    const renderColumnButton = (col: number) => {
        const hasPlayers = gameState?.red_player && gameState?.yellow_player;
        const isClickable = hasPlayers && isMyTurn && !gameState?.game_over;

        return (
            <Button
                key={`col-${col}`}
                w="60px"
                h="40px"
                bg={isClickable ? "green.500" : "gray.600"}
                _hover={isClickable ? { bg: 'green.600', transform: 'translateY(-2px)' } : {}}
                _active={isClickable ? { transform: 'translateY(0px)' } : {}}
                isDisabled={!isClickable}
                onClick={() => handleColumnClick(col)}
                onMouseEnter={() => setHoveredColumn(col)}
                onMouseLeave={() => setHoveredColumn(null)}
                fontSize="sm"
                fontWeight="bold"
            >
                ↓
            </Button>
        );
    };

    if (loading) {
        return (
            <Box textAlign="center" py={8}>
                <Spinner size="xl" color="orange.400" />
                <Text mt={4}>Loading Connect Four game...</Text>
            </Box>
        );
    }

    if (!gameState) {
        return (
            <Box textAlign="center" py={8}>
                <Text>Failed to load game state</Text>
            </Box>
        );
    }

    const hasPlayers = gameState.red_player && gameState.yellow_player;
    const isPlayerRed = gameState.red_player === playerAddress;
    const isPlayerYellow = gameState.yellow_player === playerAddress;
    const playerColor = isPlayerRed ? 'Red' : isPlayerYellow ? 'Yellow' : 'Spectator';

    return (
        <VStack spacing={6} align="stretch">
            <Box textAlign="center">
                <HStack justify="space-between" align="center" mb={4}>
                    <Button
                        colorScheme="red"
                        size="sm"
                        onClick={() => navigate('/tournaments')}
                        leftIcon={<span>←</span>}
                    >
                        Exit Game
                    </Button>
                    <Text fontSize="2xl" fontWeight="bold" color="orange.400">
                        Connect Four 🔴🟡
                    </Text>
                    <Box w="100px" /> {/* Spacer for centering */}
                </HStack>

                {!hasPlayers && (
                    <Alert status="warning" mb={4} borderRadius="md">
                        <AlertIcon />
                        Waiting for players to join...
                    </Alert>
                )}

                <HStack justify="center" spacing={4} mb={4}>
                    <Badge colorScheme="red" fontSize="lg" p={2} borderRadius="md">
                        Red: {gameState.red_player ? `${gameState.red_player.slice(0, 8)}...` : 'Waiting'}
                    </Badge>
                    <Badge colorScheme="yellow" fontSize="lg" p={2} borderRadius="md" color="black">
                        Yellow: {gameState.yellow_player ? `${gameState.yellow_player.slice(0, 8)}...` : 'Waiting'}
                    </Badge>
                </HStack>

                {hasPlayers && (
                    <HStack justify="center" spacing={4} mb={4}>
                        <Badge
                            colorScheme={isMyTurn ? "green" : "gray"}
                            fontSize="lg"
                            p={2}
                            borderRadius="md"
                        >
                            {isMyTurn ? '🎯 Your Turn' : `⏳ ${gameState.current_turn === 'red' ? 'Red' : 'Yellow'}'s Turn`}
                        </Badge>
                        <Badge colorScheme="purple" fontSize="md" p={2} borderRadius="md">
                            You are: {playerColor}
                        </Badge>
                    </HStack>
                )}

                {gameState.game_over && (
                    <Alert
                        status={gameState.winner ? "success" : "info"}
                        mb={4}
                        borderRadius="md"
                        fontSize="lg"
                    >
                        <AlertIcon />
                        {gameState.winner
                            ? `🎉 Winner: ${gameState.winner === gameState.red_player ? 'Red' : 'Yellow'} (${gameState.winner.slice(0, 10)}...)`
                            : "Game ended in a draw!"}
                    </Alert>
                )}

                {/* Column buttons */}
                <HStack spacing={0} justify="center" mb={2}>
                    {[...Array(7)].map((_, col) => renderColumnButton(col))}
                </HStack>

                {/* Game board */}
                <Box
                    display="inline-block"
                    p={4}
                    bg="blue.700"
                    borderRadius="xl"
                    boxShadow="0 8px 20px rgba(0,0,0,0.3)"
                >
                    <Grid
                        templateColumns="repeat(7, 60px)"
                        gap={1}
                    >
                        {[...Array(6)].map((_, row) =>
                            [...Array(7)].map((_, col) => renderCell(row, col))
                        )}
                    </Grid>
                </Box>

                <Text mt={4} fontSize="sm" color="gray.400">
                    Session: {sessionId}
                </Text>
                {gameState.move_history && gameState.move_history.length > 0 && (
                    <Text fontSize="sm" color="gray.400">
                        Moves played: {gameState.move_history.length}
                    </Text>
                )}
            </Box>
        </VStack>
    );
};

export default ConnectFourGame;

