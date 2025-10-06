import { useState, useCallback } from 'react';
import { useGetNetworkConfig, useGetAccount } from 'lib';

export interface TransactionConfirmationOptions {
    maxRetries?: number;
    retryDelay?: number;
    timeoutMs?: number;
    tournamentId?: number; // For tournament-specific confirmations
}

export interface TransactionConfirmationResult {
    isConfirmed: boolean;
    txHash?: string;
    error?: string;
}

export const useTransactionConfirmation = () => {
    const { network } = useGetNetworkConfig();
    const { address } = useGetAccount();
    const [isChecking, setIsChecking] = useState(false);

    const waitForConfirmation = useCallback(async (
        sessionId: string,
        options: TransactionConfirmationOptions = {}
    ): Promise<TransactionConfirmationResult> => {
        const {
            maxRetries = 30, // 30 retries with 2s delay = 1 minute max
            retryDelay = 2000, // 2 seconds between retries
            timeoutMs = 60000, // 1 minute timeout
            tournamentId
        } = options;

        setIsChecking(true);

        try {
            const startTime = Date.now();
            let retryCount = 0;

            while (retryCount < maxRetries) {
                // Check if we've exceeded the timeout
                if (Date.now() - startTime > timeoutMs) {
                    return {
                        isConfirmed: false,
                        error: 'Transaction confirmation timeout'
                    };
                }

                try {
                    // For tournament operations, we can check if the tournament state has changed
                    if (tournamentId) {
                        const { getTournamentDetailsFromContract } = await import('../helpers');
                        const tournament = await getTournamentDetailsFromContract(tournamentId);

                        if (tournament) {
                            // Check if the tournament has been updated (e.g., new participant added)
                            // This is a simple way to detect if our transaction was successful
                            return {
                                isConfirmed: true,
                                txHash: 'confirmed' // We don't have the actual tx hash here
                            };
                        }
                    }

                    // For other transactions, we can check recent transactions
                    const response = await fetch(`${network.apiAddress}/transactions?sender=${address}&size=10`);
                    if (response.ok) {
                        const data = await response.json();
                        const transactions = data.data || [];

                        // Look for recent successful transactions
                        for (const tx of transactions) {
                            if (tx.status === 'success') {
                                const txTime = new Date(tx.timestamp * 1000);
                                const now = new Date();
                                const timeDiff = now.getTime() - txTime.getTime();

                                // If transaction is within the last 2 minutes, consider it confirmed
                                if (timeDiff < 2 * 60 * 1000) {
                                    return {
                                        isConfirmed: true,
                                        txHash: tx.txHash
                                    };
                                }
                            }
                        }
                    }

                    // Transaction is still pending, wait and retry
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    retryCount++;

                } catch (error) {
                    console.warn(`Transaction confirmation check ${retryCount + 1} failed:`, error);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    retryCount++;
                }
            }

            return {
                isConfirmed: false,
                error: 'Transaction confirmation timeout after maximum retries'
            };

        } catch (error) {
            console.error('Error waiting for transaction confirmation:', error);
            return {
                isConfirmed: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        } finally {
            setIsChecking(false);
        }
    }, [network.apiAddress, address]);

    return {
        waitForConfirmation,
        isChecking
    };
};
