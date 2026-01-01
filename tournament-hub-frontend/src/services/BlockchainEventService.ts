/**
 * Blockchain Event Service
 * 
 * This service polls the backend notifier to detect blockchain events
 * and dispatches corresponding events to the frontend.
 */

import { getRecentNotifierEvents } from '../helpers';

interface BlockchainEvent {
    identifier: string;
    tournament_id: number;
    ts: number;
    game_id?: number;
    player?: string;
}

interface EventSubscription {
    id: string;
    eventType: string;
    callback: (data: any) => void;
}

class BlockchainEventService {
    private isRunning = false;
    private pollInterval: NodeJS.Timeout | null = null;
    private subscriptions = new Map<string, EventSubscription>();
    private lastEventTimestamp = 0;
    private pollIntervalMs = 10000; // Poll every 10 seconds to reduce server load
    private broadcastChannel: BroadcastChannel | null = null;

    constructor() {
        this.initializeBroadcastChannel();
        this.startPolling();
    }

    /**
     * Initialize BroadcastChannel for cross-tab communication
     */
    private initializeBroadcastChannel() {
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
            this.broadcastChannel = new BroadcastChannel('tournament-hub-events');
            this.broadcastChannel.onmessage = (event) => {
                console.log('Received cross-tab event:', event.data);
                this.handleCrossTabEvent(event.data);
            };
            console.log('BroadcastChannel initialized for cross-tab communication');
        } else {
            console.warn('BroadcastChannel not supported, cross-tab communication disabled');
        }
    }

    /**
     * Handle events received from other tabs
     */
    private handleCrossTabEvent(data: any) {
        if (data.type === 'blockchain_event') {
            console.log('Processing cross-tab blockchain event:', data.event);
            this.processEvent(data.event);
        } else if (data.type === 'timestamp_reset') {
            console.log('Cross-tab timestamp reset received');
            this.lastEventTimestamp = 0;
        }
    }

    /**
     * Start polling for blockchain events
     */
    private startPolling() {
        if (this.isRunning) return;

        this.isRunning = true;
        console.log('Blockchain event service started');

        this.pollInterval = setInterval(async () => {
            await this.pollForEvents();
        }, this.pollIntervalMs);
    }

    /**
     * Stop polling for blockchain events
     */
    private stopPolling() {
        if (!this.isRunning) return;

        this.isRunning = false;
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        console.log('Blockchain event service stopped');
    }

    /**
     * Poll for new blockchain events
     */
    private async pollForEvents() {
        try {
            console.log('Polling for blockchain events...');
            console.log('Current lastEventTimestamp:', this.lastEventTimestamp);
            const events = await getRecentNotifierEvents();
            console.log('Raw notifier response:', events);

            if (events && events.length > 0) {
                console.log(`Received ${events.length} events from notifier:`, events);

                // Log each event identifier for debugging
                events.forEach((event, index) => {
                    console.log(`Event ${index + 1}: identifier="${event.identifier}", tournament_id=${event.tournament_id}, ts=${event.ts}, isNew=${event.ts > this.lastEventTimestamp}`);
                });

                // Filter events that are newer than our last timestamp
                const newEvents = events.filter(event => {
                    const isNew = event.ts > this.lastEventTimestamp;
                    console.log(`Event ts=${event.ts}, lastEventTimestamp=${this.lastEventTimestamp}, isNew=${isNew}`);
                    return isNew;
                });

                if (newEvents.length > 0) {
                    console.log(`Found ${newEvents.length} NEW blockchain events:`, newEvents);

                    // Update last timestamp
                    this.lastEventTimestamp = Math.max(...newEvents.map(e => e.ts));
                    console.log('Updated lastEventTimestamp to:', this.lastEventTimestamp);

                    // Process each new event
                    newEvents.forEach(event => {
                        this.processEvent(event);
                    });
                } else {
                    console.log('No new events since last poll');
                    console.log('All events are older than lastEventTimestamp:', this.lastEventTimestamp);
                    console.log('Event timestamps:', events.map(e => e.ts));
                }
            } else {
                console.log('No events received from notifier');
            }
        } catch (error) {
            console.error('Error polling for blockchain events:', error);
        }
    }

    /**
     * Process a blockchain event and dispatch corresponding frontend events
     */
    private processEvent(event: BlockchainEvent) {
        console.log('Processing blockchain event:', event);

        // Map blockchain event identifiers to frontend event types
        const eventMapping: { [key: string]: string } = {
            // Tournament events (using ABI identifiers)
            'tournamentCreated': 'tournament_created',        // From ABI - primary event
            'playerJoined': 'tournament_joined',             // From ABI
            'tournamentStarted': 'tournament_started',        // From ABI
            'tournamentReadyToStart': 'tournament_ready',     // From ABI
            'resultsSubmitted': 'tournament_completed',       // From ABI
            'prizesDistributed': 'prizes_distributed',        // From ABI
            'gameStarted': 'game_started',                   // From ABI

            // Legacy mappings for compatibility
            'createTournament': 'tournament_created',         // Keep for compatibility
            'tournamentJoined': 'tournament_joined',
            'tournamentCompleted': 'tournament_completed',
            'gameStateUpdated': 'game_state_updated',
            'userStatsUpdated': 'user_stats_updated'
        };

        const frontendEventType = eventMapping[event.identifier] || event.identifier;

        // Dispatch frontend event
        if (typeof window !== 'undefined') {
            const eventDetail = {
                event: frontendEventType,
                blockchainEvent: event,
                timestamp: Date.now(),
                source: 'blockchain_event_service'
            };

            window.dispatchEvent(new CustomEvent(frontendEventType, {
                detail: eventDetail
            }));

            // Broadcast to other tabs
            if (this.broadcastChannel) {
                this.broadcastChannel.postMessage({
                    type: 'blockchain_event',
                    event: event,
                    frontendEventType: frontendEventType,
                    timestamp: Date.now()
                });
                console.log('Broadcasted blockchain event to other tabs');
            }
        }

        // Also dispatch cache invalidation
        try {
            import('../helpers').then(({ invalidateCacheByEvent }) => {
                invalidateCacheByEvent(frontendEventType);
            });
        } catch (error) {
            console.error('Error invalidating cache:', error);
        }

        // Notify subscribers
        this.subscriptions.forEach(subscription => {
            if (subscription.eventType === frontendEventType || subscription.eventType === 'all') {
                try {
                    subscription.callback(event);
                } catch (error) {
                    console.error('Error in event subscription callback:', error);
                }
            }
        });
    }

    /**
     * Subscribe to blockchain events
     */
    subscribe(eventType: string, callback: (data: any) => void): string {
        const id = `${eventType}_${Date.now()}_${Math.random()}`;
        this.subscriptions.set(id, { id, eventType, callback });
        return id;
    }

    /**
     * Unsubscribe from blockchain events
     */
    unsubscribe(id: string) {
        this.subscriptions.delete(id);
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            pollIntervalMs: this.pollIntervalMs,
            lastEventTimestamp: this.lastEventTimestamp,
            subscriptionCount: this.subscriptions.size
        };
    }

    /**
     * Manually trigger event polling (for testing)
     */
    async triggerPolling() {
        console.log('Manually triggering blockchain event polling');
        await this.pollForEvents();
    }

    /**
     * Update polling interval
     */
    setPollInterval(intervalMs: number) {
        this.pollIntervalMs = intervalMs;
        if (this.isRunning) {
            this.stopPolling();
            this.startPolling();
        }
    }

    /**
     * Reset timestamp to process all events (for testing)
     */
    resetTimestamp() {
        console.log('Resetting lastEventTimestamp from', this.lastEventTimestamp, 'to 0');
        this.lastEventTimestamp = 0;
        console.log('Timestamp reset complete. New lastEventTimestamp:', this.lastEventTimestamp);

        // Broadcast timestamp reset to other tabs
        if (this.broadcastChannel) {
            this.broadcastChannel.postMessage({
                type: 'timestamp_reset',
                timestamp: Date.now()
            });
            console.log('Broadcasted timestamp reset to other tabs');
        }
    }

    /**
     * Cleanup resources
     */
    destroy() {
        this.stopPolling();
        if (this.broadcastChannel) {
            this.broadcastChannel.close();
            this.broadcastChannel = null;
        }
    }
}

// Export singleton instance
export const blockchainEventService = new BlockchainEventService();

// Helper function to manually trigger event polling
export const triggerBlockchainEventPolling = () => {
    blockchainEventService.triggerPolling();
};

// Helper function to reset timestamp for testing
export const resetBlockchainEventTimestamp = () => {
    blockchainEventService.resetTimestamp();
};
