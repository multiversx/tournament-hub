import { useState, useEffect } from 'react';
import { useGetAccountInfo } from 'lib';
import { getUserStatsFromContract } from '../helpers';

export interface UserStats {
    gamesPlayed: number;
    wins: number;
    losses: number;
    winRate: number;
    tokensWon: number;
    tokensSpent: number;
    netProfit: number;
    tournamentsCreated: number;
    tournamentsWon: number;
    currentStreak: number;
    bestStreak: number;
    lastLogin: string;
    memberSince: string;
    loading: boolean;
    error: string | null;
}

export const useUserStats = (): UserStats => {
    const { address } = useGetAccountInfo();
    const [stats, setStats] = useState<UserStats>({
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        tokensWon: 0,
        tokensSpent: 0,
        netProfit: 0,
        tournamentsCreated: 0,
        tournamentsWon: 0,
        currentStreak: 0,
        bestStreak: 0,
        lastLogin: '',
        memberSince: '',
        loading: true,
        error: null,
    });

    useEffect(() => {
        const fetchUserStats = async () => {
            if (!address) {
                setStats(prev => ({ ...prev, loading: false }));
                return;
            }

            try {
                setStats(prev => ({ ...prev, loading: true, error: null }));

                // Add a small delay to prevent rapid API calls
                await new Promise(resolve => setTimeout(resolve, 100));

                // Fetch user statistics from smart contract
                const contractStats = await getUserStatsFromContract(address);

                if (contractStats) {
                    // Format timestamps
                    const formatTimestamp = (timestamp: number) => {
                        if (timestamp === 0) return 'Recently';
                        const date = new Date(timestamp * 1000);
                        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                    };

                    const formatLastActivity = (timestamp: number) => {
                        if (timestamp === 0) return 'Recently';
                        const now = Date.now();
                        const diff = now - (timestamp * 1000);
                        const hours = Math.floor(diff / (1000 * 60 * 60));
                        const days = Math.floor(hours / 24);

                        if (days > 0) return `${days}d ago`;
                        if (hours > 0) return `${hours}h ago`;
                        return 'Just now';
                    };

                    setStats({
                        gamesPlayed: contractStats.games_played,
                        wins: contractStats.wins,
                        losses: contractStats.losses,
                        winRate: Math.round(contractStats.win_rate),
                        tokensWon: Math.round(contractStats.tokens_won * 100) / 100,
                        tokensSpent: Math.round(contractStats.tokens_spent * 100) / 100,
                        netProfit: Math.round(contractStats.net_profit * 100) / 100,
                        tournamentsCreated: contractStats.tournaments_created,
                        tournamentsWon: contractStats.tournaments_won,
                        currentStreak: contractStats.current_streak,
                        bestStreak: contractStats.best_streak,
                        lastLogin: formatLastActivity(contractStats.last_activity),
                        memberSince: formatTimestamp(contractStats.member_since),
                        loading: false,
                        error: null,
                    });
                } else {
                    // No stats found, user is new or API unavailable
                    setStats({
                        gamesPlayed: 0,
                        wins: 0,
                        losses: 0,
                        winRate: 0,
                        tokensWon: 0,
                        tokensSpent: 0,
                        netProfit: 0,
                        tournamentsCreated: 0,
                        tournamentsWon: 0,
                        currentStreak: 0,
                        bestStreak: 0,
                        lastLogin: 'Recently',
                        memberSince: 'Recently',
                        loading: false,
                        error: null,
                    });
                }

            } catch (error) {
                console.error('Error fetching user stats:', error);

                // Set fallback data when API fails
                setStats(prev => ({
                    ...prev,
                    gamesPlayed: 0,
                    wins: 0,
                    losses: 0,
                    winRate: 0,
                    tokensWon: 0,
                    tokensSpent: 0,
                    netProfit: 0,
                    tournamentsCreated: 0,
                    tournamentsWon: 0,
                    currentStreak: 0,
                    bestStreak: 0,
                    lastLogin: 'Recently',
                    memberSince: 'Recently',
                    loading: false,
                    error: null, // Don't show error to user, just show zeros
                }));
            }
        };

        // Debounce the fetch to prevent rapid calls
        const timeoutId = setTimeout(fetchUserStats, 200);
        return () => clearTimeout(timeoutId);
    }, [address]);

    return stats;
};
