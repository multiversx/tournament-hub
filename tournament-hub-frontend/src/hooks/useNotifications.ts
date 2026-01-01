import { useToast } from '@chakra-ui/react';
import { useCallback } from 'react';

export interface NotificationOptions {
    title: string;
    description?: string;
    status?: 'success' | 'error' | 'warning' | 'info';
    duration?: number;
    isClosable?: boolean;
}

export const useNotifications = () => {
    const toast = useToast();

    const showNotification = useCallback((options: NotificationOptions) => {
        toast({
            title: options.title,
            description: options.description,
            status: options.status || 'info',
            duration: options.duration || 5000,
            isClosable: options.isClosable !== false,
            position: 'top-right',
            variant: 'solid',
        });
    }, [toast]);

    const showSuccess = useCallback((title: string, description?: string) => {
        showNotification({
            title,
            description,
            status: 'success',
            duration: 3000,
        });
    }, [showNotification]);

    const showError = useCallback((title: string, description?: string) => {
        showNotification({
            title,
            description,
            status: 'error',
            duration: 7000,
        });
    }, [showNotification]);

    const showWarning = useCallback((title: string, description?: string) => {
        showNotification({
            title,
            description,
            status: 'warning',
            duration: 5000,
        });
    }, [showNotification]);

    const showInfo = useCallback((title: string, description?: string) => {
        showNotification({
            title,
            description,
            status: 'info',
            duration: 4000,
        });
    }, [showNotification]);

    return {
        showNotification,
        showSuccess,
        showError,
        showWarning,
        showInfo,
    };
};
