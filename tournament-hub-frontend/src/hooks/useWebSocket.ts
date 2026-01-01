import { useEffect, useRef, useCallback } from 'react';
import { webSocketService } from '../services/WebSocketService';

interface UseWebSocketOptions {
    onMessage?: (data: any) => void;
    onError?: (error: Error) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
}

export function useWebSocket(
    messageType: string | 'all',
    options: UseWebSocketOptions = {}
) {
    const subscriptionIdRef = useRef<string | null>(null);
    const { onMessage, onError, onConnect, onDisconnect } = options;

    const handleMessage = useCallback((data: any) => {
        if (onMessage) {
            onMessage(data);
        }
    }, [onMessage]);

    useEffect(() => {
        // Subscribe to WebSocket messages
        subscriptionIdRef.current = webSocketService.subscribe(messageType, handleMessage);

        // Set up connection event handlers
        const checkConnection = () => {
            if (webSocketService.isConnected()) {
                onConnect?.();
            } else {
                onDisconnect?.();
            }
        };

        // Check connection status immediately
        checkConnection();

        // Set up periodic connection check
        const connectionCheckInterval = setInterval(checkConnection, 1000);

        return () => {
            // Cleanup
            if (subscriptionIdRef.current) {
                webSocketService.unsubscribe(subscriptionIdRef.current);
            }
            clearInterval(connectionCheckInterval);
        };
    }, [messageType, handleMessage, onConnect, onDisconnect]);

    const sendMessage = useCallback((type: string, data: any) => {
        webSocketService.send(type, data);
    }, []);

    const isConnected = webSocketService.isConnected();

    return {
        isConnected,
        sendMessage,
    };
}

// Specialized hooks for common use cases
export function useTournamentUpdates(callback: (data: any) => void) {
    return useWebSocket('tournament_updated', { onMessage: callback });
}

export function useGameStateUpdates(callback: (data: any) => void) {
    return useWebSocket('game_state_updated', { onMessage: callback });
}

export function useUserStatsUpdates(callback: (data: any) => void) {
    return useWebSocket('user_stats_updated', { onMessage: callback });
}

export function useAllUpdates(callback: (data: any) => void) {
    return useWebSocket('all', { onMessage: callback });
}
