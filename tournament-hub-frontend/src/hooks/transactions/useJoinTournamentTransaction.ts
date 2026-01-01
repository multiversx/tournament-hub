import { signAndSendTransactions } from 'helpers';
import {
    Address,
    GAS_PRICE,
    Transaction,
    useGetAccount,
    useGetNetworkConfig
} from 'lib';
import { egldToWei } from '../../utils/contractUtils';
import { tournamentHubContract } from '../../contracts';

const JOIN_TRANSACTION_INFO = {
    processingMessage: 'Joining tournament... Please confirm in your wallet.',
    errorMessage: 'An error occurred while joining the tournament.',
    successMessage: 'Transaction submitted! Waiting for blockchain confirmation...'
};

function padEven(hex: string) {
    return hex.length % 2 === 0 ? hex : '0' + hex;
}

export const useJoinTournamentTransaction = () => {
    const { network } = useGetNetworkConfig();
    const { address } = useGetAccount();

    const joinTournament = async (params: {
        tournamentId: number;
        entryFee: string;
    }) => {
        if (!address) {
            throw new Error('Please connect your wallet first');
        }

        // Always serialize tournamentId as u64 (8-byte, 16 hex chars)
        const tournamentIdHex = BigInt(params.tournamentId).toString(16).padStart(16, '0');

        // Build the transaction data string
        const dataString = `joinTournament@${tournamentIdHex}`;

        // Do NOT convert entryFee to Number or use scientific notation
        const value = BigInt(params.entryFee); // params.entryFee is a string like "1000000000000000000"

        const transaction = new Transaction({
            value,
            data: Buffer.from(dataString),
            receiver: new Address(tournamentHubContract.address),
            gasLimit: BigInt(60000000), // 60M gas for contract interaction
            gasPrice: BigInt(GAS_PRICE),
            chainID: network.chainId,
            sender: new Address(address),
            version: 1
        });

        const sessionId = await signAndSendTransactions({
            transactions: [transaction],
            transactionsDisplayInfo: JOIN_TRANSACTION_INFO
        });

        // Trigger immediate cache invalidation to refresh the UI
        try {
            const { invalidateCacheByEvent, invalidateCacheByKey } = await import('../../helpers');

            // Invalidate specific tournament caches
            invalidateCacheByKey(`tournament_details_${params.tournamentId}`);
            invalidateCacheByKey(`basic_${params.tournamentId}`);

            // Invalidate general tournament events
            invalidateCacheByEvent('tournament_joined');
            invalidateCacheByEvent('tournament_updated');

            console.log('joinTournament: Cache invalidated for immediate refresh');
        } catch (error) {
            console.error('joinTournament: Error invalidating cache:', error);
        }

        return sessionId;
    };

    return { joinTournament };
}; 