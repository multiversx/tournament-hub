import React, { useState, useEffect } from 'react';
import { Container, VStack, Heading, Text, Button } from '@chakra-ui/react';

export const LeaderboardMinimal = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [playerCount, setPlayerCount] = useState(0);

    useEffect(() => {
        console.log('🔍 LeaderboardMinimal mounted');

        // Simulate loading
        const timer = setTimeout(() => {
            console.log('✅ Loading completed');
            setLoading(false);
            setPlayerCount(0); // No players yet
        }, 2000);

        return () => clearTimeout(timer);
    }, []);

    if (loading) {
        return (
            <Container maxW="7xl" py={10}>
                <VStack spacing={8} align="stretch">
                    <Heading>Leaderboard (Loading...)</Heading>
                    <Text>Loading player data...</Text>
                </VStack>
            </Container>
        );
    }

    if (error) {
        return (
            <Container maxW="7xl" py={10}>
                <VStack spacing={8} align="stretch">
                    <Heading color="red.400">Error</Heading>
                    <Text color="red.400">{error}</Text>
                    <Button onClick={() => window.location.reload()}>
                        Retry
                    </Button>
                </VStack>
            </Container>
        );
    }

    return (
        <Container maxW="7xl" py={10}>
            <VStack spacing={8} align="stretch">
                <Heading>Leaderboard</Heading>
                <Text>Total Players: {playerCount}</Text>
                <Text color="gray.400">
                    {playerCount === 0
                        ? "No players have registered yet. Be the first to play!"
                        : `Showing ${playerCount} players`
                    }
                </Text>
            </VStack>
        </Container>
    );
};

