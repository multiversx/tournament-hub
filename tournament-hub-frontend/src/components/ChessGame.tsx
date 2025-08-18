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

interface ChessPiece {
    type: string;
    color: string;
    has_moved: boolean;
}

interface ChessGameState {
    session_id: string;
    board: { [key: string]: ChessPiece };
    current_turn: string;
    winner: string | null;
    game_over: boolean;
    white_player: string | null;
    black_player: string | null;
    captured_by_white?: Array<{ type: string; color: string }>;
    captured_by_black?: Array<{ type: string; color: string }>;
    move_history: Array<{
        from: string;
        to: string;
        piece: string;
        color: string;
        is_capture: boolean;
        is_promotion: boolean;
    }>;
    game_type: string;
}

interface ChessGameProps {
    sessionId: string;
    playerAddress: string;
}

const pieceSymbols: { [key: string]: string } = {
    'pawn': '♟',
    'rook': '♜',
    'knight': '♞',
    'bishop': '♝',
    'queen': '♛',
    'king': '♚',
};

const pieceSymbolsWhite: { [key: string]: string } = {
    'pawn': '♙',
    'rook': '♖',
    'knight': '♘',
    'bishop': '♗',
    'queen': '♕',
    'king': '♔',
};

export const ChessGame: React.FC<ChessGameProps> = ({ sessionId, playerAddress }) => {
    const [gameState, setGameState] = useState<ChessGameState | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
    const [validMoves, setValidMoves] = useState<string[]>([]);
    const [isMyTurn, setIsMyTurn] = useState(false);
    const toast = useToast();
    const navigate = useNavigate();

    const fetchGameState = useCallback(async () => {
        try {
            const response = await fetch(`${BACKEND_BASE_URL}/chess_game_state?sessionId=${sessionId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch game state');
            }
            const data = await response.json();
            setGameState(data);

            // Determine if it's the player's turn
            const currentTurn = data.current_turn;
            const isWhiteTurn = currentTurn === 'white';
            const isPlayerWhite = data.white_player === playerAddress;
            setIsMyTurn(isWhiteTurn === isPlayerWhite);

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
        fetchGameState();
        const interval = setInterval(fetchGameState, 2000); // Poll every 2 seconds
        return () => clearInterval(interval);
    }, [fetchGameState]);

    const handleSquareClick = async (square: string) => {
        if (!gameState || !isMyTurn || gameState.game_over) return;

        if (selectedSquare === square) {
            // Deselect if clicking the same square
            setSelectedSquare(null);
            setValidMoves([]);
            return;
        }

        if (selectedSquare) {
            // Try to make a move
            try {
                const response = await fetch(`${BACKEND_BASE_URL}/chess_move`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        sessionId: sessionId,
                        player: playerAddress,
                        from_pos: selectedSquare,
                        to_pos: square,
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Invalid move');
                }

                // Move successful, clear selection
                setSelectedSquare(null);
                setValidMoves([]);

                toast({
                    title: 'Move made',
                    description: `Moved from ${selectedSquare} to ${square}`,
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
        } else {
            // Select a piece
            const piece = gameState.board[square];
            if (piece) {
                const isPlayerWhite = gameState.white_player === playerAddress;
                const isPieceWhite = piece.color === 'white';

                if (isPlayerWhite === isPieceWhite) {
                    setSelectedSquare(square);
                    // For now, we'll show all squares as valid moves (simplified)
                    // In a full implementation, you'd calculate valid moves
                    setValidMoves([]);
                }
            }
        }
    };

    const renderSquare = (x: number, y: number) => {
        const square = `${x},${y}`;
        const piece = gameState?.board[square];
        const isSelected = selectedSquare === square;
        const isValidMove = validMoves.includes(square);
        const isLightSquare = (x + y) % 2 === 0;

        let bgColor = isLightSquare ? 'gray.100' : 'gray.600';
        if (isSelected) bgColor = 'blue.300';
        else if (isValidMove) bgColor = 'green.300';

        return (
            <Box
                key={square}
                w="60px"
                h="60px"
                bg={bgColor}
                border="1px solid"
                borderColor="gray.400"
                display="flex"
                alignItems="center"
                justifyContent="center"
                cursor="pointer"
                onClick={() => handleSquareClick(square)}
                _hover={{ opacity: 0.8 }}
                fontSize="2xl"
                color={piece?.color === 'white' ? 'white' : 'black'}
                textShadow={piece?.color === 'white' ? '1px 1px 2px black' : '1px 1px 2px white'}
            >
                {piece && (piece.color === 'white' ? pieceSymbolsWhite[piece.type] : pieceSymbols[piece.type])}
            </Box>
        );
    };

    if (loading) {
        return (
            <Box textAlign="center" py={8}>
                <Spinner size="xl" color="blue.400" />
                <Text mt={4}>Loading chess game...</Text>
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
                        Chess Game
                    </Text>
                    <Box w="80px" /> {/* Spacer to center the title */}
                </HStack>
                <HStack justify="center" spacing={4}>
                    <Badge colorScheme={gameState.current_turn === 'white' ? 'blue' : 'gray'}>
                        {gameState.current_turn === 'white' ? 'White' : 'Black'}'s Turn
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
                <Grid templateColumns="repeat(8, 1fr)" gap={0} border="2px solid" borderColor="gray.400">
                    {Array.from({ length: 8 }, (_, row) =>
                        Array.from({ length: 8 }, (_, x) => {
                            // Flip y-coordinate so that y=0 (white's back rank) is at bottom
                            const y = 7 - row;
                            return renderSquare(x, y);
                        })
                    )}
                </Grid>
            </Box>

            {/* Captured Pieces */}
            <Box>
                <Text fontSize="lg" fontWeight="bold" mb={2}>Captured Pieces</Text>
                <HStack spacing={8} justify="center">
                    {/* Pieces captured by White */}
                    <Box>
                        <Text fontSize="md" fontWeight="semibold" mb={2} color="white">
                            Captured by White
                        </Text>
                        <HStack wrap="wrap" spacing={1}>
                            {(gameState.captured_by_white || []).map((piece, index) => (
                                <Box
                                    key={index}
                                    w="30px"
                                    h="30px"
                                    display="flex"
                                    alignItems="center"
                                    justifyContent="center"
                                    bg="gray.700"
                                    border="1px solid"
                                    borderColor="gray.500"
                                    borderRadius="md"
                                    fontSize="lg"
                                    color="black"
                                >
                                    {pieceSymbols[piece.type]}
                                </Box>
                            ))}
                            {(!gameState.captured_by_white || gameState.captured_by_white.length === 0) && (
                                <Text fontSize="sm" color="gray.500">None</Text>
                            )}
                        </HStack>
                    </Box>

                    {/* Pieces captured by Black */}
                    <Box>
                        <Text fontSize="md" fontWeight="semibold" mb={2} color="white">
                            Captured by Black
                        </Text>
                        <HStack wrap="wrap" spacing={1}>
                            {(gameState.captured_by_black || []).map((piece, index) => (
                                <Box
                                    key={index}
                                    w="30px"
                                    h="30px"
                                    display="flex"
                                    alignItems="center"
                                    justifyContent="center"
                                    bg="gray.700"
                                    border="1px solid"
                                    borderColor="gray.500"
                                    borderRadius="md"
                                    fontSize="lg"
                                    color="white"
                                    textShadow="1px 1px 2px black"
                                >
                                    {piece.color === 'white' ? pieceSymbolsWhite[piece.type] : pieceSymbols[piece.type]}
                                </Box>
                            ))}
                            {(!gameState.captured_by_black || gameState.captured_by_black.length === 0) && (
                                <Text fontSize="sm" color="gray.500">None</Text>
                            )}
                        </HStack>
                    </Box>
                </HStack>
            </Box>

            <Box>
                <Text fontSize="lg" fontWeight="bold" mb={2}>Move History</Text>
                <Box maxH="200px" overflowY="auto" border="1px solid" borderColor="gray.300" p={2}>
                    {gameState.move_history.length === 0 ? (
                        <Text color="gray.500">No moves yet</Text>
                    ) : (
                        gameState.move_history.map((move, index) => (
                            <Text key={index} fontSize="sm">
                                {index + 1}. {move.piece} {move.from} → {move.to}
                                {move.is_capture && ' (capture)'}
                                {move.is_promotion && ' (promotion)'}
                            </Text>
                        ))
                    )}
                </Box>
            </Box>

            <HStack justify="center" spacing={4}>
                <Text fontSize="sm">
                    White: {gameState.white_player ? `${gameState.white_player.slice(0, 8)}...` : 'Unknown'}
                </Text>
                <Text fontSize="sm">
                    Black: {gameState.black_player ? `${gameState.black_player.slice(0, 8)}...` : 'Unknown'}
                </Text>
            </HStack>
        </VStack>
    );
}; 