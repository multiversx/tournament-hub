import React, { useState, useEffect, useRef } from 'react';
import {
    Box,
    Text,
    VStack,
    HStack,
    Button,
    Flex,
    Grid,
    GridItem,
    Stat,
    StatLabel,
    StatNumber,
    StatHelpText,
    Progress,
    Card,
    CardBody,
    IconButton,
    useToast,
    useColorModeValue,
    Container
} from '@chakra-ui/react';
import { Play, Pause, RotateCcw, Trophy, Star, Zap } from 'lucide-react';

interface ColorTile {
    id: string;
    color: string;
    isMatched: boolean;
    isSelected: boolean;
    x: number;
    y: number;
}

const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
const BOARD_SIZE = 8;

export const ColorRushDemo: React.FC = () => {
    const [board, setBoard] = useState<ColorTile[][]>([]);
    const [selectedTiles, setSelectedTiles] = useState<ColorTile[]>([]);
    const [gameStarted, setGameStarted] = useState(false);
    const [gameEnded, setGameEnded] = useState(false);
    const [timeRemaining, setTimeRemaining] = useState(60);
    const [isPaused, setIsPaused] = useState(false);
    const [score, setScore] = useState(0);
    const [combo, setCombo] = useState(0);
    const [tilesCleared, setTilesCleared] = useState(0);
    const [highScore, setHighScore] = useState(0);

    const gameTimerRef = useRef<NodeJS.Timeout | null>(null);
    const toast = useToast();

    const bgColor = useColorModeValue('gray.800', 'gray.900');
    const borderColor = useColorModeValue('gray.700', 'gray.600');
    const tileBgColor = useColorModeValue('gray.100', 'gray.700');

    // Initialize game board
    const initializeBoard = (): ColorTile[][] => {
        const newBoard: ColorTile[][] = [];
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
            newBoard.push(row);
        }
        return newBoard;
    };

    // Start game
    const startGame = () => {
        setBoard(initializeBoard());
        setSelectedTiles([]);
        setGameStarted(true);
        setGameEnded(false);
        setTimeRemaining(60);
        setScore(0);
        setCombo(0);
        setTilesCleared(0);
        setIsPaused(false);
        startGameTimer();

        toast({
            title: 'Game Started!',
            description: 'Match tiles of the same color to score points!',
            status: 'success',
            duration: 2000,
            isClosable: true,
        });
    };

    // Start game timer
    const startGameTimer = () => {
        if (gameTimerRef.current) {
            clearInterval(gameTimerRef.current);
        }

        gameTimerRef.current = setInterval(() => {
            setTimeRemaining((prev) => {
                if (prev <= 1) {
                    endGame();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    // End game
    const endGame = () => {
        setGameStarted(false);
        setGameEnded(true);
        if (gameTimerRef.current) {
            clearInterval(gameTimerRef.current);
        }

        // Update high score
        if (score > highScore) {
            setHighScore(score);
            toast({
                title: 'New High Score!',
                description: `Congratulations! You achieved ${score} points!`,
                status: 'success',
                duration: 4000,
                isClosable: true,
            });
        }
    };

    // Handle tile click
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
                const newScore = score + 10 * (combo + 1);
                const newCombo = combo + 1;
                const newTilesCleared = tilesCleared + 2;

                setScore(newScore);
                setCombo(newCombo);
                setTilesCleared(newTilesCleared);

                // Update board
                setBoard(prevBoard =>
                    prevBoard.map(row =>
                        row.map(t =>
                            t.id === firstTile.id || t.id === tile.id
                                ? { ...t, isMatched: true }
                                : t
                        )
                    )
                );

                // Clear selected tiles
                setSelectedTiles([]);

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
                setCombo(0);
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
        setGameStarted(false);
        setGameEnded(false);
        setSelectedTiles([]);
        setTimeRemaining(60);
        setScore(0);
        setCombo(0);
        setTilesCleared(0);
        if (gameTimerRef.current) {
            clearInterval(gameTimerRef.current);
        }
    };

    // Initialize board on mount
    useEffect(() => {
        setBoard(initializeBoard());
    }, []);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (gameTimerRef.current) {
                clearInterval(gameTimerRef.current);
            }
        };
    }, []);

    return (
        <Container maxW="container.md" py={8}>
            <Card bg={bgColor} borderColor={borderColor} borderWidth="1px">
                <CardBody>
                    <VStack spacing={6} align="stretch">
                        {/* Game Header */}
                        <Flex justify="space-between" align="center" wrap="wrap" gap={4}>
                            <VStack align="start" spacing={1}>
                                <Text fontSize="3xl" fontWeight="bold" color="blue.400">
                                    🎨 Color Rush Demo
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

                        {/* High Score */}
                        <Card bg="yellow.50" borderColor="yellow.200">
                            <CardBody>
                                <HStack justify="center" spacing={4}>
                                    <Star size={24} color="#D69E2E" />
                                    <Text fontSize="lg" fontWeight="bold" color="yellow.800">
                                        High Score: {highScore} points
                                    </Text>
                                </HStack>
                            </CardBody>
                        </Card>

                        {/* Game Stats */}
                        {gameStarted && !gameEnded && (
                            <Grid templateColumns="repeat(auto-fit, minmax(120px, 1fr))" gap={4}>
                                <GridItem>
                                    <Stat textAlign="center">
                                        <StatLabel>Score</StatLabel>
                                        <StatNumber color="green.400">{score}</StatNumber>
                                        <StatHelpText>Points</StatHelpText>
                                    </Stat>
                                </GridItem>
                                <GridItem>
                                    <Stat textAlign="center">
                                        <StatLabel>Combo</StatLabel>
                                        <StatNumber color="orange.400">x{combo + 1}</StatNumber>
                                        <StatHelpText>Multiplier</StatHelpText>
                                    </Stat>
                                </GridItem>
                                <GridItem>
                                    <Stat textAlign="center">
                                        <StatLabel>Tiles</StatLabel>
                                        <StatNumber color="purple.400">{tilesCleared}</StatNumber>
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
                                {board.map((row, rowIndex) =>
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
                                                className="game-tile"
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
                                            Final Score: {score} points
                                        </Text>
                                        <Text fontSize="md" color="purple.600">
                                            Tiles Cleared: {tilesCleared}
                                        </Text>
                                        <Text fontSize="md" color="purple.600">
                                            Best Combo: x{combo + 1}
                                        </Text>
                                        {score === highScore && score > 0 && (
                                            <HStack spacing={2} color="yellow.600">
                                                <Star size={20} />
                                                <Text fontWeight="bold">New High Score!</Text>
                                            </HStack>
                                        )}
                                    </VStack>
                                </CardBody>
                            </Card>
                        )}
                    </VStack>
                </CardBody>
            </Card>
        </Container>
    );
};

export default ColorRushDemo;
