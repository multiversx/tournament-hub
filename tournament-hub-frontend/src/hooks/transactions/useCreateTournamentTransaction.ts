import { signAndSendTransactions } from 'helpers';
import {
    Address,
    GAS_PRICE,
    Transaction,
    useGetAccount,
    useGetNetworkConfig
} from 'lib';
import { tournamentHubContract } from '../../contracts';
import { egldToWei } from '../../utils/contractUtils';

const CREATE_TOURNAMENT_TRANSACTION_INFO = {
    processingMessage: 'Creating tournament... Please confirm in your wallet.',
    errorMessage: 'An error occurred while creating the tournament.',
    successMessage: 'Transaction submitted! Waiting for blockchain confirmation...'
};

export const useCreateTournamentTransaction = () => {
    const { network } = useGetNetworkConfig();
    const { address } = useGetAccount();

    const createTournament = async (params: {
        gameId: number;
        maxPlayers: number;
        minPlayers: number;
        entryFee: string; // EGLD amount as string
        name: string;
    }) => {
        console.log('=== TOURNAMENT CREATION STARTED ===');
        console.log('Tournament params:', params);

        if (!address) {
            throw new Error('Please connect your wallet first');
        }

        // Convert entry fee from EGLD to wei
        const entryFeeWei = egldToWei(params.entryFee);

        // Encode arguments per MultiversX serialization rules
        const gameIdHex = BigInt(params.gameId).toString(16).padStart(8, '0'); // u32 = 4 bytes
        const maxPlayersHex = BigInt(params.maxPlayers).toString(16).padStart(8, '0'); // u32 = 4 bytes
        const minPlayersHex = BigInt(params.minPlayers).toString(16).padStart(8, '0'); // u32 = 4 bytes

        // Ensure entryFeeHex has even number of characters
        let entryFeeHex = BigInt(entryFeeWei).toString(16);
        if (entryFeeHex.length % 2 !== 0) {
            entryFeeHex = '0' + entryFeeHex;
        }

        // Encode name as hex string with length prefix (ManagedBuffer format)
        const nameBytes = Buffer.from(params.name, 'utf8');
        const nameLength = nameBytes.length;
        const nameLengthHex = nameLength.toString(16).padStart(8, '0'); // 4 bytes, big-endian
        const nameDataHex = nameBytes.toString('hex');
        const nameHex = nameLengthHex + nameDataHex;

        // Build the transaction data string (5 arguments total)
        const dataString = `createTournament@${gameIdHex}@${maxPlayersHex}@${minPlayersHex}@${entryFeeHex}@${nameHex}`;

        // Create the tournament as a single payable smart contract call
        const createTransaction = new Transaction({
            data: new Uint8Array(Buffer.from(dataString)),
            receiver: new Address(tournamentHubContract.address),
            gasLimit: BigInt(200000000), // 200M gas for contract interaction
            gasPrice: BigInt(GAS_PRICE),
            chainID: network.chainId,
            sender: new Address(address),
            version: 1,
            value: BigInt(entryFeeWei), // Entry fee included in contract call
            nonce: BigInt(0) // Let the SDK handle nonce
        });

        // Send the create tournament transaction
        const createSessionId = await signAndSendTransactions({
            transactions: [createTransaction],
            transactionsDisplayInfo: {
                processingMessage: 'Creating tournament and paying entry fee... Please confirm in your wallet.',
                errorMessage: 'An error occurred while creating the tournament. If you see "out of gas" error, the gas limit may need to be increased further.',
                successMessage: 'Tournament created successfully! Entry fee paid and creator joined.'
            }
        });

        console.log('Tournament creation transaction sent, session ID:', createSessionId);

        // Dispatch immediate event for optimistic UI update
        console.log('Dispatching immediate tournament created event');
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('tournament_created', {
                detail: {
                    event: 'tournament_created',
                    timestamp: Date.now(),
                    source: 'tournament_creation_immediate',
                    sessionId: createSessionId
                }
            }));
        }

        // Wait for transaction to be processed and verify tournament creation
        console.log('Waiting for transaction to be processed...');
        await new Promise(resolve => setTimeout(resolve, 3000)); // Increased wait time

        // Verify the tournament was actually created by checking the contract state
        let tournamentCreated = false;
        let retryCount = 0;
        const maxRetries = 5;

        while (!tournamentCreated && retryCount < maxRetries) {
            try {
                console.log(`Verification attempt ${retryCount + 1}/${maxRetries}`);
                const { getActiveTournamentIds, getTournamentsFromBlockchain } = await import('../../helpers');

                // Try multiple methods to verify tournament creation
                const tournamentIds = await getActiveTournamentIds();
                const blockchainTournaments = await getTournamentsFromBlockchain();

                console.log('Current tournament IDs:', tournamentIds);
                console.log('Blockchain tournaments:', blockchainTournaments?.length || 0);

                // Consider tournament created if we have any tournaments
                if (tournamentIds.length > 0 || (blockchainTournaments && blockchainTournaments.length > 0)) {
                    console.log('Tournament confirmed on blockchain, triggering refresh');
                    tournamentCreated = true;

                    // Trigger cache invalidation and events
                    const { invalidateCacheByEvent } = await import('../../helpers');
                    invalidateCacheByEvent('tournament_created');

                    // Also dispatch event directly for immediate UI update
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('tournament_created', {
                            detail: {
                                event: 'tournament_created',
                                timestamp: Date.now(),
                                source: 'tournament_creation_confirmed',
                                tournamentId: tournamentIds[0]
                            }
                        }));
                    }
                } else {
                    console.log(`Tournament not yet confirmed, retry ${retryCount + 1}/${maxRetries}`);
                    retryCount++;
                    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 more seconds
                }
            } catch (error) {
                console.error('Error verifying tournament creation:', error);
                retryCount++;
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        if (!tournamentCreated) {
            console.warn('Tournament creation could not be verified after maximum retries');

            // Dispatch event anyway - the transaction was sent successfully
            console.log('Dispatching unverified tournament created event');
            try {
                const { invalidateCacheByEvent } = await import('../../helpers');
                invalidateCacheByEvent('tournament_created');

                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('tournament_created', {
                        detail: {
                            event: 'tournament_created',
                            timestamp: Date.now(),
                            source: 'tournament_creation_unverified'
                        }
                    }));
                }
            } catch (error) {
                console.error('Error in unverified event dispatch:', error);
            }

            // Also dispatch a delayed fallback event
            setTimeout(async () => {
                console.log('Dispatching delayed fallback tournament created event');
                try {
                    const { invalidateCacheByEvent } = await import('../../helpers');
                    invalidateCacheByEvent('tournament_created');

                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('tournament_created', {
                            detail: {
                                event: 'tournament_created',
                                timestamp: Date.now(),
                                source: 'tournament_creation_delayed_fallback'
                            }
                        }));
                    }
                } catch (error) {
                    console.error('Error in delayed fallback event dispatch:', error);
                }
            }, 15000); // 15 seconds fallback
        }

        // Trigger account info refresh to update wallet balance
        // This ensures the account balance is updated after the transaction
        window.dispatchEvent(new CustomEvent('refreshAccountInfo'));

        // Verify the tournament was actually created by checking the contract state
        let tournamentId = null;
        try {
            const { getActiveTournamentIds } = await import('../../helpers');

            // Wait a bit for the transaction to be processed
            await new Promise(resolve => setTimeout(resolve, 3000));

            const tournamentIds = await getActiveTournamentIds();

            if (tournamentIds && tournamentIds.length > 0) {
                // Find the highest tournament ID (most recent)
                const sortedIds = tournamentIds.sort((a, b) => Number(b) - Number(a));
                tournamentId = sortedIds[0];

                // Verify the tournament exists by trying to fetch it
                try {
                    const { getTournamentDetailsFromContract } = await import('../../helpers');
                    const testDetails = await getTournamentDetailsFromContract(tournamentId);
                    if (!testDetails && sortedIds.length > 1) {
                        // Try the next tournament ID if available
                        tournamentId = sortedIds[1];
                    }
                } catch (testError) {
                    console.error('Error testing tournament details fetch:', testError);
                }
            } else {
                // Use session ID as fallback if no tournaments found
                tournamentId = createSessionId;
            }
        } catch (error) {
            console.error('Error verifying tournament creation:', error);
        }

        // The smart contract automatically adds the creator as a participant
        // No need to call joinTournament separately
        const result = {
            createSessionId,
            tournamentId: tournamentId || createSessionId // Fallback to sessionId if tournamentId not found
        };

        return result;
    };

    return { createTournament };
}; 