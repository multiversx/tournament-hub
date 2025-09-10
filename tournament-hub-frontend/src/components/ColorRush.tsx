import React, { useEffect, useState, useCallback, useRef } from 'react';
import { BACKEND_BASE_URL } from '../config/backend';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Text,
    VStack,
    HStack,
    Badge,
    useToast,
    useColorModeValue,
    Button,
    Flex,
    Spinner,
    Progress,
    useInterval,
    Card,
    CardBody,
    Divider,
    Grid,
    GridItem,
    Stat,
    StatLabel,
    StatNumber,
    StatHelpText,
    IconButton,
    Tooltip
} from '@chakra-ui/react';
import { Play, Pause, RotateCcw, Target, Zap, Users, Timer, Trophy, Star } from 'lucide-react';

interface ColorRushGameProps {
    sessionId: string;
    playerAddress: string;
}

interface GameState {
    session_id: string;
    players: string[];
    board: ColorTile[][];
    current_player: string;
    winner: string | null;
    game_over: boolean;
    start_time: number | null;
    end_time: number | null;
    scores: Record<string, number>;
    game_duration: number;
    level: number;
    tiles_cleared: number;
    combo_multiplier: number;
    time_bonus: number;
}

interface ColorTile {
    id: string;
    color: string;
    isMatched: boolean;
    isSelected: boolean;
    x: number;
    y: number;
}

const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
const BOARD_SIZE = 8; // 8x8 grid for mobile-friendly gameplay

export const ColorRush: React.FC<ColorRushGameProps> = ({ sessionId, playerAddress }) => {
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [gameStarted, setGameStarted] = useState(false);
    const [gameEnded, setGameEnded] = useState(false);
    const [selectedTiles, setSelectedTiles] = useState<ColorTile[]>([]);
    const [timeRemaining, setTimeRemaining] = useState(60); // 60 seconds per level
    const [isPaused, setIsPaused] = useState(false);
    const [gameStartToastShown, setGameStartToastShown] = useState(false);
    const [gameEndToastShown, setGameEndToastShown] = useState(false);
    const [localScore, setLocalScore] = useState(0);
    const [localCombo, setLocalCombo] = useState(0);
    const [localTilesCleared, setLocalTilesCleared] = useState(0);

    const startGameAttemptedRef = useRef(false);
    const joinGameAttemptedRef = useRef(false);
    const gameTimerRef = useRef<NodeJS.Timeout | null>(null);

    const toast = useToast();
    const navigate = useNavigate();
    const bgColor = useColorModeValue('gray.800', 'gray.900');
    const borderColor = useColorModeValue('gray.700', 'gray.600');
    const tileBgColor = useColorModeValue('gray.100', 'gray.700');

    // Join the game session
    const joinGame = useCallback(async () => {
        if (joinGameAttemptedRef.current) return;
        joinGameAttemptedRef.current = true;

        try {
            const response = await fetch(`${BACKEND_BASE_URL}/join_colorrush_session?sessionId=${sessionId}&player=${playerAddress}`, {
                method: 'POST',
            });

            if (response.ok) {
                console.log(`Successfully joined Color Rush game session ${sessionId}`);
            } else {
                console.error('Failed to join game session:', response.status);
            }
        } catch (error) {
            console.error('Error joining game session:', error);
        }
    }, [sessionId, playerAddress]);

    // Start the game
    const startGame = useCallback(async () => {
        if (startGameAttemptedRef.current) return;
        startGameAttemptedRef.current = true;

        try {
            const response = await fetch(`${BACKEND_BASE_URL}/start_colorrush_game`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionId: sessionId,
                    player: playerAddress,
                }),
            });

            if (response.ok) {
                console.log('Color Rush game started successfully');
                setGameStarted(true);
                setTimeRemaining(60);
                startGameTimer();

                if (!gameStartToastShown) {
                    toast({
                        title: 'Game Started!',
                        description: 'Match tiles of the same color to score points!',
                        status: 'success',
                        duration: 3000,
                        isClosable: true,
                    });
                    setGameStartToastShown(true);
                }
            } else {
                console.error('Failed to start game:', response.status);
                toast({
                    title: 'Error',
                    description: 'Failed to start game',
                    status: 'error',
                    duration: 5000,
                    isClosable: true,
                });
            }
        } catch (error) {
            console.error('Error starting game:', error);
            toast({
                title: 'Error',
                description: 'Failed to start game',
                status: 'error',
                duration: 5000,
                isClosable: true,
            });
        }
    }, [sessionId, playerAddress, toast, gameStartToastShown]);

    // Fetch game state
    const fetchGameState = useCallback(async () => {
        // Don't fetch if sessionId is null or invalid
        if (!sessionId || sessionId === 'null' || sessionId.trim() === '') {
            console.log('ColorRush: Skipping fetch - sessionId is null or invalid');
            setIsLoading(false);
            return;
        }

        try {
            const response = await fetch(`${BACKEND_BASE_URL}/colorrush_game_state?sessionId=${sessionId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch game state');
            }
            const data = await response.json();
            setGameState(data);

            if (data.game_over && !gameEnded) {
                setGameEnded(true);
                setGameStarted(false);
                if (gameTimerRef.current) {
                    clearInterval(gameTimerRef.current);
                }

                if (!gameEndToastShown) {
                    const winner = data.winner;
                    const isWinner = winner === playerAddress;
                    toast({
                        title: isWinner ? 'Congratulations!' : 'Game Over',
                        description: isWinner
                            ? `You won with ${data.scores[playerAddress] || 0} points!`
                            : `Game ended. Winner: ${winner || 'Unknown'}`,
                        status: isWinner ? 'success' : 'info',
                        duration: 5000,
                        isClosable: true,
                    });
                    setGameEndToastShown(true);
                }
            }
        } catch (error) {
            console.error('Error fetching game state:', error);
        } finally {
            setIsLoading(false);
        }
    }, [sessionId, playerAddress, gameEnded, gameEndToastShown, toast]);

    // Start game timer
    const startGameTimer = () => {
        if (gameTimerRef.current) {
            clearInterval(gameTimerRef.current);
        }

        gameTimerRef.current = setInterval(() => {
            setTimeRemaining((prev) => {
                if (prev <= 1) {
                    // Time's up - submit final score
                    submitScore();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    // Submit score to backend
    const submitScore = async () => {
        try {
            const response = await fetch(`${BACKEND_BASE_URL}/submit_colorrush_score`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionId: sessionId,
                    player: playerAddress,
                    score: localScore,
                    tilesCleared: localTilesCleared,
                    combo: localCombo,
                }),
            });

            if (response.ok) {
                console.log('Score submitted successfully');
            }
        } catch (error) {
            console.error('Error submitting score:', error);
        }
    };

    // Handle tile selection
    const handleTileClick = (tile: ColorTile) => {
        if (!gameStarted || gameEnded || tile.isMatched) return;

        if (selectedTiles.length === 0) {
            // First tile selected
            setSelectedTiles([tile]);
        } else if (selectedTiles.length === 1) {
            const firstTile = selectedTiles[0];

            if (firstTile.id === tile.id) {
                // Same tile clicked twice - deselect
                setSelectedTiles([]);
            } else if (firstTile.color === tile.color) {
                // Match found!
                const newScore = localScore + 10 * (localCombo + 1);
                const newCombo = localCombo + 1;
                const newTilesCleared = localTilesCleared + 2;

                setLocalScore(newScore);
                setLocalCombo(newCombo);
                setLocalTilesCleared(newTilesCleared);

                // Clear selected tiles
                setSelectedTiles([]);

                // Update game state
                if (gameState) {
                    const newBoard = gameState.board.map(row =>
                        row.map(t =>
                            t.id === firstTile.id || t.id === tile.id
                                ? { ...t, isMatched: true }
                                : t
                        )
                    );

                    setGameState({
                        ...gameState,
                        board: newBoard,
                        scores: {
                            ...gameState.scores,
                            [playerAddress]: newScore
                        }
                    });
                }

                // Show combo message
                if (newCombo > 1) {
                    toast({
                        title: `Combo x${newCombo}!`,
                        description: `+${10 * newCombo} points!`,
                        status: 'success',
                        duration: 1000,
                        isClosable: false,
                    });
                }
            } else {
                // No match - reset combo and select new tile
                setLocalCombo(0);
                setSelectedTiles([tile]);
            }
        }
    };

    // Pause/Resume game
    const togglePause = () => {
        if (isPaused) {
            setIsPaused(false);
            startGameTimer();
        } else {
            setIsPaused(true);
            if (gameTimerRef.current) {
                clearInterval(gameTimerRef.current);
            }
        }
    };

    // Reset game
    const resetGame = () => {
        setLocalScore(0);
        setLocalCombo(0);
        setLocalTilesCleared(0);
        setSelectedTiles([]);
        setTimeRemaining(60);
        setGameStarted(false);
        setGameEnded(false);
        setGameStartToastShown(false);
        setGameEndToastShown(false);
        if (gameTimerRef.current) {
            clearInterval(gameTimerRef.current);
        }
    };

    // Initialize game board
    const initializeBoard = (): ColorTile[][] => {
        const board: ColorTile[][] = [];
        for (let i = 0; i < BOARD_SIZE; i++) {
            const row: ColorTile[] = [];
            for (let j = 0; j < BOARD_SIZE; j++) {
                const color = COLORS[Math.floor(Math.random() * COLORS.length)];
                row.push({
                    id: `${i}-${j}`,
                    color,
                    isMatched: false,
                    isSelected: false,
                    x: i,
                    y: j
                });
            }
            board.push(row);
        }
        return board;
    };

    // Initialize game state if not exists
    useEffect(() => {
        if (!gameState) {
            const initialBoard = initializeBoard();
            setGameState({
                session_id: sessionId,
                players: [playerAddress],
                board: initialBoard,
                current_player: playerAddress,
                winner: null,
                game_over: false,
                start_time: null,
                end_time: null,
                scores: { [playerAddress]: 0 },
                game_duration: 0,
                level: 1,
                tiles_cleared: 0,
                combo_multiplier: 1,
                time_bonus: 0
            });
        }
    }, [gameState, sessionId, playerAddress]);

    // Join game on mount
    useEffect(() => {
        joinGame();
    }, [joinGame]);

    // Fetch game state periodically
    useEffect(() => {
        if (gameStarted && !gameEnded) {
            const interval = setInterval(fetchGameState, 1000);
            return () => clearInterval(interval);
        }
    }, [fetchGameState, gameStarted, gameEnded]);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (gameTimerRef.current) {
                clearInterval(gameTimerRef.current);
            }
        };
    }, []);

    if (isLoading) {
        return (
            <Box textAlign="center" py={8}>
                <Spinner size="xl" color="blue.400" />
                <Text mt={4}>Loading Color Rush...</Text>
            </Box>
        );
    }

    return (
        <Box maxW="100%" mx="auto" p={4}>
            <Card bg={bgColor} borderColor={borderColor} borderWidth="1px">
                <CardBody>
                    <VStack spacing={6} align="stretch">
                        {/* Game Header */}
                        <Flex justify="space-between" align="center" wrap="wrap" gap={4}>
                            <VStack align="start" spacing={1}>
                                <Text fontSize="2xl" fontWeight="bold" color="blue.400">
                                    🎨 Color Rush
                                </Text>
                                <Text fontSize="sm" color="gray.400">
                                    Match tiles of the same color to score points!
                                </Text>
                            </VStack>

                            <HStack spacing={3}>
                                {!gameStarted && !gameEnded && (
                                    <Button
                                        leftIcon={<Play size={16} />}
                                        colorScheme="green"
                                        onClick={startGame}
                                        size="lg"
                                    >
                                        Start Game
                                    </Button>
                                )}

                                {gameStarted && !gameEnded && (
                                    <>
                                        <IconButton
                                            aria-label={isPaused ? "Resume" : "Pause"}
                                            icon={isPaused ? <Play size={16} /> : <Pause size={16} />}
                                            onClick={togglePause}
                                            colorScheme="blue"
                                            size="lg"
                                        />
                                        <IconButton
                                            aria-label="Reset"
                                            icon={<RotateCcw size={16} />}
                                            onClick={resetGame}
                                            colorScheme="red"
                                            size="lg"
                                        />
                                    </>
                                )}

                                {gameEnded && (
                                    <Button
                                        leftIcon={<RotateCcw size={16} />}
                                        colorScheme="blue"
                                        onClick={resetGame}
                                        size="lg"
                                    >
                                        Play Again
                                    </Button>
                                )}
                            </HStack>
                        </Flex>

                        {/* Game Stats */}
                        {gameStarted && !gameEnded && (
                            <Grid templateColumns="repeat(auto-fit, minmax(120px, 1fr))" gap={4}>
                                <GridItem>
                                    <Stat textAlign="center">
                                        <StatLabel>Score</StatLabel>
                                        <StatNumber color="green.400">{localScore}</StatNumber>
                                        <StatHelpText>Points</StatHelpText>
                                    </Stat>
                                </GridItem>
                                <GridItem>
                                    <Stat textAlign="center">
                                        <StatLabel>Combo</StatLabel>
                                        <StatNumber color="orange.400">x{localCombo + 1}</StatNumber>
                                        <StatHelpText>Multiplier</StatHelpText>
                                    </Stat>
                                </GridItem>
                                <GridItem>
                                    <Stat textAlign="center">
                                        <StatLabel>Tiles</StatLabel>
                                        <StatNumber color="purple.400">{localTilesCleared}</StatNumber>
                                        <StatHelpText>Cleared</StatHelpText>
                                    </Stat>
                                </GridItem>
                                <GridItem>
                                    <Stat textAlign="center">
                                        <StatLabel>Time</StatLabel>
                                        <StatNumber color={timeRemaining <= 10 ? "red.400" : "blue.400"}>
                                            {timeRemaining}s
                                        </StatNumber>
                                        <StatHelpText>Remaining</StatHelpText>
                                    </Stat>
                                </GridItem>
                            </Grid>
                        )}

                        {/* Timer Progress Bar */}
                        {gameStarted && !gameEnded && (
                            <Box>
                                <Progress
                                    value={(timeRemaining / 60) * 100}
                                    colorScheme={timeRemaining <= 10 ? "red" : "blue"}
                                    size="lg"
                                    borderRadius="md"
                                />
                            </Box>
                        )}

                        {/* Game Board */}
                        <Box
                            bg={tileBgColor}
                            p={2}
                            borderRadius="lg"
                            border="2px solid"
                            borderColor={borderColor}
                            overflow="hidden"
                            maxW="100%"
                        >
                            <Grid
                                templateColumns={`repeat(${BOARD_SIZE}, 1fr)`}
                                gap={1}
                                maxW="360px"
                                mx="auto"
                            >
                                {gameState?.board.map((row, rowIndex) =>
                                    row.map((tile, colIndex) => (
                                        <GridItem key={tile.id}>
                                            <Box
                                                w={{ base: "35px", md: "40px" }}
                                                h={{ base: "35px", md: "40px" }}
                                                bg={tile.isMatched ? "transparent" : tile.color}
                                                border="2px solid"
                                                borderColor={
                                                    tile.isMatched
                                                        ? "transparent"
                                                        : selectedTiles.some(t => t.id === tile.id)
                                                            ? "white"
                                                            : borderColor
                                                }
                                                borderRadius="md"
                                                cursor={tile.isMatched ? "default" : "pointer"}
                                                onClick={() => handleTileClick(tile)}
                                                transition="all 0.2s"
                                                _hover={{
                                                    transform: tile.isMatched ? "none" : "scale(1.05)",
                                                    boxShadow: tile.isMatched ? "none" : "0 0 10px rgba(255,255,255,0.3)"
                                                }}
                                                _active={{
                                                    transform: tile.isMatched ? "none" : "scale(0.95)"
                                                }}
                                                opacity={tile.isMatched ? 0.3 : 1}
                                                position="relative"
                                                boxShadow={selectedTiles.some(t => t.id === tile.id) ? "0 0 15px rgba(255,255,255,0.6)" : "none"}
                                            >
                                                {tile.isMatched && (
                                                    <Box
                                                        position="absolute"
                                                        top="50%"
                                                        left="50%"
                                                        transform="translate(-50%, -50%)"
                                                        fontSize={{ base: "16px", md: "20px" }}
                                                        animation="pulse 1s infinite"
                                                    >
                                                        ✨
                                                    </Box>
                                                )}
                                            </Box>
                                        </GridItem>
                                    ))
                                )}
                            </Grid>
                        </Box>

                        {/* Game Instructions */}
                        {!gameStarted && !gameEnded && (
                            <Card bg="blue.50" borderColor="blue.200">
                                <CardBody>
                                    <VStack spacing={3} align="start">
                                        <Text fontWeight="bold" color="blue.800">
                                            🎯 How to Play:
                                        </Text>
                                        <Text fontSize="sm" color="blue.700">
                                            • Tap two tiles of the same color to match them
                                        </Text>
                                        <Text fontSize="sm" color="blue.700">
                                            • Build combos for higher scores
                                        </Text>
                                        <Text fontSize="sm" color="blue.700">
                                            • Clear as many tiles as possible in 60 seconds
                                        </Text>
                                        <Text fontSize="sm" color="blue.700">
                                            • Higher combos = more points!
                                        </Text>
                                    </VStack>
                                </CardBody>
                            </Card>
                        )}

                        {/* Game Over Summary */}
                        {gameEnded && (
                            <Card bg="purple.50" borderColor="purple.200">
                                <CardBody>
                                    <VStack spacing={4} align="center">
                                        <Trophy size={48} color="#805AD5" />
                                        <Text fontSize="xl" fontWeight="bold" color="purple.800">
                                            Game Over!
                                        </Text>
                                        <Text fontSize="lg" color="purple.700">
                                            Final Score: {localScore} points
                                        </Text>
                                        <Text fontSize="md" color="purple.600">
                                            Tiles Cleared: {localTilesCleared}
                                        </Text>
                                        <Text fontSize="md" color="purple.600">
                                            Best Combo: x{localCombo + 1}
                                        </Text>
                                    </VStack>
                                </CardBody>
                            </Card>
                        )}

                        {/* Exit Button */}
                        <Button
                            colorScheme="red"
                            variant="outline"
                            onClick={() => navigate('/tournaments')}
                            leftIcon={<Users size={16} />}
                        >
                            Exit to Tournaments
                        </Button>
                    </VStack>
                </CardBody>
            </Card>
        </Box>
    );
};

export default ColorRush;
