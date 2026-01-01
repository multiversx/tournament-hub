import React, { useState } from 'react';

// Mock game state for testing the UI
const mockGameState = {
    session_id: 'test-session',
    phase: 'setup' as const,
    current_turn: 'player1',
    winner: null,
    game_over: false,
    player1: 'player1_address',
    player2: 'player2_address',
    player1_ships_placed: 2,
    player2_ships_placed: 0,
    required_ships: 5,
    my_board: Array(10).fill(null).map(() => Array(10).fill('')),
    opponent_view: Array(10).fill(null).map(() => Array(10).fill('')),
    my_ships: [
        {
            type: 'carrier',
            positions: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
            hits: [false, false, false, false, false],
            is_sunk: false
        }
    ],
    move_history: [],
    game_type: 'battleship',
    board_size: 10,
    ship_types: ['carrier', 'battleship', 'cruiser', 'submarine', 'destroyer']
};

const BattleshipTest: React.FC = () => {
    const [gameState, setGameState] = useState(mockGameState);
    const [selectedShip, setSelectedShip] = useState<any>(null);
    const [shipOrientation, setShipOrientation] = useState<'horizontal' | 'vertical'>('horizontal');

    const SHIPS = [
        { type: 'carrier', size: 5, color: '#3B82F6', placed: false },
        { type: 'battleship', size: 4, color: '#10B981', placed: false },
        { type: 'cruiser', size: 3, color: '#F59E0B', placed: false },
        { type: 'submarine', size: 3, color: '#8B5CF6', placed: false },
        { type: 'destroyer', size: 2, color: '#EF4444', placed: false },
    ];

    const getCellClass = (x: number, y: number, board: 'my' | 'opponent') => {
        const cell = board === 'my' ? gameState.my_board[y][x] : gameState.opponent_view[y][x];
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

    const renderBoard = (board: 'my' | 'opponent', title: string) => {
        const boardData = board === 'my' ? gameState.my_board : gameState.opponent_view;

        return (
            <div className="flex flex-col items-center">
                <h3 className="text-lg font-bold mb-4">{title}</h3>
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
                            {row.map((cell, x) => (
                                <div
                                    key={`${x}-${y}`}
                                    className={getCellClass(x, y, board)}
                                    onClick={() => {
                                        if (board === 'my' && selectedShip) {
                                            // Simulate ship placement
                                            const newBoard = [...gameState.my_board];
                                            for (let i = 0; i < selectedShip.size; i++) {
                                                const cellX = shipOrientation === 'horizontal' ? x + i : x;
                                                const cellY = shipOrientation === 'vertical' ? y + i : y;
                                                if (cellX < 10 && cellY < 10) {
                                                    newBoard[cellY][cellX] = selectedShip.type;
                                                }
                                            }
                                            setGameState({
                                                ...gameState,
                                                my_board: newBoard,
                                                player1_ships_placed: gameState.player1_ships_placed + 1
                                            });
                                            setSelectedShip(null);
                                        } else if (board === 'opponent') {
                                            // Simulate shot
                                            const newOpponentView = [...gameState.opponent_view];
                                            newOpponentView[y][x] = Math.random() > 0.5 ? 'hit' : 'miss';
                                            setGameState({
                                                ...gameState,
                                                opponent_view: newOpponentView
                                            });
                                        }
                                    }}
                                >
                                    {cell === 'hit' && '💥'}
                                    {cell === 'miss' && '💧'}
                                </div>
                            ))}
                        </React.Fragment>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-100 py-8">
            <div className="max-w-6xl mx-auto px-4">
                <h1 className="text-3xl font-bold text-center mb-8">Battleship Test</h1>

                <div className="text-center mb-6">
                    <h2 className="text-xl font-bold mb-2">Setup Phase</h2>
                    <p className="text-gray-600">
                        Click on a ship below, then click on the left board to place it.
                    </p>
                </div>

                {/* Ship Selection */}
                <div className="mb-6">
                    <div className="flex flex-wrap gap-4 mb-4 justify-center">
                        {SHIPS.map((ship) => (
                            <button
                                key={ship.type}
                                className={`px-4 py-2 rounded-lg border-2 transition-colors ${selectedShip?.type === ship.type
                                        ? 'border-blue-500 bg-blue-100'
                                        : 'border-gray-300 bg-white hover:bg-gray-50'
                                    }`}
                                onClick={() => setSelectedShip(ship)}
                            >
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-4 h-4 rounded"
                                        style={{ backgroundColor: ship.color }}
                                    />
                                    <span className="capitalize">{ship.type}</span>
                                    <span className="text-sm text-gray-500">({ship.size})</span>
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-4 justify-center">
                        <button
                            className={`px-4 py-2 rounded-lg border-2 ${shipOrientation === 'horizontal'
                                    ? 'border-blue-500 bg-blue-100'
                                    : 'border-gray-300 bg-white'
                                }`}
                            onClick={() => setShipOrientation('horizontal')}
                        >
                            Horizontal
                        </button>
                        <button
                            className={`px-4 py-2 rounded-lg border-2 ${shipOrientation === 'vertical'
                                    ? 'border-blue-500 bg-blue-100'
                                    : 'border-gray-300 bg-white'
                                }`}
                            onClick={() => setShipOrientation('vertical')}
                        >
                            Vertical
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* My Board */}
                    <div>
                        {renderBoard('my', 'Your Fleet')}
                    </div>

                    {/* Opponent Board */}
                    <div>
                        {renderBoard('opponent', 'Enemy Waters')}
                    </div>
                </div>

                <div className="mt-8 text-center">
                    <p className="text-sm text-gray-500">
                        This is a test interface. Click on ships to place them, click on the right board to fire shots.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default BattleshipTest;

