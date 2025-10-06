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
            maxRetries = 45, // 45 retries with 3s delay = 2.25 minutes max
            retryDelay = 3000, // 3 seconds between retries
            timeoutMs = 90000, // 1.5 minutes timeout
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
                    // For tournament operations, we need to verify the user is actually in the participants list
                    if (tournamentId && address) {
                        const { getTournamentDetailsFromContract } = await import('../helpers');
                        const tournament = await getTournamentDetailsFromContract(BigInt(tournamentId));

                        if (tournament && Array.isArray(tournament.participants)) {
                            // Only confirm if the user is actually in the participants list
                            const isParticipant = tournament.participants.includes(address);
                            if (isParticipant) {
                                console.log('Tournament join confirmed: user is now in participants list');
                                return {
                                    isConfirmed: true,
                                    txHash: 'confirmed' // We don't have the actual tx hash here
                                };
                            } else {
                                console.log('Tournament join not yet confirmed: user not in participants list');
                            }
                        }
                    }

                    // For other transactions or as fallback, check recent transactions
                    if (address) {
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
                                        console.log('Transaction confirmed via blockchain API:', tx.txHash);
                                        return {
                                            isConfirmed: true,
                                            txHash: tx.txHash
                                        };
                                    }
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
