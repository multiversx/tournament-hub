import React, { useEffect, useRef, useState, useCallback } from 'react';
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
    useInterval
} from '@chakra-ui/react';
import { Play, Pause, RotateCcw, Target, MapPin, Globe, Zap } from 'lucide-react';

interface CryptoBubblesGameProps {
    sessionId: string;
    playerAddress: string;
}

interface GameState {
    session_id: string;
    players: string[];
    cells: Record<string, {
        x: number;
        y: number;
        size: number;
        state: string;
    }>;
    pellets: Array<{
        x: number;
        y: number;
        size: number;
    }>;
    winner: string | null;
    game_over: boolean;
    start_time: number | null;
    arena_size: [number, number];
    expansion_history: Array<{
        timestamp: number;
        old_size: [number, number];
        new_size: [number, number];
        reason: string;
    }>;
    max_arena_size: [number, number];
}

export const CryptoBubblesGame: React.FC<CryptoBubblesGameProps> = ({ sessionId, playerAddress }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [gameStarted, setGameStarted] = useState(false);
    const [gameEnded, setGameEnded] = useState(false);
    const [lastCursorPosition, setLastCursorPosition] = useState<{ x: number; y: number } | null>(null);
    const [viewport, setViewport] = useState({ x: 0, y: 0, width: 800, height: 600 });
    const [gameStartToastShown, setGameStartToastShown] = useState(false);
    const [gameEndToastShown, setGameEndToastShown] = useState(false);
    const startGameAttemptedRef = useRef(false);

    const toast = useToast();
    const bgColor = useColorModeValue('gray.800', 'gray.900');
    const borderColor = useColorModeValue('gray.700', 'gray.600');

    // Start the game
    const startGame = useCallback(async () => {
        if (startGameAttemptedRef.current) return;
        startGameAttemptedRef.current = true;

        try {
            const response = await fetch('http://localhost:8000/start_cryptobubbles_game', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ sessionId }),
            });

            if (response.ok) {
                setGameStarted(true);
                if (!gameStartToastShown) {
                    toast({
                        title: 'Game Started!',
                        description: 'The battle begins!',
                        status: 'success',
                        duration: 3000,
                        isClosable: true,
                    });
                    setGameStartToastShown(true);
                }
            }
        } catch (error) {
            console.error('Error starting game:', error);
        }
    }, [sessionId, toast, gameStartToastShown]);

    // Fetch game state
    const fetchGameState = useCallback(async () => {
        try {
            const response = await fetch(`http://localhost:8000/cryptobubbles_game_state?sessionId=${sessionId}`);
            if (response.ok) {
                const data = await response.json();
                setGameState(data);
                setIsLoading(false);

                // Auto-start game if not started yet
                if (!gameStarted && data.start_time) {
                    setGameStarted(true);
                }

                // Check for game end
                if (data.game_over && !gameEnded) {
                    setGameEnded(true);
                    if (!gameEndToastShown) {
                        toast({
                            title: 'Game Over!',
                            description: data.winner ? `Winner: ${data.winner}` : 'No winner',
                            status: data.winner ? 'success' : 'info',
                            duration: 5000,
                            isClosable: true,
                        });
                        setGameEndToastShown(true);
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching game state:', error);
        }
    }, [sessionId, gameStarted, gameEnded, gameEndToastShown, toast]);

    // Submit move
    const submitMove = useCallback(async (x: number, y: number) => {
        if (!gameStarted || gameEnded) return;

        try {
            // Use the playerAddress prop passed to the component
            const currentPlayerAddress = playerAddress;
            if (!currentPlayerAddress) {
                console.error('No player address provided to component');
                return;
            }

            await fetch('http://localhost:8000/cryptobubbles_move', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionId,
                    player: currentPlayerAddress, // Use the actual player address
                    x,
                    y,
                }),
            });
        } catch (error) {
            console.error('Error submitting move:', error);
        }
    }, [sessionId, gameState, gameStarted, gameEnded]);

    // Handle mouse movement
    const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
        if (!canvasRef.current || !gameState) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const canvasX = event.clientX - rect.left;
        const canvasY = event.clientY - rect.top;

        // Convert canvas coordinates to world coordinates
        const worldX = canvasX + viewport.x;
        const worldY = canvasY + viewport.y;

        setLastCursorPosition({ x: worldX, y: worldY });
    }, [gameState, viewport]);

    // Handle mouse leave
    const handleMouseLeave = useCallback(() => {
        // Don't clear lastCursorPosition to maintain continuous movement
    }, []);

    // Game loop for continuous movement
    useInterval(() => {
        if (lastCursorPosition && gameState && !gameEnded) {
            submitMove(lastCursorPosition.x, lastCursorPosition.y);
        }
    }, 50); // Update every 50ms for more responsive movement

    // Polling for game state updates
    useInterval(() => {
        if (!gameEnded) {
            fetchGameState();
        }
    }, 50); // 20 FPS for smoother updates

    // Auto-start game when component mounts
    useEffect(() => {
        startGame();
    }, [startGame]);

    // Set initial cursor position when game starts
    useEffect(() => {
        if (gameState && gameState.players.length > 0 && !lastCursorPosition) {
            const currentPlayerAddress = playerAddress;
            const playerCell = gameState.cells[currentPlayerAddress];
            if (playerCell) {
                setLastCursorPosition({ x: playerCell.x, y: playerCell.y });
            }
        }
    }, [gameState, lastCursorPosition, playerAddress]);

    // Render game
    const renderGame = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !gameState) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Find current player cell - use the playerAddress prop
        const currentPlayerAddress = playerAddress;
        const currentPlayerCell = gameState.cells[currentPlayerAddress];
        if (!currentPlayerCell) return;

        // Calculate viewport to center on player
        const newViewportX = Math.max(0, Math.min(currentPlayerCell.x - canvas.width / 2, gameState.arena_size[0] - canvas.width));
        const newViewportY = Math.max(0, Math.min(currentPlayerCell.y - canvas.height / 2, gameState.arena_size[1] - canvas.height));
        setViewport(prev => ({ ...prev, x: newViewportX, y: newViewportY }));

        // Draw grid background
        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 1;
        const gridSize = 50;
        const offsetX = newViewportX % gridSize;
        const offsetY = newViewportY % gridSize;

        for (let x = -offsetX; x < canvas.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }

        for (let y = -offsetY; y < canvas.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }

        // Draw pellets (only those in or near viewport)
        ctx.fillStyle = '#FFD93D';
        gameState.pellets.forEach(pellet => {
            const screenX = pellet.x - newViewportX;
            const screenY = pellet.y - newViewportY;

            // Only render pellets within or close to viewport
            if (screenX >= -50 && screenX <= canvas.width + 50 &&
                screenY >= -50 && screenY <= canvas.height + 50) {
                ctx.beginPath();
                ctx.arc(screenX, screenY, pellet.size, 0, 2 * Math.PI);
                ctx.fill();
            }
        });

        // Draw cells (only alive cells)
        Object.entries(gameState.cells).forEach(([cellPlayerAddress, cell]) => {
            // Skip dead cells
            if (cell.state === 'dead') {
                return;
            }

            const screenX = cell.x - newViewportX;
            const screenY = cell.y - newViewportY;

            // Only render cells within or close to viewport
            if (screenX >= -cell.size && screenX <= canvas.width + cell.size &&
                screenY >= -cell.size && screenY <= canvas.height + cell.size) {

                // Choose color based on whether this cell belongs to the current player or is a bot
                const isCurrentPlayer = cellPlayerAddress === playerAddress;
                const isBot = cellPlayerAddress.startsWith('Bot_');

                if (isBot) {
                    ctx.fillStyle = '#9B59B6'; // Purple for bots
                    ctx.strokeStyle = '#8E44AD';
                } else if (isCurrentPlayer) {
                    ctx.fillStyle = '#4ECDC4'; // Cyan for current player
                    ctx.strokeStyle = '#2ECC71';
                } else {
                    ctx.fillStyle = '#FF6B6B'; // Red for other players
                    ctx.strokeStyle = '#E74C3C';
                }
                ctx.lineWidth = 2;

                // Draw cell
                ctx.beginPath();
                ctx.arc(screenX, screenY, cell.size, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();

                // Draw player name - use shortened address
                ctx.fillStyle = '#FFFFFF';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(cellPlayerAddress.slice(0, 8) + '...', screenX, screenY - cell.size - 10);
            }
        });

        // Draw target indicator
        if (lastCursorPosition) {
            const targetScreenX = lastCursorPosition.x - newViewportX;
            const targetScreenY = lastCursorPosition.y - newViewportY;

            // Draw dashed circle at target
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(targetScreenX, targetScreenY, 20, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw center dot
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(targetScreenX, targetScreenY, 3, 0, 2 * Math.PI);
            ctx.fill();
        }
    }, [gameState, playerAddress, lastCursorPosition]);

    // Render mini-map
    const renderMiniMap = useCallback(() => {
        if (!gameState) return null;

        const mapSize = 150;
        const scale = mapSize / Math.max(gameState.arena_size[0], gameState.arena_size[1]);

        return (
            <Box
                position="absolute"
                top="4"
                right="4"
                bg="rgba(0, 0, 0, 0.8)"
                borderRadius="md"
                p={3}
                border="1px solid"
                borderColor="gray.600"
            >
                <Text fontSize="xs" color="white" mb={2} textAlign="center">
                    World Map
                </Text>
                <Text fontSize="xs" color="gray.300" mb={1}>
                    Expansions: {gameState.expansion_history.length}
                </Text>
                <svg width={mapSize} height={mapSize} style={{ background: 'rgba(0, 0, 0, 0.5)' }}>
                    {/* Arena border */}
                    <rect
                        x={0}
                        y={0}
                        width={gameState.arena_size[0] * scale}
                        height={gameState.arena_size[1] * scale}
                        fill="none"
                        stroke="#444"
                        strokeWidth="1"
                    />

                    {/* Expansion zones (green dashed lines) */}
                    {gameState.expansion_history.slice(-3).map((expansion, index) => (
                        <rect
                            key={index}
                            x={expansion.old_size[0] * scale}
                            y={expansion.old_size[1] * scale}
                            width={(expansion.new_size[0] - expansion.old_size[0]) * scale}
                            height={(expansion.new_size[1] - expansion.old_size[1]) * scale}
                            fill="none"
                            stroke="#00FF00"
                            strokeWidth="1"
                            strokeDasharray="3,3"
                        />
                    ))}

                    {/* Viewport rectangle - calculate based on current player position */}
                    {(() => {
                        const currentPlayerCell = gameState.cells[playerAddress];
                        if (!currentPlayerCell) return null;

                        const viewportX = Math.max(0, Math.min(currentPlayerCell.x - 400, gameState.arena_size[0] - 800));
                        const viewportY = Math.max(0, Math.min(currentPlayerCell.y - 300, gameState.arena_size[1] - 600));

                        return (
                            <rect
                                x={viewportX * scale}
                                y={viewportY * scale}
                                width={800 * scale}
                                height={600 * scale}
                                fill="none"
                                stroke="#FFFFFF"
                                strokeWidth="2"
                            />
                        );
                    })()}

                    {/* Pellets - show all pellets including new ones from expansion */}
                    {gameState.pellets.map((pellet, index) => (
                        <circle
                            key={index}
                            cx={pellet.x * scale}
                            cy={pellet.y * scale}
                            r={1}
                            fill="#FFD93D"
                        />
                    ))}

                    {/* Players (only alive) */}
                    {Object.entries(gameState.cells)
                        .filter(([_, cell]) => cell.state !== 'dead')
                        .map(([cellPlayerAddress, cell]) => {
                            const isCurrentPlayer = cellPlayerAddress === playerAddress;
                            const isBot = cellPlayerAddress.startsWith('Bot_');

                            let fillColor = "#FF6B6B"; // Default red for other players
                            if (isBot) {
                                fillColor = "#9B59B6"; // Purple for bots
                            } else if (isCurrentPlayer) {
                                fillColor = "#4ECDC4"; // Cyan for current player
                            }

                            return (
                                <circle
                                    key={cellPlayerAddress}
                                    cx={cell.x * scale}
                                    cy={cell.y * scale}
                                    r={Math.max(2, cell.size * scale)}
                                    fill={fillColor}
                                    stroke="#FFFFFF"
                                    strokeWidth="1"
                                />
                            );
                        })}
                </svg>
            </Box>
        );
    }, [gameState, playerAddress]);

    // Render game
    useEffect(() => {
        renderGame();
    }, [renderGame]);

    if (isLoading) {
        return (
            <Box textAlign="center" py={8}>
                <Spinner size="xl" color="blue.400" />
                <Text mt={4}>Loading CryptoBubbles game...</Text>
            </Box>
        );
    }

    return (
        <Box bg={bgColor} border="1px solid" borderColor={borderColor} borderRadius="xl" p={6}>
            <VStack spacing={4} align="stretch">
                {/* Game Header */}
                <HStack justify="space-between">
                    <Text fontSize="lg" fontWeight="bold">CryptoBubbles</Text>
                    <HStack spacing={2}>
                        <Badge colorScheme={gameStarted ? 'green' : 'yellow'}>
                            {gameStarted ? 'Playing' : 'Waiting'}
                        </Badge>
                        {gameEnded && (
                            <Badge colorScheme="red">Game Over</Badge>
                        )}
                        <Button
                            size="md"
                            colorScheme="red"
                            variant="solid"
                            onClick={() => window.history.back()}
                            leftIcon={<RotateCcw size={16} />}
                        >
                            Exit Game
                        </Button>
                    </HStack>
                </HStack>

                {/* Game Instructions */}
                <Box bg="gray.700" p={4} borderRadius="md">
                    <VStack spacing={2} align="start">
                        <HStack>
                            <Target size={16} />
                            <Text fontSize="sm">Mouse Guide: Move your cursor to control your cell</Text>
                        </HStack>
                        <HStack>
                            <MapPin size={16} />
                            <Text fontSize="sm">Exploration: Discover the expanding world</Text>
                        </HStack>
                        <HStack>
                            <Globe size={16} />
                            <Text fontSize="sm">Massive World: Navigate through a huge arena</Text>
                        </HStack>
                        <HStack>
                            <Zap size={16} />
                            <Text fontSize="sm">Dynamic World: Map expands as you explore edges</Text>
                        </HStack>
                    </VStack>
                </Box>

                {/* Game Canvas */}
                <Box position="relative" bg="black" borderRadius="md" overflow="hidden">
                    <canvas
                        ref={canvasRef}
                        width={800}
                        height={600}
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                        style={{ cursor: 'crosshair' }}
                    />
                    {renderMiniMap()}
                </Box>

                {/* Game Info */}
                {gameState && (
                    <Box bg="gray.700" p={4} borderRadius="md">
                        <VStack spacing={2} align="start">
                            <Text fontSize="sm">
                                Arena Size: {gameState.arena_size[0]} x {gameState.arena_size[1]}
                            </Text>
                            <Text fontSize="sm">
                                Pellets: {gameState.pellets.length}
                            </Text>
                            <Text fontSize="sm">
                                Players: {gameState.players.length}
                            </Text>
                            {gameState.winner && (
                                <Text fontSize="sm" color="green.400">
                                    Winner: {gameState.winner.length > 20 ?
                                        `${gameState.winner.slice(0, 10)}...${gameState.winner.slice(-10)}` :
                                        gameState.winner}
                                </Text>
                            )}
                        </VStack>
                    </Box>
                )}
            </VStack>
        </Box>
    );
};