import { useCallback } from 'react';

export interface GamingNotificationOptions {
    type: 'success' | 'error' | 'warning' | 'info' | 'achievement' | 'level_up' | 'victory' | 'defeat';
    title: string;
    description?: string;
    duration?: number;
    showProgress?: boolean;
    icon?: React.ReactNode;
    sound?: boolean;
    vibration?: boolean;
}

export const useGamingNotifications = () => {
    const showNotification = useCallback((options: GamingNotificationOptions) => {
        if (typeof window !== 'undefined' && (window as any).addGamingNotification) {
            (window as any).addGamingNotification(options);
        } else {
            // Fallback to console if notification system not available
            console.log(`[${options.type.toUpperCase()}] ${options.title}: ${options.description || ''}`);
        }
    }, []);

    const showSuccess = useCallback((title: string, description?: string, options?: Partial<GamingNotificationOptions>) => {
        showNotification({
            type: 'success',
            title,
            description,
            duration: 4000,
            sound: true,
            ...options
        });
    }, [showNotification]);

    const showError = useCallback((title: string, description?: string, options?: Partial<GamingNotificationOptions>) => {
        showNotification({
            type: 'error',
            title,
            description,
            duration: 6000,
            sound: true,
            vibration: true,
            ...options
        });
    }, [showNotification]);

    const showWarning = useCallback((title: string, description?: string, options?: Partial<GamingNotificationOptions>) => {
        showNotification({
            type: 'warning',
            title,
            description,
            duration: 5000,
            ...options
        });
    }, [showNotification]);

    const showInfo = useCallback((title: string, description?: string, options?: Partial<GamingNotificationOptions>) => {
        showNotification({
            type: 'info',
            title,
            description,
            duration: 4000,
            ...options
        });
    }, [showNotification]);

    const showAchievement = useCallback((title: string, description?: string, options?: Partial<GamingNotificationOptions>) => {
        showNotification({
            type: 'achievement',
            title,
            description,
            duration: 5000,
            sound: true,
            vibration: true,
            ...options
        });
    }, [showNotification]);

    const showLevelUp = useCallback((title: string, description?: string, options?: Partial<GamingNotificationOptions>) => {
        showNotification({
            type: 'level_up',
            title,
            description,
            duration: 5000,
            sound: true,
            vibration: true,
            ...options
        });
    }, [showNotification]);

    const showVictory = useCallback((title: string, description?: string, options?: Partial<GamingNotificationOptions>) => {
        showNotification({
            type: 'victory',
            title,
            description,
            duration: 6000,
            sound: true,
            vibration: true,
            ...options
        });
    }, [showNotification]);

    const showDefeat = useCallback((title: string, description?: string, options?: Partial<GamingNotificationOptions>) => {
        showNotification({
            type: 'defeat',
            title,
            description,
            duration: 5000,
            ...options
        });
    }, [showNotification]);

    // Transaction-specific notifications
    const showTransactionSuccess = useCallback((action: string, description?: string) => {
        showSuccess(
            `🎉 ${action} Successful!`,
            description || 'Transaction confirmed on blockchain',
            { duration: 5000 }
        );
    }, [showSuccess]);

    const showTransactionError = useCallback((action: string, description?: string) => {
        showError(
            `❌ ${action} Failed`,
            description || 'Please try again',
            { duration: 7000 }
        );
    }, [showError]);

    const showTransactionPending = useCallback((action: string) => {
        showInfo(
            `⏳ ${action} in Progress`,
            'Waiting for blockchain confirmation...',
            { duration: 0, showProgress: false } // Don't auto-dismiss
        );
    }, [showInfo]);

    const showGameStarted = useCallback((gameName: string) => {
        showVictory(
            `🎮 ${gameName} Started!`,
            'May the best player win!',
            { duration: 4000 }
        );
    }, [showVictory]);

    const showTournamentJoined = useCallback((tournamentName: string) => {
        showAchievement(
            `🏆 Tournament Joined!`,
            `You're now competing in ${tournamentName}`,
            { duration: 5000 }
        );
    }, [showAchievement]);

    const showTournamentCreated = useCallback((tournamentName: string) => {
        showAchievement(
            `🎯 Tournament Created!`,
            `${tournamentName} is now live and accepting players`,
            { duration: 5000 }
        );
    }, [showAchievement]);

    return {
        showNotification,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        showAchievement,
        showLevelUp,
        showVictory,
        showDefeat,
        showTransactionSuccess,
        showTransactionError,
        showTransactionPending,
        showGameStarted,
        showTournamentJoined,
        showTournamentCreated,
    };
};
