import { useState, useCallback, useRef } from 'react';
import { useToast } from '@chakra-ui/react';
import { useTransactionConfirmation } from './useTransactionConfirmation';

export type ButtonStatus = 'idle' | 'loading' | 'confirming' | 'success' | 'error' | 'disabled';

export interface UseTransactionButtonStateOptions {
    onSuccess?: (result?: any) => void;
    onError?: (error: Error) => void;
    successMessage?: string;
    errorMessage?: string;
    successDuration?: number;
    errorDuration?: number;
    autoResetDelay?: number; // Auto reset to idle after success/error
    debounceMs?: number; // Debounce rapid clicks
    waitForConfirmation?: boolean; // Whether to wait for blockchain confirmation
    tournamentId?: number; // For tournament-specific confirmations
}

export interface UseTransactionButtonStateReturn {
    status: ButtonStatus;
    isLoading: boolean;
    isConfirming: boolean;
    isSuccess: boolean;
    isError: boolean;
    isDisabled: boolean;
    execute: (asyncFn: () => Promise<any>) => Promise<void>;
    reset: () => void;
    setStatus: (status: ButtonStatus) => void;
}

export const useTransactionButtonState = (options: UseTransactionButtonStateOptions = {}): UseTransactionButtonStateReturn => {
    const {
        onSuccess,
        onError,
        successMessage,
        errorMessage,
        successDuration = 3000,
        errorDuration = 5000,
        autoResetDelay = 2000,
        debounceMs = 500,
        waitForConfirmation = true,
        tournamentId
    } = options;

    const [status, setStatus] = useState<ButtonStatus>('idle');
    const toast = useToast();
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);
    const { waitForConfirmation: waitForTxConfirmation, isChecking } = useTransactionConfirmation();

    const isLoading = status === 'loading';
    const isConfirming = status === 'confirming';
    const isSuccess = status === 'success';
    const isError = status === 'error';
    const isDisabled = status === 'disabled' || isLoading || isConfirming;

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

                    // Execute the async function (e.g., submit transaction)
                    const result = await asyncFn();

                    // If we need to wait for confirmation and we have a session ID
                    if (waitForConfirmation && result && typeof result === 'string') {
                        setStatus('confirming');

                        // Show a message that we're waiting for confirmation
                        toast({
                            title: 'Transaction submitted',
                            description: 'Waiting for blockchain confirmation and tournament participation verification...',
                            status: 'info',
                            duration: 8000,
                            isClosable: true,
                        });

                        // Wait for blockchain confirmation
                        const confirmation = await waitForTxConfirmation(result, {
                            tournamentId,
                            maxRetries: 45, // Increased retries for tournament operations
                            retryDelay: 3000, // Increased delay to 3 seconds
                            timeoutMs: 90000 // Increased timeout to 90 seconds
                        });

                        if (confirmation.isConfirmed) {
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
                        } else {
                            setStatus('error');

                            const message = confirmation.error || 'Transaction confirmation failed';
                            toast({
                                title: 'Confirmation Failed',
                                description: message,
                                status: 'error',
                                duration: errorDuration,
                                isClosable: true,
                            });

                            onError?.(new Error(message));
                        }
                    } else {
                        // No confirmation needed, show success immediately
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
        waitForConfirmation,
        tournamentId,
        onSuccess,
        onError,
        toast,
        waitForTxConfirmation
    ]);

    return {
        status,
        isLoading,
        isConfirming,
        isSuccess,
        isError,
        isDisabled,
        execute,
        reset,
        setStatus,
    };
};
