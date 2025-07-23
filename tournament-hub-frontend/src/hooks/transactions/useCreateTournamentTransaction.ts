import { contractAddress } from 'config';
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

const CREATE_TOURNAMENT_TRANSACTION_INFO = {
    processingMessage: 'Creating tournament... Please confirm in your wallet.',
    errorMessage: 'An error occurred while creating the tournament.',
    successMessage: 'Tournament created successfully!'
};

function padEven(hex: string) {
    return hex.length % 2 === 0 ? hex : '0' + hex;
}

export const useCreateTournamentTransaction = () => {
    const { network } = useGetNetworkConfig();
    const { address } = useGetAccount();

    const createTournament = async (params: {
        tournamentId: number;
        gameId: number;
        entryFee: string;
        joinDeadline: number;
        playDeadline: number;
    }) => {
        if (!address) {
            throw new Error('Please connect your wallet first');
        }

        // Convert parameters to hex strings and pad to even length
        const tournamentIdHex = padEven(params.tournamentId.toString(16));
        const gameIdHex = padEven(params.gameId.toString(16));
        const entryFeeWei = egldToWei(params.entryFee);
        const entryFeeHex = padEven(BigInt(entryFeeWei).toString(16));
        const joinDeadlineHex = padEven(params.joinDeadline.toString(16));
        const playDeadlineHex = padEven(params.playDeadline.toString(16));

        // Build the transaction data string
        const dataString = `createTournament@${tournamentIdHex}@${gameIdHex}@${entryFeeHex}@${joinDeadlineHex}@${playDeadlineHex}`;

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