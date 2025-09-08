import { useState, useEffect } from 'react';
import { getActiveTournamentIds, getTournamentDetailsFromContract, getTournamentStatsFromContract } from '../helpers';

export interface TournamentStats {
    totalTournaments: number;
    joiningTournaments: number;      // Status 0
    readyToStartTournaments: number; // Status 1
    activeTournaments: number;       // Status 2
    completedTournaments: number;    // Status 4
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

                if (contractStats) {
                    setStats({
                        totalTournaments: contractStats.total_created,
                        joiningTournaments: contractStats.joining,
                        readyToStartTournaments: contractStats.ready_to_start,
                        activeTournaments: contractStats.active,
                        completedTournaments: contractStats.completed,
                        loading: false,
                        error: null,
                    });
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

                // Count tournaments by status
                let joiningCount = 0;
                let readyToStartCount = 0;
                let activeCount = 0;
                let completedCount = 0;

                validTournaments.forEach(tournament => {
                    if (tournament) {
                        // Status mapping: 0=Joining, 1=ReadyToStart, 2=Active, 3=ProcessingResults, 4=Completed
                        switch (tournament.status) {
                            case 0: // Joining
                                joiningCount++;
                                break;
                            case 1: // ReadyToStart
                                readyToStartCount++;
                                break;
                            case 2: // Active
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
