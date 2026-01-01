import { useState, useCallback, useRef } from 'react';
import { useToast } from '@chakra-ui/react';

export type ButtonStatus = 'idle' | 'loading' | 'success' | 'error' | 'disabled';

export interface UseButtonStateOptions {
    onSuccess?: (result?: any) => void;
    onError?: (error: Error) => void;
    successMessage?: string;
    errorMessage?: string;
    successDuration?: number;
    errorDuration?: number;
    autoResetDelay?: number; // Auto reset to idle after success/error
    debounceMs?: number; // Debounce rapid clicks
}

export interface UseButtonStateReturn {
    status: ButtonStatus;
    isLoading: boolean;
    isSuccess: boolean;
    isError: boolean;
    isDisabled: boolean;
    execute: (asyncFn: () => Promise<any>) => Promise<void>;
    reset: () => void;
    setStatus: (status: ButtonStatus) => void;
}

export const useButtonState = (options: UseButtonStateOptions = {}): UseButtonStateReturn => {
    const {
        onSuccess,
        onError,
        successMessage,
        errorMessage,
        successDuration = 3000,
        errorDuration = 5000,
        autoResetDelay = 2000,
        debounceMs = 300,
    } = options;

    const [status, setStatus] = useState<ButtonStatus>('idle');
    const toast = useToast();
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    const isLoading = status === 'loading';
    const isSuccess = status === 'success';
    const isError = status === 'error';
    const isDisabled = status === 'disabled' || isLoading;

    const reset = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setStatus('idle');
    }, []);

    const execute = useCallback(async (asyncFn: () => Promise<any>) => {
        // Debounce rapid clicks
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        return new Promise<void>((resolve) => {
            debounceRef.current = setTimeout(async () => {
                try {
                    setStatus('loading');
                    const result = await asyncFn();

                    setStatus('success');

                    if (successMessage) {
                        toast({
                            title: 'Success!',
                            description: successMessage,
                            status: 'success',
                            duration: successDuration,
                            isClosable: true,
                        });
                    }

                    onSuccess?.(result);

                    // Auto reset after delay
                    if (autoResetDelay > 0) {
                        timeoutRef.current = setTimeout(() => {
                            setStatus('idle');
                        }, autoResetDelay);
                    }

                    resolve();
                } catch (error) {
                    const errorObj = error instanceof Error ? error : new Error('Unknown error');
                    setStatus('error');

                    const message = errorMessage || errorObj.message || 'An error occurred';
                    toast({
                        title: 'Error',
                        description: message,
                        status: 'error',
                        duration: errorDuration,
                        isClosable: true,
                    });

                    onError?.(errorObj);
                    resolve();
                }
            }, debounceMs);
        });
    }, [
        successMessage,
        errorMessage,
        successDuration,
        errorDuration,
        autoResetDelay,
        debounceMs,
        onSuccess,
        onError,
        toast,
    ]);

    return {
        status,
        isLoading,
        isSuccess,
        isError,
        isDisabled,
        execute,
        reset,
        setStatus,
    };
};

// Specialized hooks for common use cases
export const useTransactionButton = (options: UseButtonStateOptions = {}) => {
    return useButtonState({
        successMessage: 'Transaction completed successfully!',
        errorMessage: 'Transaction failed. Please try again.',
        autoResetDelay: 3000,
        debounceMs: 500,
        ...options,
    });
};

export const useAsyncButton = (options: UseButtonStateOptions = {}) => {
    return useButtonState({
        successMessage: 'Action completed successfully!',
        errorMessage: 'Action failed. Please try again.',
        autoResetDelay: 2000,
        debounceMs: 300,
        ...options,
    });
};

export default useButtonState;
