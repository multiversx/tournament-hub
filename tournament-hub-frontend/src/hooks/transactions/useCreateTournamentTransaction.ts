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
        duration: number; // duration in seconds
        name: string;
    }) => {
        if (!address) {
            throw new Error('Please connect your wallet first');
        }

        // Debug logging
        console.log('createTournament: Input params:', params);

        // Convert entry fee from EGLD to wei
        const entryFeeWei = egldToWei(params.entryFee);
        console.log('createTournament: Entry fee conversion:', {
            original: params.entryFee,
            wei: entryFeeWei.toString(),
            weiHex: entryFeeWei.toString(16)
        });

        // Encode arguments per MultiversX serialization rules
        const gameIdHex = BigInt(params.gameId).toString(16).padStart(16, '0');
        const maxPlayersHex = BigInt(params.maxPlayers).toString(16).padStart(8, '0');
        const minPlayersHex = BigInt(params.minPlayers).toString(16).padStart(8, '0');
        const entryFeeHex = BigInt(entryFeeWei).toString(16).padStart(16, '0');
        const durationHex = BigInt(params.duration).toString(16).padStart(16, '0');

        // Encode name as hex string (ManagedBuffer is sent as single argument)
        const nameHex = Buffer.from(params.name, 'utf8').toString('hex');

        // Build the transaction data string (6 arguments total)
        const dataString = `createTournament@${gameIdHex}@${maxPlayersHex}@${minPlayersHex}@${entryFeeHex}@${durationHex}@${nameHex}`;

        console.log('createTournament: Transaction data:', dataString);

        // Create the tournament first
        const createTransaction = new Transaction({
            data: Buffer.from(dataString),
            receiver: new Address(tournamentHubContract.address),
            gasLimit: BigInt(60000000), // 60M gas for contract interaction
            gasPrice: BigInt(GAS_PRICE),
            chainID: network.chainId,
            sender: new Address(address),
            version: 1,
            value: BigInt(entryFeeWei) // Send the entry fee with the transaction
        });

        // Send the create tournament transaction
        const createSessionId = await signAndSendTransactions({
            transactions: [createTransaction],
            transactionsDisplayInfo: {
                processingMessage: 'Creating tournament and paying entry fee... Please confirm in your wallet.',
                errorMessage: 'An error occurred while creating the tournament.',
                successMessage: 'Tournament created successfully! Entry fee paid and creator joined.'
            }
        });

        console.log('createTournament: Tournament created with session ID:', createSessionId);

        // The smart contract automatically adds the creator as a participant
        // No need to call joinTournament separately
        return { createSessionId };
    };

    return { createTournament };
}; 