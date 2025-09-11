import { useState, useEffect, useCallback } from 'react';
import { getActiveTournamentIds, getTournamentDetailsFromContract, getTournamentStatsFromContract, getPrizeStatsFromContract, getTournamentsFromBlockchain, findTournamentsByTesting, getTournamentDetailsFromContractFresh, parseTournamentHex, getRecentNotifierEvents } from '../helpers';

// Helper function for delays
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to get persistent cache (simplified version)
function getPersistentCache() {
    try {
        const cached = localStorage.getItem('tournament_persistent_cache');
        return cached ? JSON.parse(cached) : { data: {}, timestamp: Date.now() };
    } catch (e) {
        return { data: {}, timestamp: Date.now() };
    }
}

export interface TournamentStats {
    totalTournaments: number;
    joiningTournaments: number;      // Status 0
    readyToStartTournaments: number; // Status 1
    activeTournaments: number;       // Status 2 (Playing)
    totalActiveTournaments: number;  // Status 0+1+2 (Joining+Ready+Playing) - matches Tournaments page
    completedTournaments: number;    // Status 4
    highestAmountWon: number;        // Highest prize won
    totalAmountPlayed: number;       // Total EGLD used for playing
    maxPrizeWon: number;             // Max prize won from smart contract
    totalPrizeDistributed: number;   // Total prize distributed from smart contract
    loading: boolean;
    error: string | null;
}

export const useTournamentStats = (): TournamentStats => {
    const [stats, setStats] = useState<TournamentStats>({
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
    });

    // Use the same loadBasicTournamentData function as the tournaments page
    const loadBasicTournamentData = useCallback(async (id: bigint) => {
        const maxRetries = 3;
        let lastError: any = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`loadBasicTournamentData: Fetching details for tournament ${id} (attempt ${attempt}/${maxRetries})...`);

                // Add extra delay for completed tournaments to avoid rate limiting
                if (attempt > 1) {
                    const delay = attempt * 2000; // 2s, 4s, 6s
                    console.log(`loadBasicTournamentData: Waiting ${delay}ms before retry for tournament ${id}...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }

                // Use getTournament endpoint
                console.log(`loadBasicTournamentData: Fetching tournament ${id} using getTournament...`);
                const details: any | null = await getTournamentDetailsFromContractFresh(id);
                console.log(`loadBasicTournamentData: Details for tournament ${id}:`, details);

                if (details) {
                    const participantsCount = (details.participants || []).length;
                    const basicData = {
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

                    console.log(`loadBasicTournamentData: Created basic data for tournament ${id}:`, basicData);
                    return basicData;
                } else {
                    console.log(`loadBasicTournamentData: No details returned for tournament ${id}, creating fallback data`);

                    // Try to get just the status from the contract before creating fallback data
                    let actualStatus = 0; // Default to Joining status
                    try {
                        // Try to get tournament status from events or other means
                        const isCompleted = await import('../helpers').then(helpers =>
                            helpers.isTournamentCompletedByEvents(id)
                        );
                        if (isCompleted) {
                            actualStatus = 4; // Completed
                        }
                    } catch (statusError) {
                        console.log(`loadBasicTournamentData: Could not get status for tournament ${id}, using default:`, statusError);
                    }

                    // Create fallback data for tournaments that fail to load details
                    const fallbackData = {
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
                        isFallback: true // Mark as fallback data
                    };

                    console.log(`loadBasicTournamentData: Created fallback data for tournament ${id}:`, fallbackData);
                    return fallbackData;
                }
            } catch (err) {
                lastError = err;
                console.error(`loadBasicTournamentData: Error loading tournament ${id} (attempt ${attempt}):`, err);

                // If this is not the last attempt, wait before retrying
                if (attempt < maxRetries) {
                    const delay = attempt * 2000; // Exponential backoff: 2s, 4s, 6s
                    console.log(`loadBasicTournamentData: Retrying tournament ${id} in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        // If all retries failed, create fallback data instead of returning null
        console.error(`loadBasicTournamentData: Failed to fetch tournament ${id} after ${maxRetries} attempts, creating fallback data:`, lastError);

        // Try to get just the status from the contract before creating fallback data
        let actualStatus = 0; // Default to Joining status
        try {
            // Try to get tournament status from events or other means
            const isCompleted = await import('../helpers').then(helpers =>
                helpers.isTournamentCompletedByEvents(id)
            );
            if (isCompleted) {
                actualStatus = 4; // Completed
            }
        } catch (statusError) {
            console.log(`loadBasicTournamentData: Could not get status for tournament ${id} after retry failure, using default:`, statusError);
        }

        const fallbackData = {
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
            isFallback: true // Mark as fallback data
        };

        console.log(`loadBasicTournamentData: Created fallback data for tournament ${id} after retry failure:`, fallbackData);
        return fallbackData;
    }, []);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setStats(prev => ({ ...prev, loading: true, error: null }));

                // Add a small delay to prevent rapid API calls
                await new Promise(resolve => setTimeout(resolve, 150));

                // Use the exact same tournament discovery logic as the Tournaments page
                let tournamentIds = await getActiveTournamentIds();
                console.log('=== TOURNAMENT DISCOVERY DEBUG ===');
                console.log('Active tournament IDs for stats:', tournamentIds);

                // Only try event-based discovery if no active tournaments found (same as tournaments page)
                let eventTournaments: any[] = [];
                if (!tournamentIds || tournamentIds.length === 0) {
                    console.log('No active tournaments found, trying event-based discovery...');
                    eventTournaments = await getTournamentsFromBlockchain();
                    console.log('Event tournaments found:', eventTournaments);

                    tournamentIds = (eventTournaments || [])
                        .filter((t): t is NonNullable<typeof t> => t !== null)
                        .map(t => BigInt(t.id || 0))
                        .filter(id => id > 0n)
                        .slice(0, 200);
                    console.log('Tournament IDs from events:', tournamentIds);
                }

                // If still no tournaments, try testing individual IDs
                if (!tournamentIds || tournamentIds.length === 0) {
                    console.log('No tournaments from active or events, trying individual ID testing...');
                    tournamentIds = await findTournamentsByTesting();
                    console.log('Testing found tournament IDs:', tournamentIds);
                }

                // Also try notifier events discovery (like tournaments page polling)
                try {
                    console.log('Trying notifier events discovery...');
                    const notifierEvents = await getRecentNotifierEvents();
                    if (notifierEvents && notifierEvents.length > 0) {
                        const eventIds = notifierEvents
                            .filter(e => e.identifier === 'tournamentCreated')
                            .map(e => BigInt(e.tournament_id))
                            .filter(id => id > 0n);

                        if (eventIds.length > 0) {
                            console.log(`Found ${eventIds.length} tournaments from notifier events:`, eventIds);
                            // Add event IDs to existing tournament IDs (avoid duplicates)
                            const existingIds = new Set(tournamentIds || []);
                            const newIds = eventIds.filter(id => !existingIds.has(id));
                            tournamentIds = [...(tournamentIds || []), ...newIds];
                            console.log('Combined tournament IDs (including notifier events):', tournamentIds);
                        }
                    } else {
                        console.log('No notifier events found');
                    }
                } catch (error) {
                    console.log('Notifier events discovery failed:', error);
                }

                console.log('=== END TOURNAMENT DISCOVERY DEBUG ===');

                if (!tournamentIds || tournamentIds.length === 0) {
                    setStats({
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
                        loading: false,
                        error: null,
                    });
                    return;
                }

                // Fetch details for all tournaments to get accurate counts using the same method as tournaments page
                console.log('Fetching details for tournaments:', tournamentIds.map(id => Number(id)));
                const tournamentPromises = tournamentIds.map(async (id) => {
                    try {
                        const details = await loadBasicTournamentData(id);
                        console.log(`Tournament ${id} details:`, details ? 'SUCCESS' : 'NULL');
                        return details;
                    } catch (error) {
                        console.log(`Tournament ${id} failed to load:`, error);
                        return null;
                    }
                });

                const tournaments = await Promise.all(tournamentPromises);
                const validTournaments = tournaments.filter((t): t is NonNullable<typeof t> => t !== null);

                // Filter out fallback tournaments for active tournaments (same as tournaments page)
                // But include fallback tournaments for completed tournaments (same as tournaments page)
                const realTournaments = validTournaments.filter(t => !t.isFallback);
                const fallbackTournaments = validTournaments.filter(t => t.isFallback);
                const completedFallbackTournaments = fallbackTournaments.filter(t => t.status === 4);

                console.log(`Successfully loaded ${validTournaments.length} tournaments (${realTournaments.length} real, ${fallbackTournaments.length} fallback)`);
                console.log(`Completed fallback tournaments: ${completedFallbackTournaments.length}`);

                // Use real tournaments + completed fallback tournaments for statistics (same as tournaments page logic)
                const tournamentsForStats = [...realTournaments, ...completedFallbackTournaments];

                console.log('=== TOURNAMENT STATISTICS DEBUG ===');
                console.log('Total tournament IDs found:', tournamentIds.length);
                console.log('Valid tournaments loaded:', validTournaments.length);
                console.log('Real tournaments for stats:', realTournaments.length);
                console.log('Completed fallback tournaments:', completedFallbackTournaments.length);
                console.log('Total tournaments for stats:', tournamentsForStats.length);
                console.log('Tournament details:', tournamentsForStats.map(t => ({
                    id: t.id,
                    status: t.status,
                    name: t.name || 'Unknown',
                    participants: t.participants?.length || 0,
                    isFallback: t.isFallback
                })));

                // Count tournaments by status for accurate statistics
                let joiningCount = 0;
                let readyToStartCount = 0;
                let activeCount = 0;
                let completedCount = 0;
                let totalActiveCount = 0; // Total of joining + ready to start + playing
                let highestAmountWon = 0;
                let totalAmountPlayed = 0;

                tournamentsForStats.forEach(tournament => {
                    if (tournament) {
                        console.log(`Processing tournament ${tournament.id}: status=${tournament.status}, name=${tournament.name || 'Unknown'}`);

                        // Calculate financial stats
                        const entryFee = parseFloat(String(tournament.entry_fee || '0'));
                        const maxPlayers = parseInt(String(tournament.max_players || '0'));
                        const prizePool = entryFee * maxPlayers;

                        totalAmountPlayed += prizePool;

                        // For completed tournaments, check if this is the highest prize pool
                        if (tournament.status === 4 && prizePool > highestAmountWon) {
                            highestAmountWon = prizePool;
                        }

                        // Status mapping: 0=Joining, 1=ReadyToStart, 2=Active, 3=ProcessingResults, 4=Completed
                        switch (tournament.status) {
                            case 0: // Joining
                                joiningCount++;
                                totalActiveCount++;
                                console.log(`  -> Added to joining count (${joiningCount}) and total active (${totalActiveCount})`);
                                break;
                            case 1: // Ready to Start
                                readyToStartCount++;
                                totalActiveCount++;
                                console.log(`  -> Added to ready to start count (${readyToStartCount}) and total active (${totalActiveCount})`);
                                break;
                            case 2: // Active/Playing
                                activeCount++;
                                totalActiveCount++;
                                console.log(`  -> Added to active count (${activeCount}) and total active (${totalActiveCount})`);
                                break;
                            case 4: // Completed
                                completedCount++;
                                console.log(`  -> Added to completed count (${completedCount})`);
                                break;
                            case 3: // ProcessingResults
                                console.log(`  -> Skipped processing results tournament`);
                                // Exclude from all counts
                                break;
                            default:
                                console.log(`  -> Unknown status ${tournament.status}, skipping`);
                                break;
                        }
                    }
                });

                console.log('Final counts:', {
                    joining: joiningCount,
                    readyToStart: readyToStartCount,
                    active: activeCount,
                    totalActive: totalActiveCount,
                    completed: completedCount
                });

                // Additional debugging for completed tournaments
                const completedTournaments = tournamentsForStats.filter(t => t.status === 4);
                console.log('Completed tournaments breakdown:', completedTournaments.map(t => ({
                    id: t.id,
                    name: t.name,
                    status: t.status,
                    isFallback: t.isFallback
                })));

                console.log('=== END TOURNAMENT STATISTICS DEBUG ===');

                // Get prize stats from contract
                let prizeStats = await getPrizeStatsFromContract();
                console.log('Prize stats:', prizeStats);

                // If prize stats failed due to rate limiting, try again after a delay
                if (!prizeStats) {
                    await sleep(1000); // Wait 1 second
                    prizeStats = await getPrizeStatsFromContract();
                }

                const finalStats = {
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
                    loading: false,
                    error: null,
                };
                setStats(finalStats);

            } catch (error) {
                console.error('Error fetching tournament stats:', error);
                setStats(prev => ({
                    ...prev,
                    loading: false,
                    error: null, // Don't show error to user, just show zeros
                }));
            }
        };

        // Debounce the fetch to prevent rapid calls
        const timeoutId = setTimeout(fetchStats, 300);
        return () => clearTimeout(timeoutId);
    }, []);

    // Add periodic refresh to pick up any new tournaments (same as tournaments page polling)
    useEffect(() => {
        const refreshInterval = setInterval(() => {
            console.log('Refreshing tournament statistics...');
            const fetchStats = async () => {
                try {
                    setStats(prev => ({ ...prev, loading: false, error: null })); // Don't show loading on refresh

                    // Use the same tournament discovery logic
                    let tournamentIds = await getActiveTournamentIds();

                    // Only try event-based discovery if no active tournaments found (same as tournaments page)
                    let eventTournaments: any[] = [];
                    if (!tournamentIds || tournamentIds.length === 0) {
                        eventTournaments = await getTournamentsFromBlockchain();
                        tournamentIds = (eventTournaments || [])
                            .filter((t): t is NonNullable<typeof t> => t !== null)
                            .map(t => BigInt(t.id || 0))
                            .filter(id => id > 0n)
                            .slice(0, 200);
                    }

                    // If still no tournaments, try testing individual IDs
                    if (!tournamentIds || tournamentIds.length === 0) {
                        tournamentIds = await findTournamentsByTesting();
                    }

                    // Also try notifier events discovery (like tournaments page polling)
                    try {
                        const notifierEvents = await getRecentNotifierEvents();
                        if (notifierEvents && notifierEvents.length > 0) {
                            const eventIds = notifierEvents
                                .filter(e => e.identifier === 'tournamentCreated')
                                .map(e => BigInt(e.tournament_id))
                                .filter(id => id > 0n);

                            if (eventIds.length > 0) {
                                console.log(`Refresh: Found ${eventIds.length} tournaments from notifier events:`, eventIds);
                                // Add event IDs to existing tournament IDs (avoid duplicates)
                                const existingIds = new Set(tournamentIds || []);
                                const newIds = eventIds.filter(id => !existingIds.has(id));
                                tournamentIds = [...(tournamentIds || []), ...newIds];
                            }
                        }
                    } catch (error) {
                        console.log('Refresh: Notifier events discovery failed:', error);
                    }

                    if (!tournamentIds || tournamentIds.length === 0) {
                        return; // Don't update if no tournaments found during refresh
                    }

                    // Fetch details for all tournaments
                    const tournamentPromises = tournamentIds.map(async (id) => {
                        try {
                            const details = await loadBasicTournamentData(id);
                            return details;
                        } catch (error) {
                            return null;
                        }
                    });

                    const tournaments = await Promise.all(tournamentPromises);
                    const validTournaments = tournaments.filter((t): t is NonNullable<typeof t> => t !== null);

                    // Filter out fallback tournaments for active tournaments
                    // But include fallback tournaments for completed tournaments
                    const realTournaments = validTournaments.filter(t => !t.isFallback);
                    const fallbackTournaments = validTournaments.filter(t => t.isFallback);
                    const completedFallbackTournaments = fallbackTournaments.filter(t => t.status === 4);

                    // Use real tournaments + completed fallback tournaments for statistics
                    const tournamentsForStats = [...realTournaments, ...completedFallbackTournaments];

                    // Count tournaments by status
                    let joiningCount = 0;
                    let readyToStartCount = 0;
                    let activeCount = 0;
                    let completedCount = 0;
                    let totalActiveCount = 0;
                    let highestAmountWon = 0;
                    let totalAmountPlayed = 0;

                    tournamentsForStats.forEach(tournament => {
                        if (tournament) {
                            // Calculate financial stats
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
                                    break;
                                case 1: // Ready to Start
                                    readyToStartCount++;
                                    totalActiveCount++;
                                    break;
                                case 2: // Active/Playing
                                    activeCount++;
                                    totalActiveCount++;
                                    break;
                                case 4: // Completed
                                    completedCount++;
                                    break;
                            }
                        }
                    });

                    // Get prize stats from contract (only on refresh if needed)
                    const prizeStats = await getPrizeStatsFromContract();

                    const refreshedStats = {
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
                        loading: false,
                        error: null,
                    };

                    console.log('Refreshed stats:', refreshedStats);
                    setStats(refreshedStats);

                } catch (error) {
                    console.error('Error refreshing tournament stats:', error);
                    // Don't update stats on refresh error
                }
            };

            fetchStats();
        }, 30000); // Refresh every 30 seconds (same as tournaments page polling)

        return () => clearInterval(refreshInterval);
    }, [loadBasicTournamentData]);

    return stats;
};
