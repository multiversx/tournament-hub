/**
 * Event-based Tournament Stats Hook
 * 
 * This is a drop-in replacement for the original useTournamentStats hook.
 * It provides the same interface but uses event-based refreshing instead of time-based polling.
 */

import { useEventBasedTournamentStats, TournamentStats } from './useEventBasedTournamentStats';

/**
 * Hook that provides tournament statistics with event-based refreshing
 * 
 * This hook automatically refreshes data when:
 * - New tournaments are created
 * - Tournament status changes
 * - Players join/leave tournaments
 * - Tournaments are completed
 * - Any other tournament-related events occur
 * 
 * Falls back to minimal polling (5 minutes) when WebSocket is disconnected.
 * 
 * @returns TournamentStats object with loading, error, and data properties
 */
export const useTournamentStats = (): TournamentStats => {
    return useEventBasedTournamentStats();
};

// Re-export the TournamentStats interface for backward compatibility
export type { TournamentStats };
