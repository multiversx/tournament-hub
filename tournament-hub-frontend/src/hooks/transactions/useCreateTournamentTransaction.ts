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
    successMessage: 'Tournament created successfully!'
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
            data: Buffer.from(dataString),
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

        // Wait a bit for the transaction to be processed
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Trigger immediate cache invalidation to refresh the UI
        try {
            const { invalidateCacheByEvent } = await import('../../helpers');
            invalidateCacheByEvent('tournament_created');
        } catch (error) {
            // Error invalidating cache (non-critical)
        }

        // Trigger account info refresh to update wallet balance
        // This ensures the account balance is updated after the transaction
        window.dispatchEvent(new CustomEvent('refreshAccountInfo'));

        // Verify the tournament was actually created by checking the contract state
        try {
            const { getActiveTournamentIds } = await import('../../helpers');
            const tournamentIds = await getActiveTournamentIds();

            if (tournamentIds.length > 0) {
                const latestId = tournamentIds[0];
                // Latest tournament ID found
            } else {
                // No tournaments found after creation
            }
        } catch (error) {
            // Error verifying tournament creation (non-critical)
        }

        // The smart contract automatically adds the creator as a participant
        // No need to call joinTournament separately
        return { createSessionId };
    };

    return { createTournament };
}; 