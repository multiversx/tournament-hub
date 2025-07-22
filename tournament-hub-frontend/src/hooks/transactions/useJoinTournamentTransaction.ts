import { contractAddress } from 'config';
import { signAndSendTransactions } from 'helpers';
import {
    Address,
    GAS_PRICE,
    Transaction,
    useGetAccount,
    useGetNetworkConfig
} from 'lib';

const JOIN_TRANSACTION_INFO = {
    processingMessage: 'Joining tournament... Please confirm in your wallet.',
    errorMessage: 'An error occurred while joining the tournament.',
    successMessage: 'Successfully joined the tournament!'
};

export const useJoinTournamentTransaction = () => {
    const { network } = useGetNetworkConfig();
    const { address } = useGetAccount();

    const joinTournament = async (tournamentId: number) => {
        // Encode the joinTournament call: 'joinTournament@<tournamentIdHex>'
        const tournamentIdHex = tournamentId.toString(16).padStart(16, '0');
        const data = `joinTournament@${tournamentIdHex}`;

        const tx = new Transaction({
            value: BigInt(0),
            data: Buffer.from(data),
            receiver: new Address(contractAddress),
            gasLimit: BigInt(6000000),
            gasPrice: BigInt(GAS_PRICE),
            chainID: network.chainId,
            sender: new Address(address),
            version: 1
        });

        return signAndSendTransactions({
            transactions: [tx],
            transactionsDisplayInfo: JOIN_TRANSACTION_INFO
        });
    };

    return { joinTournament };
}; 