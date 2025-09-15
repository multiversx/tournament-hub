import { invalidateCacheByEvent } from '../helpers';

interface WebSocketMessage {
    type: string;
    data: any;
    timestamp: number;
}

interface WebSocketSubscription {
    id: string;
    type: string;
    callback: (data: any) => void;
}

class WebSocketService {
    private ws: WebSocket | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 1000; // Start with 1 second
    private subscriptions = new Map<string, WebSocketSubscription>();
    private isConnecting = false;
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private lastHeartbeat = 0;

    constructor() {
        this.connect();
    }

    private connect() {
        if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
            return;
        }

        this.isConnecting = true;

        try {
            // Determine WebSocket URL based on environment
            const wsUrl = this.getWebSocketUrl();

            // If no WebSocket URL, skip connection and use polling
            if (!wsUrl) {
                this.isConnecting = false;
                this.startPollingFallback();
                return;
            }

            console.log('Connecting to WebSocket:', wsUrl);
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.isConnecting = false;
                this.reconnectAttempts = 0;
                this.reconnectDelay = 1000;
                this.startHeartbeat();
            };

            this.ws.onmessage = (event) => {
                try {
                    const message: WebSocketMessage = JSON.parse(event.data);
                    this.handleMessage(message);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            this.ws.onclose = (event) => {
                console.log('WebSocket disconnected:', event.code, event.reason);
                this.isConnecting = false;
                this.stopHeartbeat();

                if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.scheduleReconnect();
                }
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.isConnecting = false;
            };

        } catch (error) {
            console.error('Error creating WebSocket connection:', error);
            this.isConnecting = false;
            this.scheduleReconnect();
        }
    }

    private getWebSocketUrl(): string {
        // For now, disable WebSocket and use polling fallback
        // This prevents connection errors while we implement the WebSocket server
        return '';
    }

    private scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

        console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        setTimeout(() => {
            this.connect();
        }, delay);
    }

    private startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
                this.lastHeartbeat = Date.now();
            }
        }, 30000); // Send ping every 30 seconds
    }

    private stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    private handleMessage(message: WebSocketMessage) {
        console.log('WebSocket message received:', message);

        switch (message.type) {
            case 'pong':
                // Heartbeat response
                break;

            case 'tournament_created':
                this.handleTournamentCreated(message.data);
                break;

            case 'tournament_updated':
                this.handleTournamentUpdated(message.data);
                break;

            case 'tournament_joined':
                this.handleTournamentJoined(message.data);
                break;

            case 'tournament_started':
                this.handleTournamentStarted(message.data);
                break;

            case 'tournament_completed':
                this.handleTournamentCompleted(message.data);
                break;

            case 'game_state_updated':
                this.handleGameStateUpdated(message.data);
                break;

            case 'user_stats_updated':
                this.handleUserStatsUpdated(message.data);
                break;

            default:
                console.log('Unknown WebSocket message type:', message.type);
        }

        // Notify subscribers
        this.subscriptions.forEach(subscription => {
            if (subscription.type === message.type || subscription.type === 'all') {
                subscription.callback(message.data);
            }
        });
    }

    private handleTournamentCreated(data: any) {
        console.log('Tournament created:', data);
        invalidateCacheByEvent('tournament_created');
    }

    private handleTournamentUpdated(data: any) {
        console.log('Tournament updated:', data);
        invalidateCacheByEvent('tournament_updated');
    }

    private handleTournamentJoined(data: any) {
        console.log('Tournament joined:', data);
        invalidateCacheByEvent('tournament_joined');
    }

    private handleTournamentStarted(data: any) {
        console.log('Tournament started:', data);
        invalidateCacheByEvent('tournament_started');
    }

    private handleTournamentCompleted(data: any) {
        console.log('Tournament completed:', data);
        invalidateCacheByEvent('tournament_completed');
    }

    private handleGameStateUpdated(data: any) {
        console.log('Game state updated:', data);
        invalidateCacheByEvent('game_state_updated');
    }

    private handleUserStatsUpdated(data: any) {
        console.log('User stats updated:', data);
        invalidateCacheByEvent('user_stats_updated');
    }

    // Public API
    subscribe(type: string, callback: (data: any) => void): string {
        const id = `${type}_${Date.now()}_${Math.random()}`;
        this.subscriptions.set(id, { id, type, callback });
        return id;
    }

    unsubscribe(id: string) {
        this.subscriptions.delete(id);
    }

    send(type: string, data: any) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, data, timestamp: Date.now() }));
        } else {
            console.warn('WebSocket not connected, cannot send message');
        }
    }

    isConnected(): boolean {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }

    disconnect() {
        this.stopHeartbeat();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.subscriptions.clear();
    }

    // Fallback to polling if WebSocket is not available
    startPollingFallback() {

        // Poll for tournament updates every 5 seconds for faster updates
        setInterval(() => {
            this.pollForUpdates();
        }, 5000);
    }

    private async pollForUpdates() {
        try {
            // Trigger cache invalidation for tournament data
            // This will cause the UI to refetch data
            // Polling for updates silently

            // Import the cache invalidation function
            import('../helpers').then(({ invalidateCacheByEvent }) => {
                // Invalidate tournament-related caches to trigger refetch
                invalidateCacheByEvent('tournament_updated');
                invalidateCacheByEvent('tournament_status_changed');
            }).catch(error => {
                console.error('Error importing cache functions:', error);
            });

        } catch (error) {
            console.error('Error polling for updates:', error);
        }
    }
}

// Export singleton instance
export const webSocketService = new WebSocketService();

// Fallback to polling if WebSocket fails
if (typeof window !== 'undefined') {
    // Start polling fallback after a delay to allow WebSocket to connect first
    setTimeout(() => {
        if (!webSocketService.isConnected()) {
            webSocketService.startPollingFallback();
        }
    }, 5000);
}
