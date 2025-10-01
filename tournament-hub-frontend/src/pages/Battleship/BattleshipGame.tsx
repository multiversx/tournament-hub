import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useGetAccount } from 'lib';
import { BACKEND_BASE_URL } from '../../config/backend';

interface BattleshipGameState {
    session_id: string;
    phase: 'setup' | 'battle' | 'finished';
    current_turn: string | null;
    winner: string | null;
    game_over: boolean;
    player1: string | null;
    player2: string | null;
    player1_ships_placed: number;
    player2_ships_placed: number;
    required_ships: number;
    my_board: string[][];
    opponent_view: string[][];
    my_ships: Array<{
        type: string;
        positions: number[][];
        hits: boolean[];
        is_sunk: boolean;
    }>;
    move_history: Array<{
        player: string;
        x: number;
        y: number;
        hit: boolean;
        timestamp: number;
        ship_sunk?: string;
    }>;
    game_type: string;
    board_size: number;
    ship_types: string[];
}

interface Ship {
    type: string;
    size: number;
    color: string;
    placed: boolean;
}

const SHIPS: Ship[] = [
    { type: 'carrier', size: 5, color: '#3B82F6', placed: false },
    { type: 'battleship', size: 4, color: '#10B981', placed: false },
    { type: 'cruiser', size: 3, color: '#F59E0B', placed: false },
    { type: 'submarine', size: 3, color: '#8B5CF6', placed: false },
    { type: 'destroyer', size: 2, color: '#EF4444', placed: false },
];

interface BattleshipGameProps {
    sessionId?: string;
}

const BattleshipGame: React.FC<BattleshipGameProps> = ({ sessionId: propSessionId }) => {
    const { sessionId: urlSessionId } = useParams<{ sessionId: string }>();
    const { address } = useGetAccount();

    // Use prop sessionId if provided, otherwise use URL param
    const sessionId = propSessionId || urlSessionId;
    const [gameState, setGameState] = useState<BattleshipGameState | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedShip, setSelectedShip] = useState<Ship | null>(null);
    const [shipOrientation, setShipOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
    const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number } | null>(null);

    // Fetch game state
    const fetchGameState = useCallback(async () => {
        if (!sessionId) return;

        try {
            const url = address
                ? `${BACKEND_BASE_URL}/battleship_game_state?sessionId=${sessionId}&player=${address}`
                : `${BACKEND_BASE_URL}/battleship_game_state?sessionId=${sessionId}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.error) {
                setError(data.error);
                return;
            }

            // Check if current user is in the game
            if (address && data.player1 && data.player2) {
                if (address !== data.player1 && address !== data.player2) {
                    setError('You are not a participant in this game. Please join the tournament first.');
                    setLoading(false);
                    return;
                }
            }

            setGameState(data);
            setError(null);
        } catch (err) {
            setError('Failed to fetch game state');
            console.error('Error fetching game state:', err);
        } finally {
            setLoading(false);
        }
    }, [sessionId, address]);

    // Place ship
    const placeShip = async (shipType: string, x: number, y: number, orientation: 'horizontal' | 'vertical') => {
        if (!sessionId || !address) return;

        // Check if user is in the game
        if (gameState && gameState.player1 && gameState.player2) {
            if (address !== gameState.player1 && address !== gameState.player2) {
                console.log('User not in game, ignoring placement request:', {
                    userAddress: address,
                    player1: gameState.player1,
                    player2: gameState.player2
                });
                setError('You are not a participant in this game');
                setTimeout(() => setError(null), 3000);
                return;
            }
        }

        // Double-check that the ship hasn't been placed already
        if (isShipPlaced(shipType)) {
            console.log('Ship already placed, ignoring placement request:', shipType);
            setError('This ship has already been placed');
            setTimeout(() => setError(null), 3000);
            return;
        }

        console.log('Sending ship placement request:', {
            sessionId,
            player: address,
            shipType,
            x, y, orientation
        });

        try {
            const response = await fetch(`${BACKEND_BASE_URL}/battleship_place_ship`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    player: address,
                    shipType,
                    x,
                    y,
                    orientation,
                }),
            });

            const data = await response.json();

            if (data.error) {
                console.error('Ship placement error from backend:', data.error);
                setError(data.error);
                return;
            }

            console.log('Ship placed successfully, refreshing game state');
            await fetchGameState();
        } catch (err) {
            console.error('Error placing ship:', err);
            setError('Failed to place ship');
        }
    };

    // Fire shot
    const fireShot = async (x: number, y: number) => {
        if (!sessionId || !address) return;

        try {
            const response = await fetch(`${BACKEND_BASE_URL}/battleship_fire`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    player: address,
                    x,
                    y,
                }),
            });

            const data = await response.json();

            if (data.error) {
                setError(data.error);
                return;
            }

            await fetchGameState();
        } catch (err) {
            setError('Failed to fire shot');
            console.error('Error firing shot:', err);
        }
    };

    // Handle cell click
    const handleCellClick = (x: number, y: number, board: 'my' | 'opponent') => {
        if (!gameState || !address) return;

        if (gameState.phase === 'setup' && board === 'my') {
            if (selectedShip && !isShipPlaced(selectedShip.type)) {
                console.log('Attempting to place ship:', {
                    shipType: selectedShip.type,
                    x, y,
                    orientation: shipOrientation,
                    isValid: isValidShipPlacement(x, y, selectedShip, shipOrientation)
                });

                // Validate placement before attempting to place ship
                if (isValidShipPlacement(x, y, selectedShip, shipOrientation)) {
                    placeShip(selectedShip.type, x, y, shipOrientation);
                    setSelectedShip(null);
                } else {
                    // Show error message for invalid placement
                    console.log('Invalid ship placement detected:', {
                        shipType: selectedShip.type,
                        x, y,
                        orientation: shipOrientation,
                        boardSize: gameState.board_size
                    });
                    setError('Invalid ship placement - ship would be out of bounds or overlap with existing ships');
                    setTimeout(() => setError(null), 3000); // Clear error after 3 seconds
                }
            }
        } else if (gameState.phase === 'battle' && board === 'opponent') {
            if (gameState.current_turn === address) {
                fireShot(x, y);
            }
        }
    };

    // Check if ship is placed
    const isShipPlaced = (shipType: string): boolean => {
        if (!gameState) return false;
        return gameState.my_ships.some(ship => ship.type === shipType);
    };

    // Get cell class for styling
    const getCellClass = (x: number, y: number, board: 'my' | 'opponent') => {
        const cell = board === 'my' ? gameState?.my_board[y][x] : gameState?.opponent_view[y][x];
        const baseClass = 'w-8 h-8 border border-gray-300 flex items-center justify-center text-xs font-bold cursor-pointer transition-colors';

        if (board === 'my') {
            if (cell === 'carrier') return `${baseClass} bg-blue-500 text-white`;
            if (cell === 'battleship') return `${baseClass} bg-green-500 text-white`;
            if (cell === 'cruiser') return `${baseClass} bg-yellow-500 text-white`;
            if (cell === 'submarine') return `${baseClass} bg-purple-500 text-white`;
            if (cell === 'destroyer') return `${baseClass} bg-red-500 text-white`;
        } else {
            if (cell === 'hit') return `${baseClass} bg-red-600 text-white`;
            if (cell === 'miss') return `${baseClass} bg-gray-400 text-white`;
        }

        return `${baseClass} bg-white hover:bg-gray-100`;
    };

    // Check if cell is valid for ship placement
    const isValidShipPlacement = (x: number, y: number, ship: Ship, orientation: 'horizontal' | 'vertical'): boolean => {
        if (!gameState) return false;

        // Check if coordinates are within bounds
        if (x < 0 || y < 0 || x >= gameState.board_size || y >= gameState.board_size) {
            console.log('Ship placement invalid: coordinates out of bounds', { x, y, boardSize: gameState.board_size });
            return false;
        }

        const endX = orientation === 'horizontal' ? x + ship.size - 1 : x;
        const endY = orientation === 'vertical' ? y + ship.size - 1 : y;

        // Check bounds - ship must fit entirely within the board
        if (endX >= gameState.board_size || endY >= gameState.board_size) {
            console.log('Ship placement invalid: ship extends beyond board', {
                x, y,
                endX, endY,
                shipSize: ship.size,
                orientation,
                boardSize: gameState.board_size
            });
            return false;
        }

        // Check for overlaps
        for (let i = 0; i < ship.size; i++) {
            const checkX = orientation === 'horizontal' ? x + i : x;
            const checkY = orientation === 'vertical' ? y + i : y;

            if (gameState.my_board[checkY][checkX] !== '') {
                console.log('Ship placement invalid: overlaps with existing ship', {
                    checkX, checkY,
                    existingShip: gameState.my_board[checkY][checkX]
                });
                return false;
            }
        }

        console.log('Ship placement valid', { x, y, shipType: ship.type, orientation });
        return true;
    };

    // Get preview cells for ship placement
    const getPreviewCells = (x: number, y: number, ship: Ship, orientation: 'horizontal' | 'vertical') => {
        const cells: { x: number; y: number }[] = [];
        for (let i = 0; i < ship.size; i++) {
            const cellX = orientation === 'horizontal' ? x + i : x;
            const cellY = orientation === 'vertical' ? y + i : y;
            cells.push({ x: cellX, y: cellY });
        }
        return cells;
    };

    // Render board
    const renderBoard = (board: 'my' | 'opponent', title: string) => {
        if (!gameState) return null;

        const boardData = board === 'my' ? gameState.my_board : gameState.opponent_view;
        const previewCells = hoveredCell && selectedShip && board === 'my'
            ? getPreviewCells(hoveredCell.x, hoveredCell.y, selectedShip, shipOrientation)
            : [];

        return (
            <div className="flex flex-col items-center">
                <h3 className="text-lg font-bold mb-4 text-gray-800">{title}</h3>
                <div className="grid grid-cols-11 gap-0 border-2 border-gray-800">
                    {/* Column headers */}
                    <div></div>
                    {Array.from({ length: gameState.board_size }, (_, i) => (
                        <div key={i} className="w-8 h-8 flex items-center justify-center text-sm font-bold bg-gray-200">
                            {i}
                        </div>
                    ))}

                    {/* Rows */}
                    {boardData.map((row, y) => (
                        <React.Fragment key={y}>
                            {/* Row header */}
                            <div className="w-8 h-8 flex items-center justify-center text-sm font-bold bg-gray-200">
                                {y}
                            </div>

                            {/* Cells */}
                            {row.map((cell, x) => {
                                const isPreview = previewCells.some(c => c.x === x && c.y === y);
                                const isValid = selectedShip && board === 'my' && hoveredCell
                                    ? isValidShipPlacement(hoveredCell.x, hoveredCell.y, selectedShip, shipOrientation)
                                    : true;

                                return (
                                    <div
                                        key={`${x}-${y}`}
                                        className={`${getCellClass(x, y, board)} ${isPreview ? (isValid ? 'bg-green-200 border-green-500' : 'bg-red-200 border-red-500') : ''
                                            }`}
                                        onClick={() => handleCellClick(x, y, board)}
                                        onMouseEnter={() => setHoveredCell({ x, y })}
                                        onMouseLeave={() => setHoveredCell(null)}
                                    >
                                        {cell === 'hit' && '💥'}
                                        {cell === 'miss' && '💧'}
                                    </div>
                                );
                            })}
                        </React.Fragment>
                    ))}
                </div>
            </div>
        );
    };

    // Render ship selection
    const renderShipSelection = () => {
        if (!gameState || gameState.phase !== 'setup') return null;

        return (
            <div className="mb-6">
                <h3 className="text-lg font-bold mb-4 text-gray-800">Place Your Ships</h3>
                <div className="flex flex-wrap gap-4 mb-4">
                    {SHIPS.map((ship) => (
                        <button
                            key={ship.type}
                            className={`px-4 py-2 rounded-lg border-2 transition-colors font-medium ${selectedShip?.type === ship.type
                                ? 'border-blue-500 bg-blue-100 text-blue-800'
                                : isShipPlaced(ship.type)
                                    ? 'border-green-500 bg-green-100 text-green-800 opacity-50 cursor-not-allowed'
                                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                                }`}
                            onClick={() => !isShipPlaced(ship.type) && setSelectedShip(ship)}
                            disabled={isShipPlaced(ship.type)}
                        >
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-4 h-4 rounded"
                                    style={{ backgroundColor: ship.color }}
                                />
                                <span className="capitalize">{ship.type}</span>
                                <span className="text-sm text-gray-600">({ship.size})</span>
                            </div>
                        </button>
                    ))}
                </div>

                <div className="flex gap-4">
                    <button
                        className={`px-4 py-2 rounded-lg border-2 font-medium ${shipOrientation === 'horizontal'
                            ? 'border-blue-500 bg-blue-100 text-blue-800'
                            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                        onClick={() => setShipOrientation('horizontal')}
                    >
                        Horizontal
                    </button>
                    <button
                        className={`px-4 py-2 rounded-lg border-2 font-medium ${shipOrientation === 'vertical'
                            ? 'border-blue-500 bg-blue-100 text-blue-800'
                            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                        onClick={() => setShipOrientation('vertical')}
                    >
                        Vertical
                    </button>
                </div>
            </div>
        );
    };

    // Render game status
    const renderGameStatus = () => {
        if (!gameState) return null;

        if (gameState.game_over) {
            return (
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-green-600 mb-2">
                        {gameState.winner === address ? 'You Won! 🎉' : 'You Lost! 😢'}
                    </h2>
                </div>
            );
        }

        if (gameState.phase === 'setup') {
            return (
                <div className="text-center mb-6">
                    <h2 className="text-xl font-bold mb-2 text-gray-800">Setup Phase</h2>
                    <p className="text-gray-700">
                        Place your ships on the left board. Both players need to place {gameState.required_ships} ships.
                    </p>
                    <p className="text-sm text-gray-600 mt-2">
                        Your ships: {gameState.my_ships.length}/{gameState.required_ships}
                    </p>
                </div>
            );
        }

        if (gameState.phase === 'battle') {
            return (
                <div className="text-center mb-6">
                    <h2 className="text-xl font-bold mb-2 text-gray-800">Battle Phase</h2>
                    <p className="text-gray-700">
                        {gameState.current_turn === address
                            ? 'Your turn - click on the right board to fire!'
                            : 'Waiting for opponent...'
                        }
                    </p>
                </div>
            );
        }

        return null;
    };

    // Auto-refresh game state
    useEffect(() => {
        fetchGameState();
        const interval = setInterval(fetchGameState, 2000); // Poll every 2 seconds
        return () => clearInterval(interval);
    }, [sessionId]); // Only depend on sessionId, not fetchGameState

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p>Loading Battleship game...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <h2 className="text-xl font-bold text-red-600 mb-2">Error</h2>
                    <p className="text-gray-600">{error}</p>
                    <button
                        onClick={fetchGameState}
                        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!gameState) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <h2 className="text-xl font-bold text-red-600 mb-2">Game Not Found</h2>
                    <p className="text-gray-600">The requested Battleship game could not be found.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 py-8">
            <div className="max-w-6xl mx-auto px-4">
                <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">Battleship</h1>

                {renderGameStatus()}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* My Board */}
                    <div>
                        {renderShipSelection()}
                        {renderBoard('my', 'Your Fleet')}
                    </div>

                    {/* Opponent Board */}
                    <div>
                        {renderBoard('opponent', 'Enemy Waters')}
                    </div>
                </div>

                {/* Move History */}
                {gameState.move_history.length > 0 && (
                    <div className="mt-8">
                        <h3 className="text-lg font-bold mb-4 text-gray-800">Recent Moves</h3>
                        <div className="bg-white rounded-lg p-4 max-h-40 overflow-y-auto">
                            {gameState.move_history.slice(-10).reverse().map((move, index) => (
                                <div key={index} className="flex justify-between items-center py-1 text-sm">
                                    <span>
                                        {move.player === address ? 'You' : 'Opponent'} fired at ({move.x}, {move.y})
                                    </span>
                                    <span className={`px-2 py-1 rounded text-xs ${move.hit ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                                        }`}>
                                        {move.hit ? 'HIT' : 'MISS'}
                                        {move.ship_sunk && ` - ${move.ship_sunk} sunk!`}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BattleshipGame;

