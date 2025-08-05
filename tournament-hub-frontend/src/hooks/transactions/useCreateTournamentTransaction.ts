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
        const entryFeeHex = BigInt(entryFeeWei).toString(16).padStart(16, '0');
        const durationHex = BigInt(params.duration).toString(16).padStart(16, '0');

        // Encode name as hex string (ManagedBuffer is sent as single argument)
        const nameHex = Buffer.from(params.name, 'utf8').toString('hex');

        // Build the transaction data string (5 arguments total)
        const dataString = `createTournament@${gameIdHex}@${maxPlayersHex}@${entryFeeHex}@${durationHex}@${nameHex}`;

        console.log('createTournament: Transaction data:', dataString);

        // Create the tournament first
        const createTransaction = new Transaction({
            data: Buffer.from(dataString),
            receiver: new Address(tournamentHubContract.address),
            gasLimit: BigInt(60000000), // 60M gas for contract interaction
            gasPrice: BigInt(GAS_PRICE),
            chainID: network.chainId,
            sender: new Address(address),
            version: 1
        });

        // Send the create tournament transaction
        const createSessionId = await signAndSendTransactions({
            transactions: [createTransaction],
            transactionsDisplayInfo: {
                processingMessage: 'Creating tournament... Please confirm in your wallet.',
                errorMessage: 'An error occurred while creating the tournament.',
                successMessage: 'Tournament created successfully!'
            }
        });

        console.log('createTournament: Tournament created with session ID:', createSessionId);

        // Wait a moment for the transaction to be processed
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Get the current tournament count to determine the new tournament ID
        const response = await fetch('https://devnet-api.multiversx.com/vm-values/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                scAddress: tournamentHubContract.address,
                funcName: 'getNumberOfTournaments',
                args: []
            })
        });

        const data = await response.json();
        const returnData = data.data?.data?.returnData || data.data?.returnData;
        const [base64Result] = returnData || [];
        if (!base64Result) {
            throw new Error('Failed to get tournament count');
        }

        const hex = Buffer.from(base64Result, 'base64').toString('hex');
        const tournamentCount = BigInt('0x' + hex);
        const newTournamentId = tournamentCount; // The newly created tournament will have this ID

        console.log('createTournament: New tournament ID:', newTournamentId.toString());

        // Now join the tournament (creator auto-joins)
        const tournamentIdHex = newTournamentId.toString(16).padStart(16, '0');
        const joinTransaction = new Transaction({
            data: Buffer.from(`joinTournament@${tournamentIdHex}`),
            receiver: new Address(tournamentHubContract.address),
            gasLimit: BigInt(60000000),
            gasPrice: BigInt(GAS_PRICE),
            chainID: network.chainId,
            sender: new Address(address),
            version: 1,
            value: BigInt(entryFeeWei) // Send the entry fee
        });

        // Send the join tournament transaction
        const joinSessionId = await signAndSendTransactions({
            transactions: [joinTransaction],
            transactionsDisplayInfo: {
                processingMessage: 'Joining tournament as creator... Please confirm in your wallet.',
                errorMessage: 'An error occurred while joining the tournament.',
                successMessage: 'Successfully joined tournament as creator!'
            }
        });

        console.log('createTournament: Joined tournament with session ID:', joinSessionId);

        return { createSessionId, joinSessionId };
    };

    return { createTournament };
}; 