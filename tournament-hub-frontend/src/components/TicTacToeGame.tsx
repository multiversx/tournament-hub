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

interface TicTacToeGameState {
    session_id: string;
    board: string[][];
    current_turn: string;
    winner: string | null;
    game_over: boolean;
    x_player: string | null;
    o_player: string | null;
    move_history: Array<{
        player: string;
        symbol: string;
        position: number[];
        timestamp: number;
    }>;
    game_type: string;
}

interface TicTacToeGameProps {
    sessionId: string;
    playerAddress: string;
}

export const TicTacToeGame: React.FC<TicTacToeGameProps> = ({ sessionId, playerAddress }) => {
    const [gameState, setGameState] = useState<TicTacToeGameState | null>(null);
    const [loading, setLoading] = useState(true);
    const [isMyTurn, setIsMyTurn] = useState(false);
    const toast = useToast();
    const navigate = useNavigate();

    const fetchGameState = useCallback(async () => {
        // Don't fetch if sessionId is null or invalid
        if (!sessionId || sessionId === 'null' || sessionId.trim() === '') {
            console.log('TicTacToeGame: Skipping fetch - sessionId is null or invalid');
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(`${BACKEND_BASE_URL}/tictactoe_game_state?sessionId=${sessionId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch game state');
            }
            const data = await response.json();
            setGameState(data);

            // Determine if it's the player's turn
            const currentTurn = data.current_turn;
            const isXTurn = currentTurn === 'X';
            const isPlayerX = data.x_player === playerAddress;
            setIsMyTurn(isXTurn === isPlayerX);

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
        // Only start polling if we have a valid sessionId
        if (sessionId && sessionId !== 'null' && sessionId.trim() !== '') {
            fetchGameState();
            const interval = setInterval(fetchGameState, 2000); // Poll every 2 seconds
            return () => clearInterval(interval);
        } else {
            setLoading(false);
        }
    }, [fetchGameState, sessionId]);

    const handleCellClick = async (row: number, col: number) => {
        if (!gameState || !isMyTurn || gameState.game_over) return;

        try {
            const response = await fetch(`${BACKEND_BASE_URL}/tictactoe_move`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionId: sessionId,
                    player: playerAddress,
                    row: row,
                    col: col,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Invalid move');
            }

            toast({
                title: 'Move made',
                description: `Placed ${gameState.current_turn} at position (${row}, ${col})`,
                status: 'success',
                duration: 3000,
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
        const isClickable = isMyTurn && !gameState?.game_over && cellValue === '';

        return (
            <Box
                key={`${row}-${col}`}
                w="80px"
                h="80px"
                bg="gray.700"
                border="2px solid"
                borderColor="gray.600"
                display="flex"
                alignItems="center"
                justifyContent="center"
                cursor={isClickable ? "pointer" : "default"}
                onClick={() => isClickable && handleCellClick(row, col)}
                _hover={isClickable ? { bg: 'gray.600' } : {}}
                fontSize="3xl"
                fontWeight="bold"
                color={cellValue === 'X' ? 'blue.300' : 'red.300'}
            >
                {cellValue}
            </Box>
        );
    };

    if (loading) {
        return (
            <Box textAlign="center" py={8}>
                <Spinner size="xl" color="blue.400" />
                <Text mt={4}>Loading Tic Tac Toe game...</Text>
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
                    <Text fontSize="2xl" fontWeight="bold">
                        Tic Tac Toe
                    </Text>
                    <Box w="80px" /> {/* Spacer to center the title */}
                </HStack>
                <HStack justify="center" spacing={4}>
                    <Badge colorScheme={gameState.current_turn === 'X' ? 'blue' : 'red'}>
                        {gameState.current_turn}'s Turn
                    </Badge>
                    {gameState.game_over && (
                        <Badge colorScheme="red">
                            Game Over - {gameState.winner ? `Winner: ${gameState.winner}` : 'Draw'}
                        </Badge>
                    )}
                    {isMyTurn && !gameState.game_over && (
                        <Badge colorScheme="green">Your Turn</Badge>
                    )}
                </HStack>
            </Box>

            {gameState.game_over && (
                <Alert status="info">
                    <AlertIcon />
                    {gameState.winner ? `Game Over! ${gameState.winner} wins!` : 'Game Over! It\'s a draw!'}
                </Alert>
            )}

            <Box display="flex" justifyContent="center">
                <Grid templateColumns="repeat(3, 1fr)" gap={0} border="2px solid" borderColor="gray.600">
                    {Array.from({ length: 3 }, (_, row) =>
                        Array.from({ length: 3 }, (_, col) => renderCell(row, col))
                    )}
                </Grid>
            </Box>

            <Box>
                <Text fontSize="lg" fontWeight="bold" mb={2}>Move History</Text>
                <Box maxH="200px" overflowY="auto" border="1px solid" borderColor="gray.300" p={2}>
                    {gameState.move_history.length === 0 ? (
                        <Text color="gray.500">No moves yet</Text>
                    ) : (
                        gameState.move_history.map((move, index) => (
                            <Text key={index} fontSize="sm">
                                {index + 1}. {move.player.slice(0, 8)}... placed {move.symbol} at ({move.position[0]}, {move.position[1]})
                            </Text>
                        ))
                    )}
                </Box>
            </Box>

            <HStack justify="center" spacing={4}>
                <Text fontSize="sm">
                    X: {gameState.x_player ? `${gameState.x_player.slice(0, 8)}...` : 'Unknown'}
                </Text>
                <Text fontSize="sm">
                    O: {gameState.o_player ? `${gameState.o_player.slice(0, 8)}...` : 'Unknown'}
                </Text>
            </HStack>
        </VStack>
    );
}; 