import React from 'react';
import { useParams } from 'react-router-dom';
import { TicTacToeGame } from '../components';
import { useGetAccount } from 'lib';
import { Box, Text } from '@chakra-ui/react';

export const GameSession = () => {
    const { sessionId } = useParams<{ sessionId: string }>();
    const { address: playerAddress } = useGetAccount();

    if (!sessionId) {
        return (
            <Box p={8} textAlign="center">
                <Text color="red.400">No session ID provided.</Text>
            </Box>
        );
    }

    return (
        <Box maxW="md" mx="auto" py={10} px={4}>
            <TicTacToeGame sessionId={sessionId} playerAddress={playerAddress || ''} />
        </Box>
    );
};

export default GameSession; 