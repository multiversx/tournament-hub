import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CryptoBubblesGame } from '../components/CryptoBubblesGame';
import { ChessGame } from '../components/ChessGame';
import { TicTacToeGame } from '../components/TicTacToeGame';
import { Box, Text, VStack, Spinner, useToast } from '@chakra-ui/react';
import { useGetAccount } from 'lib';

export const GameSession: React.FC = () => {
    const { address: playerAddress } = useGetAccount();
    const { sessionId } = useParams<{ sessionId: string }>();
    const [gameType, setGameType] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const toast = useToast();

    useEffect(() => {
        const determineGameType = async () => {
            if (!sessionId) return;

            try {
                // Use the general game_state endpoint which automatically detects the game type
                const response = await fetch(`http://localhost:8000/game_state?session_id=${sessionId}`);

                if (response.ok) {
                    const data = await response.json();

                    // Determine game type from response structure
                    if (data.board && typeof data.board === 'object' && data.current_turn && data.white_player) {
                        // Chess game structure
                        setGameType('chess');
                    } else if (data.board && Array.isArray(data.board) && data.board.length === 3) {
                        // Tic Tac Toe game structure (3x3 array)
                        setGameType('tictactoe');
                    } else {
                        // CryptoBubbles or other games
                        setGameType('cryptobubbles');
                    }

                    setLoading(false);
                    return;
                }

                // Fallback: if general endpoint fails, try specific endpoints
                console.log('General game_state failed, trying specific endpoints...');

                // Try chess first
                const chessResponse = await fetch(`http://localhost:8000/chess_game_state?sessionId=${sessionId}`);
                if (chessResponse.ok) {
                    setGameType('chess');
                    setLoading(false);
                    return;
                }

                // Try Tic Tac Toe
                const tictactoeResponse = await fetch(`http://localhost:8000/tictactoe_game_state?sessionId=${sessionId}`);
                if (tictactoeResponse.ok) {
                    setGameType('tictactoe');
                    setLoading(false);
                    return;
                }

                // Try CryptoBubbles
                const cryptobubblesResponse = await fetch(`http://localhost:8000/cryptobubbles_game_state?sessionId=${sessionId}`);
                if (cryptobubblesResponse.ok) {
                    setGameType('cryptobubbles');
                    setLoading(false);
                    return;
                }

                // If none work, show error
                setLoading(false);
                toast({
                    title: 'Error',
                    description: 'Could not determine game type',
                    status: 'error',
                    duration: 5000,
                    isClosable: true,
                });
            } catch (error) {
                console.error('Error determining game type:', error);
                setLoading(false);
                toast({
                    title: 'Error',
                    description: 'Failed to connect to game server',
                    status: 'error',
                    duration: 5000,
                    isClosable: true,
                });
            }
        };

        determineGameType();
    }, [sessionId, toast]);

    if (loading) {
        return (
            <Box textAlign="center" py={8}>
                <Spinner size="xl" color="blue.400" />
                <Text mt={4}>Loading game session...</Text>
            </Box>
        );
    }

    if (!sessionId) {
        return (
            <Box textAlign="center" py={8}>
                <Text>No session ID provided</Text>
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

    return (
        <VStack spacing={6} align="stretch" p={6}>
            {gameType === 'tictactoe' ? (
                <TicTacToeGame sessionId={sessionId} playerAddress={playerAddress} />
            ) : gameType === 'chess' ? (
                <ChessGame sessionId={sessionId} playerAddress={playerAddress} />
            ) : gameType === 'cryptobubbles' ? (
                <CryptoBubblesGame sessionId={sessionId} playerAddress={playerAddress} />
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