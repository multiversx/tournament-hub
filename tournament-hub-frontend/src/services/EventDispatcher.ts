/**
 * Event Dispatcher Service
 * 
 * This service provides a centralized way to dispatch and listen to application events.
 * It works alongside the existing cache invalidation system to provide real-time updates.
 */

interface EventData {
    type: string;
    data?: any;
    timestamp: number;
    source?: string;
}

class EventDispatcher {
    private listeners = new Map<string, Set<(data: any) => void>>();
    private eventHistory: EventData[] = [];
    private maxHistorySize = 100;

    /**
     * Dispatch an event to all registered listeners
     */
    dispatch(type: string, data?: any, source?: string) {
        const event: EventData = {
            type,
            data,
            timestamp: Date.now(),
            source: source || 'unknown'
        };

        // Add to history
        this.eventHistory.push(event);
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory.shift();
        }

        // Notify listeners
        const listeners = this.listeners.get(type);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${type}:`, error);
                }
            });
        }

        // Also dispatch to global window events for backward compatibility
        window.dispatchEvent(new CustomEvent('cacheInvalidated', {
            detail: { event: type, data, source }
        }));

        console.log(`Event dispatched: ${type}`, { data, source });
    }

    /**
     * Subscribe to events of a specific type
     */
    subscribe(type: string, callback: (data: any) => void): string {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, new Set());
        }

        const listenerId = `${type}_${Date.now()}_${Math.random()}`;
        this.listeners.get(type)!.add(callback);

        return listenerId;
    }

    /**
     * Unsubscribe from events
     */
    unsubscribe(type: string, callback: (data: any) => void) {
        const listeners = this.listeners.get(type);
        if (listeners) {
            listeners.delete(callback);
            if (listeners.size === 0) {
                this.listeners.delete(type);
            }
        }
    }

    /**
     * Get recent event history
     */
    getEventHistory(type?: string): EventData[] {
        if (type) {
            return this.eventHistory.filter(event => event.type === type);
        }
        return [...this.eventHistory];
    }

    /**
     * Clear event history
     */
    clearHistory() {
        this.eventHistory = [];
    }

    /**
     * Get all registered event types
     */
    getRegisteredTypes(): string[] {
        return Array.from(this.listeners.keys());
    }

    /**
     * Get listener count for a specific event type
     */
    getListenerCount(type: string): number {
        return this.listeners.get(type)?.size || 0;
    }
}

// Export singleton instance
export const eventDispatcher = new EventDispatcher();

// Tournament-specific event helpers
export const TournamentEvents = {
    CREATED: 'tournament_created',
    UPDATED: 'tournament_updated',
    JOINED: 'tournament_joined',
    STARTED: 'tournament_started',
    COMPLETED: 'tournament_completed',
    STATUS_CHANGED: 'tournament_status_changed',
    PLAYER_COUNT_CHANGED: 'tournament_player_count_changed',
    PRIZE_POOL_UPDATED: 'tournament_prize_pool_updated',
} as const;

export const GameEvents = {
    STATE_UPDATED: 'game_state_updated',
    MOVE_MADE: 'game_move_made',
    GAME_ENDED: 'game_ended',
} as const;

export const UserEvents = {
    STATS_UPDATED: 'user_stats_updated',
    BALANCE_CHANGED: 'user_balance_changed',
    TRANSACTION_COMPLETED: 'user_transaction_completed',
} as const;

// Helper functions for common tournament events
export const dispatchTournamentEvent = (eventType: string, tournamentId: bigint, data?: any) => {
    eventDispatcher.dispatch(eventType, {
        tournamentId: tournamentId.toString(),
        ...data
    }, 'tournament_service');
};

export const dispatchGameEvent = (eventType: string, gameId: string, data?: any) => {
    eventDispatcher.dispatch(eventType, {
        gameId,
        ...data
    }, 'game_service');
};

export const dispatchUserEvent = (eventType: string, userId: string, data?: any) => {
    eventDispatcher.dispatch(eventType, {
        userId,
        ...data
    }, 'user_service');
};
