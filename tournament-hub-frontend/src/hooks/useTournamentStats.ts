import { useState, useEffect } from 'react';
import { getActiveTournamentIds, getTournamentDetailsFromContract, getTournamentStatsFromContract, getPrizeStatsFromContract } from '../helpers';

// Helper function for delays
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface TournamentStats {
    totalTournaments: number;
    joiningTournaments: number;      // Status 0
    readyToStartTournaments: number; // Status 1
    activeTournaments: number;       // Status 2
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
        completedTournaments: 0,
        highestAmountWon: 0,
        totalAmountPlayed: 0,
        maxPrizeWon: 0,
        totalPrizeDistributed: 0,
        loading: true,
        error: null,
    });

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setStats(prev => ({ ...prev, loading: true, error: null }));

                // Add a small delay to prevent rapid API calls
                await new Promise(resolve => setTimeout(resolve, 150));

                // Try to get stats from smart contract first
                const contractStats = await getTournamentStatsFromContract();
                console.log('Contract stats:', contractStats);
                let prizeStats = await getPrizeStatsFromContract();
                console.log('Prize stats:', prizeStats);

                // If prize stats failed due to rate limiting, try again after a delay
                if (!prizeStats) {
                    await sleep(1000); // Wait 1 second
                    prizeStats = await getPrizeStatsFromContract();
                }

                if (contractStats) {
                    const finalStats = {
                        totalTournaments: contractStats.total_created,
                        joiningTournaments: contractStats.joining,
                        readyToStartTournaments: contractStats.ready_to_start,
                        activeTournaments: contractStats.active,
                        completedTournaments: contractStats.completed,
                        highestAmountWon: 0, // Contract doesn't provide this yet
                        totalAmountPlayed: 0, // Contract doesn't provide this yet
                        maxPrizeWon: prizeStats?.max_prize_won || 0,
                        totalPrizeDistributed: prizeStats?.total_prize_distributed || 0,
                        loading: false,
                        error: null,
                    };
                    setStats(finalStats);
                    return;
                }

                // Fallback to individual tournament queries (but limit to prevent API overload)
                const tournamentIds = await getActiveTournamentIds();

                if (tournamentIds.length === 0) {
                    setStats({
                        totalTournaments: 0,
                        joiningTournaments: 0,
                        readyToStartTournaments: 0,
                        activeTournaments: 0,
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

                // Limit the number of tournaments we query to prevent API overload
                const limitedIds = tournamentIds.slice(0, 20); // Only query first 20 tournaments

                // Fetch details for limited tournaments
                const tournamentPromises = limitedIds.map(id =>
                    getTournamentDetailsFromContract(id).catch(() => null)
                );

                const tournaments = await Promise.all(tournamentPromises);
                const validTournaments = tournaments.filter(t => t !== null);

                // Count tournaments by status and calculate financial stats
                let joiningCount = 0;
                let readyToStartCount = 0;
                let activeCount = 0;
                let completedCount = 0;
                let highestAmountWon = 0;
                let totalAmountPlayed = 0;

                validTournaments.forEach(tournament => {
                    if (tournament) {
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
                                break;
                            case 1: // Ready to Start
                                readyToStartCount++;
                                break;
                            case 2: // Active/Playing
                                activeCount++;
                                break;
                            case 4: // Completed
                                completedCount++;
                                break;
                            case 3: // ProcessingResults
                                // Exclude from all counts
                                break;
                        }
                    }
                });

                setStats({
                    totalTournaments: validTournaments.length,
                    joiningTournaments: joiningCount,
                    readyToStartTournaments: readyToStartCount,
                    activeTournaments: activeCount,
                    completedTournaments: completedCount,
                    highestAmountWon,
                    totalAmountPlayed,
                    maxPrizeWon: prizeStats?.max_prize_won || 0,
                    totalPrizeDistributed: prizeStats?.total_prize_distributed || 0,
                    loading: false,
                    error: null,
                });

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

    return stats;
};
