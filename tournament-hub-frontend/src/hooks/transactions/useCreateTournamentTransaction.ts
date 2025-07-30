import { signAndSendTransactions } from 'helpers';
import {
    Address,
    GAS_PRICE,
    Transaction,
    useGetAccount,
    useGetNetworkConfig
} from 'lib';
import { tournamentHubContract } from '../../contracts';

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
    }) => {
        if (!address) {
            throw new Error('Please connect your wallet first');
        }

        // Encode arguments per MultiversX serialization rules
        // Always serialize gameId as u64 (8-byte, 16 hex chars)
        const gameIdHex = BigInt(params.gameId).toString(16).padStart(16, '0');

        // Build the transaction data string
        const dataString = `createTournament@${gameIdHex}`;

        const transaction = new Transaction({
            // Do not send value for non-payable endpoint
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
            transactionsDisplayInfo: CREATE_TOURNAMENT_TRANSACTION_INFO
        });

        return sessionId;
    };

    return { createTournament };
}; 