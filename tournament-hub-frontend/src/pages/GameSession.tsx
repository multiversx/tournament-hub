import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CryptoBubblesGame } from '../components/CryptoBubblesGame';
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
                // Since we removed TicTacToe from the backend, go directly to CryptoBubbles
                const cryptobubblesResponse = await fetch(`http://localhost:8000/cryptobubbles_game_state?sessionId=${sessionId}`);
                if (cryptobubblesResponse.ok) {
                    setGameType('cryptobubbles');
                    setLoading(false);
                    return;
                }

                // If CryptoBubbles doesn't work, show error
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
            {gameType === 'cryptobubbles' ? (
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