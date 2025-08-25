import React, { useEffect, useRef, useState, useCallback } from 'react';
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
    Divider
} from '@chakra-ui/react';
import { Play, Pause, RotateCcw, Target, MapPin, Globe, Zap, Users, Circle } from 'lucide-react';

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
    const [viewport, setViewport] = useState({ x: 0, y: 0, width: 1200, height: 800 });
    const [mouseOverPlayer, setMouseOverPlayer] = useState(false);
    const [gameStartToastShown, setGameStartToastShown] = useState(false);
    const [gameEndToastShown, setGameEndToastShown] = useState(false);
    const startGameAttemptedRef = useRef(false);
    const joinGameAttemptedRef = useRef(false);

    const toast = useToast();
    const navigate = useNavigate();
    const bgColor = useColorModeValue('gray.800', 'gray.900');
    const borderColor = useColorModeValue('gray.700', 'gray.600');

    // Join the game session
    const joinGame = useCallback(async () => {
        if (joinGameAttemptedRef.current) return;
        joinGameAttemptedRef.current = true;

        try {
            const response = await fetch(`${BACKEND_BASE_URL}/join_cryptobubbles_session?sessionId=${sessionId}&player=${playerAddress}`, {
                method: 'POST',
            });

            if (response.ok) {
                console.log(`Successfully joined game session ${sessionId}`);
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
            const response = await fetch(`${BACKEND_BASE_URL}/start_cryptobubbles_game`, {
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
            const response = await fetch(`${BACKEND_BASE_URL}/cryptobubbles_game_state?sessionId=${sessionId}`);
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

            await fetch(`${BACKEND_BASE_URL}/cryptobubbles_move`, {
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

        // Check if mouse is over the player bubble
        const currentPlayerAddress = playerAddress;
        const currentPlayerCell = gameState.cells[currentPlayerAddress];

        if (currentPlayerCell) {
            const distance = Math.sqrt(
                Math.pow(worldX - currentPlayerCell.x, 2) +
                Math.pow(worldY - currentPlayerCell.y, 2)
            );

            // If mouse is inside or very close to the player bubble, stop movement
            // Use a larger buffer (2 pixels) to prevent edge cases at exact center
            if (distance <= currentPlayerCell.size + 2) {
                setMouseOverPlayer(true);
                // Clear the last cursor position to prevent any residual movement
                setLastCursorPosition(null);
                return;
            } else {
                setMouseOverPlayer(false);
                // Restore cursor position if it was cleared
                if (!lastCursorPosition) {
                    setLastCursorPosition({ x: worldX, y: worldY });
                }
            }
        }

        // Only update cursor position if it's significantly different to reduce jitter
        setLastCursorPosition(prev => {
            if (!prev) {
                return { x: worldX, y: worldY };
            }

            const deltaX = Math.abs(worldX - prev.x);
            const deltaY = Math.abs(worldY - prev.y);

            // Only update if movement is more than 2 pixels to prevent micro-movements
            if (deltaX < 2 && deltaY < 2) {
                return prev;
            }

            return { x: worldX, y: worldY };
        });
    }, [gameState, viewport, playerAddress]);

    // Handle mouse leave
    const handleMouseLeave = useCallback(() => {
        // Don't clear lastCursorPosition to maintain continuous movement
    }, []);

    // Game loop for continuous movement
    useInterval(() => {
        if (lastCursorPosition && gameState && !gameEnded && !mouseOverPlayer) {
            submitMove(lastCursorPosition.x, lastCursorPosition.y);
        }
    }, 50); // Update every 50ms for more responsive movement

    // Update viewport to follow player movement
    useInterval(() => {
        if (gameState && !gameEnded) {
            updateViewport();
        }
    }, 100); // Update viewport every 100ms

    // Polling for game state updates
    useInterval(() => {
        if (!gameEnded) {
            fetchGameState();
        }
    }, 50); // 20 FPS for smoother updates

    // Auto-join and start game when component mounts
    useEffect(() => {
        joinGame();
        startGame();
    }, [joinGame, startGame]);

    // Update viewport to center on player (separate from rendering)
    const updateViewport = useCallback(() => {
        if (!gameState) return;

        const currentPlayerAddress = playerAddress;
        const currentPlayerCell = gameState.cells[currentPlayerAddress];
        if (!currentPlayerCell) return;

        // Calculate target viewport to center on player
        const targetViewportX = Math.max(0, Math.min(currentPlayerCell.x - 1200 / 2, gameState.arena_size[0] - 1200));
        const targetViewportY = Math.max(0, Math.min(currentPlayerCell.y - 800 / 2, gameState.arena_size[1] - 800));

        // Only update viewport if there's a significant difference to reduce jitter
        setViewport(prev => {
            const deltaX = Math.abs(targetViewportX - prev.x);
            const deltaY = Math.abs(targetViewportY - prev.y);

            // Only update if the difference is more than 5 pixels to prevent micro-movements
            if (deltaX < 5 && deltaY < 5) {
                return prev;
            }

            // Use integer coordinates and snap to target more quickly to reduce jitter
            const newX = Math.round(prev.x + (targetViewportX - prev.x) * 0.1);
            const newY = Math.round(prev.y + (targetViewportY - prev.y) * 0.1);

            return {
                x: newX,
                y: newY,
                width: prev.width,
                height: prev.height
            };
        });
    }, [gameState, playerAddress]);

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

        // Draw grid background
        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 1;
        const gridSize = 50;
        const offsetX = viewport.x % gridSize;
        const offsetY = viewport.y % gridSize;

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
            const screenX = pellet.x - viewport.x;
            const screenY = pellet.y - viewport.y;

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

            const screenX = cell.x - viewport.x;
            const screenY = cell.y - viewport.y;

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
                    // Check if mouse is over the current player bubble
                    const mouseOverPlayer = lastCursorPosition && (() => {
                        const distance = Math.sqrt(
                            Math.pow(lastCursorPosition.x - cell.x, 2) +
                            Math.pow(lastCursorPosition.y - cell.y, 2)
                        );
                        return distance <= cell.size;
                    })();

                    if (mouseOverPlayer) {
                        ctx.fillStyle = '#FFD700'; // Gold when mouse is over player
                        ctx.strokeStyle = '#FFA500';
                    } else {
                        ctx.fillStyle = '#4ECDC4'; // Cyan for current player
                        ctx.strokeStyle = '#2ECC71';
                    }
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
            const targetScreenX = lastCursorPosition.x - viewport.x;
            const targetScreenY = lastCursorPosition.y - viewport.y;

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
    }, [gameState, playerAddress, lastCursorPosition, viewport]);

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
                                width={1200 * scale}
                                height={800 * scale}
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
                            onClick={() => navigate('/tournaments')}
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
                        width={1200}
                        height={800}
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                        style={{ cursor: 'crosshair' }}
                    />
                    {renderMiniMap()}

                    {/* Player & Bot Status Overlay */}
                    {gameState && (
                        <Box
                            position="absolute"
                            top={4}
                            left={4}
                            bg="rgba(45, 55, 72, 0.95)"
                            borderRadius="md"
                            border="1px solid"
                            borderColor="gray.600"
                            p={3}
                            maxW="300px"
                            maxH="400px"
                            overflowY="auto"
                            backdropFilter="blur(4px)"
                        >
                            <VStack spacing={2} align="stretch">
                                {/* Players Section */}
                                <HStack justify="space-between" align="center">
                                    <HStack>
                                        <Users size={14} />
                                        <Text fontSize="sm" fontWeight="bold">Players</Text>
                                    </HStack>
                                    <Badge colorScheme="blue" fontSize="xs">
                                        {gameState.players.filter(player => {
                                            const cell = gameState.cells[player];
                                            return cell && cell.state === 'alive';
                                        }).length}/{gameState.players.length}
                                    </Badge>
                                </HStack>

                                {gameState.players.map((player, index) => {
                                    const cell = gameState.cells[player];
                                    const isAlive = cell && cell.state === 'alive';
                                    const isCurrentPlayer = player === playerAddress;

                                    return (
                                        <HStack
                                            key={player}
                                            justify="space-between"
                                            p={1.5}
                                            bg={isCurrentPlayer ? "blue.600" : "gray.600"}
                                            borderRadius="sm"
                                            border={isCurrentPlayer ? "1px solid" : "none"}
                                            borderColor="blue.400"
                                        >
                                            <HStack spacing={2}>
                                                <Circle
                                                    size={8}
                                                    fill={isAlive ? "green.400" : "red.400"}
                                                    color="white"
                                                />
                                                <VStack spacing={0} align="start">
                                                    <Text fontSize="xs" fontWeight="medium">
                                                        {isCurrentPlayer ? "You" : `P${index + 1}`}
                                                    </Text>
                                                    {cell && (
                                                        <Text fontSize="xs" color="gray.400">
                                                            {Math.round(cell.size)}
                                                        </Text>
                                                    )}
                                                </VStack>
                                            </HStack>
                                            {cell && (
                                                <Badge
                                                    colorScheme={isAlive ? "green" : "red"}
                                                    fontSize="xs"
                                                    size="sm"
                                                >
                                                    {isAlive ? "✓" : "✗"}
                                                </Badge>
                                            )}
                                        </HStack>
                                    );
                                })}

                                {/* Bots Section */}
                                <HStack justify="space-between" align="center" mt={2}>
                                    <HStack>
                                        <Zap size={14} />
                                        <Text fontSize="sm" fontWeight="bold">Bots</Text>
                                    </HStack>
                                    <Badge colorScheme="purple" fontSize="xs">
                                        {Object.entries(gameState.cells)
                                            .filter(([key, cell]) => key.startsWith('Bot_') && cell.state === 'alive')
                                            .length}/{Object.entries(gameState.cells)
                                                .filter(([key, cell]) => key.startsWith('Bot_'))
                                                .length}
                                    </Badge>
                                </HStack>

                                {Object.entries(gameState.cells)
                                    .filter(([key, cell]) => key.startsWith('Bot_'))
                                    .map(([botName, cell]) => {
                                        const isAlive = cell.state === 'alive';

                                        return (
                                            <HStack
                                                key={botName}
                                                justify="space-between"
                                                p={1.5}
                                                bg="gray.600"
                                                borderRadius="sm"
                                            >
                                                <HStack spacing={2}>
                                                    <Circle
                                                        size={8}
                                                        fill={isAlive ? "purple.400" : "red.400"}
                                                        color="white"
                                                    />
                                                    <VStack spacing={0} align="start">
                                                        <Text fontSize="xs" fontWeight="medium">
                                                            {botName}
                                                        </Text>
                                                        <Text fontSize="xs" color="gray.400">
                                                            {Math.round(cell.size)}
                                                        </Text>
                                                    </VStack>
                                                </HStack>
                                                <Badge
                                                    colorScheme={isAlive ? "purple" : "red"}
                                                    fontSize="xs"
                                                    size="sm"
                                                >
                                                    {isAlive ? "✓" : "✗"}
                                                </Badge>
                                            </HStack>
                                        );
                                    })}
                            </VStack>
                        </Box>
                    )}
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
                                Players: {gameState.players.length} | Alive: {
                                    gameState.players.filter(player => {
                                        const cell = gameState.cells[player];
                                        return cell && cell.state === 'alive';
                                    }).length
                                }
                            </Text>
                            <Text fontSize="sm">
                                Bots: {
                                    Object.entries(gameState.cells)
                                        .filter(([key, cell]) => key.startsWith('Bot_'))
                                        .length
                                } | Alive: {
                                    Object.entries(gameState.cells)
                                        .filter(([key, cell]) => key.startsWith('Bot_') && cell.state === 'alive')
                                        .length
                                }
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