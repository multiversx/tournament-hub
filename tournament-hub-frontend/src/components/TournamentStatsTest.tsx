import React from 'react';
import { Box, Button, VStack, Text, Badge, HStack } from '@chakra-ui/react';
import { useEventBasedTournamentStats } from '../hooks/useEventBasedTournamentStats';

export const TournamentStatsTest: React.FC = () => {
    const stats = useEventBasedTournamentStats();

    const handleManualRefresh = () => {
        if (stats.manualRefresh) {
            stats.manualRefresh();
        }
    };

    const handleTestEvent = () => {
        // Dispatch a test event
        window.dispatchEvent(new CustomEvent('tournament_created', {
            detail: {
                event: 'tournament_created',
                timestamp: Date.now(),
                source: 'test'
            }
        }));
    };

    return (
        <Box p={4} border="1px solid" borderColor="gray.600" borderRadius="lg">
            <VStack spacing={4} align="stretch">
                <Text fontSize="lg" fontWeight="bold">Tournament Stats Test</Text>

                <HStack spacing={4}>
                    <Badge colorScheme="blue">Total: {stats.totalTournaments}</Badge>
                    <Badge colorScheme="green">Active: {stats.totalActiveTournaments}</Badge>
                    <Badge colorScheme="purple">Completed: {stats.completedTournaments}</Badge>
                </HStack>

                <Text fontSize="sm" color="gray.500">
                    Last updated: {new Date(stats.lastUpdated).toLocaleTimeString()}
                    {stats.isEventBased && (
                        <Badge ml={2} colorScheme="green" variant="outline">
                            Event-triggered
                        </Badge>
                    )}
                </Text>

                <HStack spacing={2}>
                    <Button size="sm" onClick={handleManualRefresh}>
                        Manual Refresh
                    </Button>
                    <Button size="sm" onClick={handleTestEvent} colorScheme="purple">
                        Test Event
                    </Button>
                </HStack>

                {stats.loading && <Text color="blue.400">Loading...</Text>}
            </VStack>
        </Box>
    );
};
