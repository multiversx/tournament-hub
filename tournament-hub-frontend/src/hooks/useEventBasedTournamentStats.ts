import { useState, useEffect, useCallback, useRef } from 'react';
import { webSocketService } from '../services/WebSocketService';
import { blockchainEventService } from '../services/BlockchainEventService';
import {
    getActiveTournamentIds,
    getTournamentDetailsFromContractFresh,
    getPrizeStatsFromContract,
    getTournamentsFromBlockchain,
    findTournamentsByTesting,
    getRecentNotifierEvents,
    invalidateCacheByEvent
} from '../helpers';

// Helper function for delays
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface TournamentStats {
    totalTournaments: number;
    joiningTournaments: number;      // Status 0
    readyToStartTournaments: number; // Status 1
    activeTournaments: number;       // Status 2 (Playing)
    totalActiveTournaments: number;  // Status 0+1+2 (Joining+Ready+Playing)
    completedTournaments: number;    // Status 4
    highestAmountWon: number;        // Highest prize won
    totalAmountPlayed: number;       // Total EGLD used for playing
    maxPrizeWon: number;             // Max prize won from smart contract
    totalPrizeDistributed: number;   // Total prize distributed from smart contract
    loading: boolean;
    error: string | null;
    lastUpdated: number;              // Timestamp of last update
    isEventBased: boolean;            // Whether this update was triggered by an event
    manualRefresh?: () => void;       // Manual refresh function for testing
}

interface TournamentData {
    id: bigint;
    name: string;
    description: string;
    game_id: number;
    status: number;
    participants: any[];
    creator: string;
    max_players: number;
    min_players: number;
    entry_fee: string;
    created_at: number;
    current_players: number;
    prize_pool: string;
    isFallback: boolean;
    loadingDetails: boolean;
}

const initialStats: TournamentStats = {
    totalTournaments: 0,
    joiningTournaments: 0,
    readyToStartTournaments: 0,
    activeTournaments: 0,
    totalActiveTournaments: 0,
    completedTournaments: 0,
    highestAmountWon: 0,
    totalAmountPlayed: 0,
    maxPrizeWon: 0,
    totalPrizeDistributed: 0,
    loading: true,
    error: null,
    lastUpdated: 0,
    isEventBased: false,
};

export const useEventBasedTournamentStats = (): TournamentStats => {
    const [stats, setStats] = useState<TournamentStats>(initialStats);
    const [isConnected, setIsConnected] = useState(false);
    const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const fallbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const isRefreshingRef = useRef(false);

    // Load basic tournament data (same logic as original)
    const loadBasicTournamentData = useCallback(async (id: bigint): Promise<TournamentData | null> => {
        const maxRetries = 2; // Reduced retries
        let lastError: any = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                if (attempt > 1) {
                    const delay = attempt * 1000; // Reduced delay
                    await sleep(delay);
                }

                const details: any | null = await getTournamentDetailsFromContractFresh(id);

                if (details) {
                    const participantsCount = (details.participants || []).length;
                    return {
                        id: id,
                        name: details.name || `Tournament ${id}`,
                        description: details.name || `Tournament ${id}`,
                        game_id: details.game_id || 1,
                        status: details.status || 0,
                        participants: details.participants || [],
                        creator: details.creator || '',
                        max_players: details.max_players || 2,
                        min_players: details.min_players || 2,
                        entry_fee: details.entry_fee || '0',
                        created_at: details.created_at || Date.now(),
                        current_players: participantsCount,
                        prize_pool: details.prize_pool || '0',
                        isFallback: false,
                        loadingDetails: false
                    };
                } else {
                    // Create fallback data
                    let actualStatus = 0;
                    try {
                        const isCompleted = await import('../helpers').then(helpers =>
                            helpers.isTournamentCompletedByEvents(id)
                        );
                        if (isCompleted) {
                            actualStatus = 4;
                        }
                    } catch (statusError) {
                        // Ignore status error
                    }

                    return {
                        id: id,
                        name: `Tournament ${id}`,
                        description: `Tournament ${id}`,
                        game_id: 1,
                        status: actualStatus,
                        participants: [],
                        creator: '',
                        max_players: 2,
                        min_players: 2,
                        entry_fee: '0',
                        created_at: Date.now(),
                        current_players: 0,
                        prize_pool: '0',
                        isFallback: true,
                        loadingDetails: false
                    };
                }
            } catch (err) {
                lastError = err;
                console.error(`Error loading tournament ${id} (attempt ${attempt}):`, err);

                if (attempt < maxRetries) {
                    const delay = attempt * 2000;
                    await sleep(delay);
                }
            }
        }

        // Return fallback data if all retries failed
        console.error(`Failed to fetch tournament ${id} after ${maxRetries} attempts, creating fallback data:`, lastError);

        let actualStatus = 0;
        try {
            const isCompleted = await import('../helpers').then(helpers =>
                helpers.isTournamentCompletedByEvents(id)
            );
            if (isCompleted) {
                actualStatus = 4;
            }
        } catch (statusError) {
            // Ignore status error
        }

        return {
            id: id,
            name: `Tournament ${id}`,
            description: `Tournament ${id}`,
            game_id: 1,
            status: actualStatus,
            participants: [],
            creator: '',
            max_players: 2,
            min_players: 2,
            entry_fee: '0',
            created_at: Date.now(),
            current_players: 0,
            prize_pool: '0',
            isFallback: true,
            loadingDetails: false
        };
    }, []);

    // Calculate stats from tournament data
    const calculateStats = useCallback(async (tournaments: TournamentData[]): Promise<Partial<TournamentStats>> => {
        const realTournaments = tournaments.filter(t => !t.isFallback);
        const fallbackTournaments = tournaments.filter(t => t.isFallback);
        const completedFallbackTournaments = fallbackTournaments.filter(t => t.status === 4);
        const tournamentsForStats = [...realTournaments, ...completedFallbackTournaments];

        let joiningCount = 0;
        let readyToStartCount = 0;
        let activeCount = 0;
        let completedCount = 0;
        let totalActiveCount = 0;
        let highestAmountWon = 0;
        let totalAmountPlayed = 0;

        console.log('Stats hook: Calculating stats for', tournamentsForStats.length, 'tournaments');
        tournamentsForStats.forEach((tournament, index) => {
            if (tournament) {
                console.log(`Stats hook: Tournament ${index}:`, {
                    id: tournament.id,
                    name: tournament.name,
                    status: tournament.status,
                    isFallback: tournament.isFallback
                });

                const entryFee = parseFloat(String(tournament.entry_fee || '0'));
                const maxPlayers = parseInt(String(tournament.max_players || '0'));
                const prizePool = entryFee * maxPlayers;

                totalAmountPlayed += prizePool;

                if (tournament.status === 4 && prizePool > highestAmountWon) {
                    highestAmountWon = prizePool;
                }

                switch (tournament.status) {
                    case 0: // Joining
                        joiningCount++;
                        totalActiveCount++;
                        console.log('Stats hook: Found joining tournament:', tournament.id);
                        break;
                    case 1: // Ready to Start
                        readyToStartCount++;
                        totalActiveCount++;
                        console.log('Stats hook: Found ready to start tournament:', tournament.id);
                        break;
                    case 2: // Active/Playing
                        activeCount++;
                        totalActiveCount++;
                        console.log('Stats hook: Found active tournament:', tournament.id);
                        break;
                    case 4: // Completed
                        completedCount++;
                        console.log('Stats hook: Found completed tournament:', tournament.id);
                        break;
                    case 3: // ProcessingResults
                        console.log('Stats hook: Found processing tournament:', tournament.id);
                        break;
                    default:
                        console.log('Stats hook: Unknown status', tournament.status, 'for tournament:', tournament.id);
                        break;
                }
            }
        });

        console.log('Stats hook: Final counts:', {
            joiningCount,
            readyToStartCount,
            activeCount,
            completedCount,
            totalActiveCount
        });

        // Get prize stats from contract (non-blocking, with fallback)
        let prizeStats = null;
        try {
            prizeStats = await getPrizeStatsFromContract();
        } catch (error) {
            console.warn('Stats hook: Error fetching prize stats:', error);
        }

        // If prize stats failed, use fallback values instead of retrying
        if (!prizeStats) {
            console.log('Stats hook: Using fallback prize stats');
            prizeStats = { max_prize_won: 0, total_prize_distributed: 0 };
        }

        return {
            totalTournaments: tournamentsForStats.length,
            joiningTournaments: joiningCount,
            readyToStartTournaments: readyToStartCount,
            activeTournaments: activeCount,
            totalActiveTournaments: totalActiveCount,
            completedTournaments: completedCount,
            highestAmountWon,
            totalAmountPlayed,
            maxPrizeWon: prizeStats?.max_prize_won || 0,
            totalPrizeDistributed: prizeStats?.total_prize_distributed || 0,
        };
    }, []);

    // Main data fetching function
    const fetchStats = useCallback(async (isEventTriggered: boolean = false) => {
        if (isRefreshingRef.current) {
            return; // Prevent concurrent refreshes
        }

        isRefreshingRef.current = true;

        try {
            setStats(prev => ({
                ...prev,
                loading: false, // Never show loading state - keep numbers visible
                error: null
            }));

            // Clear caches more aggressively for event-triggered updates
            if (isEventTriggered) {
                console.log('Event-triggered refresh: clearing caches');
                try {
                    const { clearApiCaches } = await import('../helpers');
                    clearApiCaches();
                } catch (error) {
                    console.error('Error clearing caches:', error);
                }
            }

            // Add small delay to prevent rapid API calls
            if (!isEventTriggered) {
                await sleep(150);
            }

            // Use the same tournament discovery logic as original
            let tournamentIds = await getActiveTournamentIds();
            console.log('Stats hook: Active tournament IDs from contract:', tournamentIds);

            let eventTournaments: any[] = [];
            if (!tournamentIds || tournamentIds.length === 0) {
                console.log('Stats hook: No active tournament IDs, trying blockchain events');
                eventTournaments = await getTournamentsFromBlockchain();
                tournamentIds = (eventTournaments || [])
                    .filter((t): t is NonNullable<typeof t> => t !== null)
                    .map(t => BigInt(t.id || 0))
                    .filter(id => id > 0n)
                    .slice(0, 200);
                console.log('Stats hook: Tournament IDs from blockchain events:', tournamentIds);
            }

            if (!tournamentIds || tournamentIds.length === 0) {
                console.log('Stats hook: No tournament IDs from blockchain events, trying testing method');
                tournamentIds = await findTournamentsByTesting();
                console.log('Stats hook: Tournament IDs from testing method:', tournamentIds);
            }

            // Try notifier events discovery
            try {
                const notifierEvents = await getRecentNotifierEvents();
                if (notifierEvents && notifierEvents.length > 0) {
                    const eventIds = notifierEvents
                        .filter(e => e.identifier === 'tournamentCreated')
                        .map(e => BigInt(e.tournament_id))
                        .filter(id => id > 0n);

                    if (eventIds.length > 0) {
                        const existingIds = new Set(tournamentIds || []);
                        const newIds = eventIds.filter(id => !existingIds.has(id));
                        tournamentIds = [...(tournamentIds || []), ...newIds];
                    }
                }
            } catch (error) {
                // Ignore notifier events error
            }

            if (!tournamentIds || tournamentIds.length === 0) {
                // If no tournaments found, keep previous stats and show error
                setStats(prev => ({
                    ...prev,
                    loading: false,
                    error: 'No tournaments found',
                    lastUpdated: Date.now(),
                    isEventBased: isEventTriggered,
                    // Keep existing numbers visible
                }));
                return;
            }

            // Fetch tournament details in parallel with concurrency limit
            console.log('Stats hook: Fetching details for', tournamentIds.length, 'tournaments');

            // Process tournaments in batches to avoid overwhelming the API
            const batchSize = 5;
            const tournaments = [];

            for (let i = 0; i < tournamentIds.length; i += batchSize) {
                const batch = tournamentIds.slice(i, i + batchSize);
                console.log(`Stats hook: Processing batch ${Math.floor(i / batchSize) + 1}, tournaments ${i + 1}-${Math.min(i + batchSize, tournamentIds.length)}`);

                const batchPromises = batch.map(async (id) => {
                    try {
                        const data = await loadBasicTournamentData(id);
                        console.log('Stats hook: Loaded tournament', id, ':', data);
                        return data;
                    } catch (error) {
                        console.error('Stats hook: Error loading tournament', id, ':', error);
                        return null;
                    }
                });

                const batchResults = await Promise.all(batchPromises);
                tournaments.push(...batchResults);

                // Small delay between batches to avoid rate limiting
                if (i + batchSize < tournamentIds.length) {
                    await sleep(100);
                }
            }
            const validTournaments = tournaments.filter((t): t is NonNullable<typeof t> => t !== null);
            console.log('Stats hook: Valid tournaments:', validTournaments.length, validTournaments);

            // Calculate stats
            const newStats = await calculateStats(validTournaments);
            console.log('Stats hook: Calculated stats:', newStats);

            setStats(prev => ({
                ...prev,
                ...newStats,
                loading: false,
                error: null,
                lastUpdated: Date.now(),
                isEventBased: isEventTriggered,
            }));

        } catch (error) {
            console.error('Error fetching tournament stats:', error);
            setStats(prev => ({
                ...prev,
                loading: false,
                error: 'Failed to load tournament statistics',
                lastUpdated: Date.now(),
                isEventBased: isEventTriggered,
                // Keep existing numbers visible even on error
            }));
        } finally {
            isRefreshingRef.current = false;
        }
    }, [loadBasicTournamentData, calculateStats]);

    // Debounced refresh function
    const debouncedRefresh = useCallback((isEventTriggered: boolean = false) => {
        console.log('Debounced refresh called, isEventTriggered:', isEventTriggered);
        if (refreshTimeoutRef.current) {
            clearTimeout(refreshTimeoutRef.current);
        }

        refreshTimeoutRef.current = setTimeout(() => {
            console.log('Executing debounced refresh, isEventTriggered:', isEventTriggered);
            fetchStats(isEventTriggered);
        }, 300);
    }, [fetchStats]);

    // WebSocket event handlers
    useEffect(() => {
        const handleTournamentEvent = (data: any) => {
            console.log('WebSocket tournament event received:', data);
            debouncedRefresh(true); // Event-triggered refresh
        };

        // Subscribe to all tournament-related events
        const subscriptionIds = [
            webSocketService.subscribe('tournament_created', handleTournamentEvent),
            webSocketService.subscribe('tournament_updated', handleTournamentEvent),
            webSocketService.subscribe('tournament_joined', handleTournamentEvent),
            webSocketService.subscribe('tournament_started', handleTournamentEvent),
            webSocketService.subscribe('tournament_completed', handleTournamentEvent),
            webSocketService.subscribe('game_state_updated', handleTournamentEvent),
            webSocketService.subscribe('user_stats_updated', handleTournamentEvent),
        ];

        // Check WebSocket connection status
        const checkConnection = () => {
            setIsConnected(webSocketService.isConnected());
        };

        checkConnection();
        const connectionInterval = setInterval(checkConnection, 5000);

        return () => {
            subscriptionIds.forEach(id => webSocketService.unsubscribe(id));
            clearInterval(connectionInterval);
        };
    }, [debouncedRefresh]);

    // Blockchain event handlers
    useEffect(() => {
        const handleBlockchainEvent = (data: any) => {
            console.log('Blockchain tournament event received:', data);
            debouncedRefresh(true); // Event-triggered refresh
        };

        // Subscribe to blockchain events
        const blockchainSubscriptionIds = [
            blockchainEventService.subscribe('tournament_created', handleBlockchainEvent),
            blockchainEventService.subscribe('tournament_joined', handleBlockchainEvent),
            blockchainEventService.subscribe('tournament_started', handleBlockchainEvent),
            blockchainEventService.subscribe('tournament_ready', handleBlockchainEvent),
            blockchainEventService.subscribe('tournament_completed', handleBlockchainEvent),
            blockchainEventService.subscribe('prizes_distributed', handleBlockchainEvent),
            blockchainEventService.subscribe('game_started', handleBlockchainEvent),
            blockchainEventService.subscribe('game_state_updated', handleBlockchainEvent),
            blockchainEventService.subscribe('user_stats_updated', handleBlockchainEvent),
        ];

        return () => {
            blockchainSubscriptionIds.forEach(id => blockchainEventService.unsubscribe(id));
        };
    }, [debouncedRefresh]);

    // Cache invalidation event listener
    useEffect(() => {
        const handleCacheInvalidation = (event: CustomEvent) => {
            const eventType = event.detail?.event;
            console.log('Cache invalidation event received:', eventType, event.detail);
            if (eventType && eventType.includes('tournament')) {
                console.log('Triggering refresh due to cache invalidation:', eventType);
                debouncedRefresh(true); // Event-triggered refresh
            }
        };

        const handleTournamentCreated = async (event: CustomEvent) => {
            console.log('Tournament created event received:', event.detail);
            console.log('Triggering refresh due to tournament creation');

            // Also try to get the latest tournament ID from notifier events
            try {
                const notifierEvents = await getRecentNotifierEvents();
                if (notifierEvents && notifierEvents.length > 0) {
                    const latestCreatedEvent = notifierEvents
                        .filter(e => e.identifier === 'tournamentCreated')
                        .sort((a, b) => b.ts - a.ts)[0];

                    if (latestCreatedEvent) {
                        console.log('Latest tournament created event from notifier:', latestCreatedEvent);
                        // Force refresh with a small delay to ensure the tournament is available
                        setTimeout(() => {
                            debouncedRefresh(true);
                        }, 1000);
                        return;
                    }
                }
            } catch (error) {
                console.error('Error checking notifier events:', error);
            }

            debouncedRefresh(true); // Event-triggered refresh
        };

        window.addEventListener('cacheInvalidated', handleCacheInvalidation as EventListener);
        window.addEventListener('tournament_created', handleTournamentCreated as unknown as EventListener);

        return () => {
            window.removeEventListener('cacheInvalidated', handleCacheInvalidation as EventListener);
            window.removeEventListener('tournament_created', handleTournamentCreated as unknown as EventListener);
        };
    }, [debouncedRefresh]);

    // Initial data load
    useEffect(() => {
        fetchStats(false); // Initial load
    }, [fetchStats]);

    // Fallback polling when WebSocket is disconnected
    useEffect(() => {
        if (!isConnected) {
            console.log('WebSocket disconnected, starting fallback polling');
            fallbackIntervalRef.current = setInterval(() => {
                console.log('Fallback polling refresh');
                debouncedRefresh(false); // Fallback refresh
            }, 5 * 60 * 1000); // 5 minutes fallback polling
        } else {
            if (fallbackIntervalRef.current) {
                console.log('WebSocket connected, stopping fallback polling');
                clearInterval(fallbackIntervalRef.current);
                fallbackIntervalRef.current = null;
            }
        }

        return () => {
            if (fallbackIntervalRef.current) {
                clearInterval(fallbackIntervalRef.current);
            }
        };
    }, [isConnected, debouncedRefresh]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current);
            }
            if (fallbackIntervalRef.current) {
                clearInterval(fallbackIntervalRef.current);
            }
        };
    }, []);

    // Manual refresh function for testing and retry
    const manualRefresh = useCallback(() => {
        console.log('Manual refresh triggered');
        // Clear any existing error but keep numbers visible
        setStats(prev => ({
            ...prev,
            loading: false, // Keep numbers visible
            error: null
        }));
        debouncedRefresh(true);
    }, [debouncedRefresh]);

    return { ...stats, manualRefresh };
};
