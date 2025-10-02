import { useState, useEffect, useCallback } from 'react';
import { getActiveTournamentIds, getTournamentDetailsFromContract } from '../helpers';
import { getPrizeStatsFromContract } from '../helpers';

export interface EnhancedTournamentStats {
    totalTournaments: number;
    joiningTournaments: number;
    readyToStartTournaments: number;
    activeTournaments: number;
    completedTournaments: number;
    maxPrizeWon: number;
    totalPrizeDistributed: number;
    loading: boolean;
    refreshing: boolean;
    error: string | null;
    lastUpdated: Date | null;
    hasCachedData: boolean;
}

interface CachedStats {
    data: EnhancedTournamentStats;
    timestamp: number;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const CACHE_KEY = 'tournament_stats_cache_v3'; // Updated to force cache clear

export function useEnhancedTournamentStats() {
    const [stats, setStats] = useState<EnhancedTournamentStats>({
        totalTournaments: 0,
        joiningTournaments: 0,
        readyToStartTournaments: 0,
        activeTournaments: 0,
        completedTournaments: 0,
        maxPrizeWon: 0,
        totalPrizeDistributed: 0,
        loading: true,
        refreshing: false,
        error: null,
        lastUpdated: null,
        hasCachedData: false,
    });

    const loadCachedData = useCallback(() => {
        // Force clear all old cache versions
        const oldCacheKeys = ['tournament_stats_cache', 'tournament-stats-cache'];
        oldCacheKeys.forEach(key => {
            localStorage.removeItem(key);
        });

        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const { data, timestamp }: CachedStats = JSON.parse(cached);
                const now = Date.now();

                if (now - timestamp < CACHE_DURATION) {
                    console.log('Loading cached tournament stats');
                    setStats(prev => ({
                        ...data,
                        loading: false,
                        refreshing: false,
                        hasCachedData: true,
                        lastUpdated: new Date(timestamp),
                    }));
                    return true;
                }
            }
        } catch (error) {
            console.warn('Failed to load cached stats:', error);
        }
        return false;
    }, []);

    const saveToCache = useCallback((data: EnhancedTournamentStats) => {
        try {
            const cached: CachedStats = {
                data: {
                    ...data,
                    loading: false,
                    refreshing: false,
                    hasCachedData: false,
                },
                timestamp: Date.now(),
            };
            localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
        } catch (error) {
            console.warn('Failed to cache stats:', error);
        }
    }, []);

    const fetchStats = useCallback(async (isRefresh = false) => {
        try {
            console.log('Fetching tournament stats...', { isRefresh });

            setStats(prev => ({
                ...prev,
                loading: !prev.hasCachedData && !isRefresh,
                refreshing: isRefresh,
                error: null,
            }));

            // Get all tournament IDs
            const activeIds = await getActiveTournamentIds();
            console.log('Active tournament IDs:', activeIds);

            if (!activeIds || activeIds.length === 0) {
                const emptyStats = {
                    totalTournaments: 0,
                    joiningTournaments: 0,
                    readyToStartTournaments: 0,
                    activeTournaments: 0,
                    completedTournaments: 0,
                    maxPrizeWon: 0,
                    totalPrizeDistributed: 0,
                    loading: false,
                    refreshing: false,
                    error: null,
                    lastUpdated: new Date(),
                    hasCachedData: false,
                };

                setStats(emptyStats);
                saveToCache(emptyStats);
                return;
            }

            // Fetch details for all tournaments with progress tracking
            const tournamentPromises = activeIds.map(id =>
                getTournamentDetailsFromContract(id).catch(() => null)
            );

            const tournaments = await Promise.all(tournamentPromises);
            const validTournaments = tournaments.filter(t => t !== null);

            // Count tournaments by status
            let joiningCount = 0;
            let readyToStartCount = 0;
            let activeCount = 0;
            let completedCount = 0;

            validTournaments.forEach(tournament => {
                if (!tournament) return;

                console.log('Tournament status:', tournament.status, 'for tournament:', tournament.id);

                switch (tournament.status) {
                    case 0: // Joining
                        joiningCount++;
                        console.log('Found joining tournament:', tournament.id);
                        break;
                    case 1: // Ready to Start
                        readyToStartCount++;
                        console.log('Found ready to start tournament:', tournament.id);
                        break;
                    case 2: // Active/Playing
                        activeCount++;
                        console.log('Found active tournament:', tournament.id);
                        break;
                    case 4: // Completed
                        completedCount++;
                        console.log('Found completed tournament:', tournament.id);
                        break;
                    default:
                        console.log('Unknown status:', tournament.status, 'for tournament:', tournament.id);
                        break;
                }
            });

            console.log('Final counts:', {
                joiningCount,
                readyToStartCount,
                activeCount,
                completedCount
            });

            // Get prize stats
            let prizeStats = null;
            try {
                prizeStats = await getPrizeStatsFromContract();
            } catch (error) {
                console.warn('Failed to fetch prize stats:', error);
            }

            console.log('Raw prize stats from contract:', prizeStats);
            console.log('Max prize won (raw):', prizeStats?.max_prize_won);
            console.log('Total prize distributed (raw):', prizeStats?.total_prize_distributed);

            const newStats = {
                totalTournaments: validTournaments.length,
                joiningTournaments: joiningCount,
                readyToStartTournaments: readyToStartCount,
                activeTournaments: activeCount,
                completedTournaments: completedCount,
                maxPrizeWon: prizeStats?.max_prize_won || 0,
                totalPrizeDistributed: prizeStats?.total_prize_distributed || 0,
                loading: false,
                refreshing: false,
                error: null,
                lastUpdated: new Date(),
                hasCachedData: false,
            };

            console.log('Final stats with prize values:', {
                maxPrizeWon: newStats.maxPrizeWon,
                totalPrizeDistributed: newStats.totalPrizeDistributed
            });

            setStats(newStats);
            saveToCache(newStats);

        } catch (error) {
            console.error('Error fetching tournament stats:', error);
            setStats(prev => ({
                ...prev,
                loading: false,
                refreshing: false,
                error: error instanceof Error ? error.message : 'Failed to fetch stats',
            }));
        }
    }, [saveToCache]);

    const refreshStats = useCallback(() => {
        fetchStats(true);
    }, [fetchStats]);

    useEffect(() => {
        // Try to load cached data first
        const hasCached = loadCachedData();

        // Always fetch fresh data, but don't show loading if we have cached data
        fetchStats(false);
    }, [loadCachedData, fetchStats]);

    return {
        ...stats,
        refreshStats,
    };
}
