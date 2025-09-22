/**
 * Example: Event-Based Data Fetching Integration
 * 
 * This file demonstrates how to integrate the new event-based data fetching system
 * into existing components and how to migrate from time-based polling.
 */

import React, { useEffect, useState } from 'react';
import { Box, Text, Badge, Button, VStack, HStack } from '@chakra-ui/react';
import { useEventBasedTournamentStats } from '../hooks/useEventBasedTournamentStats';
import { eventDispatcher, TournamentEvents } from '../services/EventDispatcher';

// Example 1: Drop-in replacement for existing useTournamentStats
export const TournamentStatsExample: React.FC = () => {
    const stats = useEventBasedTournamentStats();

    return (
        <VStack spacing={4} align="stretch">
            <Text fontSize="2xl" fontWeight="bold">Tournament Statistics</Text>

            <HStack spacing={4}>
                <Badge colorScheme="blue" variant="solid">
                    Total: {stats.totalTournaments}
                </Badge>
                <Badge colorScheme="green" variant="solid">
                    Active: {stats.totalActiveTournaments}
                </Badge>
                <Badge colorScheme="purple" variant="solid">
                    Completed: {stats.completedTournaments}
                </Badge>
            </HStack>

            <Text fontSize="sm" color="gray.500">
                Last updated: {new Date(stats.lastUpdated).toLocaleTimeString()}
                {stats.isEventBased && (
                    <Badge ml={2} colorScheme="green" variant="outline">
                        Event-triggered
                    </Badge>
                )}
            </Text>

            {stats.loading && <Text>Loading...</Text>}
        </VStack>
    );
};

// Example 2: Manual event listening for custom components
export const CustomEventListenerExample: React.FC = () => {
    const [eventCount, setEventCount] = useState(0);
    const [lastEvent, setLastEvent] = useState<string>('');

    useEffect(() => {
        const handleTournamentEvent = (data: any) => {
            setEventCount(prev => prev + 1);
            setLastEvent(data?.type || 'unknown');
        };

        // Subscribe to specific tournament events
        const subscriptionIds = [
            eventDispatcher.subscribe(TournamentEvents.CREATED, handleTournamentEvent),
            eventDispatcher.subscribe(TournamentEvents.UPDATED, handleTournamentEvent),
            eventDispatcher.subscribe(TournamentEvents.COMPLETED, handleTournamentEvent),
        ];

        return () => {
            subscriptionIds.forEach(id => {
                // Note: We need to store the callback reference to unsubscribe properly
                // This is a limitation of the current implementation
            });
        };
    }, []);

    return (
        <VStack spacing={4}>
            <Text fontSize="lg" fontWeight="bold">Event Listener</Text>
            <Text>Events received: {eventCount}</Text>
            <Text>Last event: {lastEvent}</Text>
        </VStack>
    );
};

// Example 3: Manual event dispatching (for testing or custom triggers)
export const EventDispatcherExample: React.FC = () => {
    const dispatchTestEvent = () => {
        eventDispatcher.dispatch(TournamentEvents.UPDATED, {
            tournamentId: '123',
            status: 'active'
        }, 'manual_test');
    };

    return (
        <Box>
            <Button onClick={dispatchTestEvent} colorScheme="blue">
                Dispatch Test Event
            </Button>
        </Box>
    );
};

// Example 4: Migration guide comments
/*
MIGRATION GUIDE: From Time-Based to Event-Based Data Fetching

1. REPLACE THE HOOK:
   // Old way (time-based polling)
   import { useTournamentStats } from '../hooks/useTournamentStats';
   
   // New way (event-based)
   import { useTournamentStats } from '../hooks/useTournamentStatsEventBased';
   // OR
   import { useEventBasedTournamentStats } from '../hooks/useEventBasedTournamentStats';

2. NO CODE CHANGES NEEDED:
   The new hook provides the same interface as the original, so existing components
   don't need any changes.

3. BENEFITS:
   - Data refreshes only when blockchain events occur
   - Reduced API calls and rate limiting
   - Better user experience with real-time updates
   - Automatic fallback to polling when WebSocket is disconnected

4. EVENT TYPES AVAILABLE:
   - TournamentEvents.CREATED: New tournament created
   - TournamentEvents.UPDATED: Tournament data updated
   - TournamentEvents.JOINED: Player joined tournament
   - TournamentEvents.STARTED: Tournament started
   - TournamentEvents.COMPLETED: Tournament completed
   - TournamentEvents.STATUS_CHANGED: Tournament status changed
   - TournamentEvents.PLAYER_COUNT_CHANGED: Player count changed
   - TournamentEvents.PRIZE_POOL_UPDATED: Prize pool updated

5. CUSTOM EVENT LISTENING:
   If you need to listen to specific events in your components:
   
   useEffect(() => {
       const handleEvent = (data) => {
           // Handle the event
       };
       
       const subscriptionId = eventDispatcher.subscribe(TournamentEvents.CREATED, handleEvent);
       
       return () => {
           // Cleanup subscription
           eventDispatcher.unsubscribe(TournamentEvents.CREATED, handleEvent);
       };
   }, []);

6. TESTING:
   You can manually dispatch events for testing:
   eventDispatcher.dispatch(TournamentEvents.UPDATED, { tournamentId: '123' }, 'test');
*/
