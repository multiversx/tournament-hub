import { signAndSendTransactions } from 'helpers';
import {
    Address,
    GAS_PRICE,
    Transaction,
    useGetAccount,
    useGetNetworkConfig
} from 'lib';
import { tournamentHubContract } from '../../contracts';

const START_GAME_TRANSACTION_INFO = {
    processingMessage: 'Starting game... Please confirm in your wallet.',
    errorMessage: 'An error occurred while starting the game.',
    successMessage: 'Transaction submitted! Waiting for blockchain confirmation...'
};

export const useStartGameTransaction = () => {
    const { network } = useGetNetworkConfig();
    const { address } = useGetAccount();

    const startGame = async (params: {
        tournamentId: number;
        gameId: number;
        participants: string[];
    }) => {
        if (!address) {
            throw new Error('Please connect your wallet first');
        }

        // Always serialize tournamentId as u64 (8-byte, 16 hex chars)
        const tournamentIdHex = BigInt(params.tournamentId).toString(16).padStart(16, '0');

        // Build the transaction data string
        const dataString = `startGame@${tournamentIdHex}`;

        const transaction = new Transaction({
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
            transactionsDisplayInfo: START_GAME_TRANSACTION_INFO
        });

        return sessionId;
    };

    return { startGame };
}; 