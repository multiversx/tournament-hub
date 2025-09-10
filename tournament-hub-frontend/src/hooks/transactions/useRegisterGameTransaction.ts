import { signAndSendTransactions } from 'helpers';
import {
    Address,
    GAS_PRICE,
    Transaction,
    useGetAccount,
    useGetNetworkConfig
} from 'lib';
import { tournamentHubContract } from '../../contracts';

const REGISTER_GAME_TRANSACTION_INFO = {
    processingMessage: 'Registering game... Please confirm in your wallet.',
    errorMessage: 'An error occurred while registering the game.',
    successMessage: 'Game registered successfully!'
};

export const useRegisterGameTransaction = () => {
    const { network } = useGetNetworkConfig();
    const { address } = useGetAccount();

    const registerGame = async (params: {
        signingServerAddress: string;
        podiumSize: number;
        prizeDistributionPercentages: number[];
        allowLateJoin: boolean;
    }) => {
        if (!address) {
            throw new Error('Please connect your wallet first');
        }

        // Debug logging
        console.log('registerGame: Input params:', params);

        // Encode arguments per MultiversX serialization rules
        const signingServerAddressHex = new Address(params.signingServerAddress).hex();
        const podiumSizeHex = BigInt(params.podiumSize).toString(16).padStart(8, '0');

        // Encode prize distribution percentages as individual arguments
        // For MultiversX List<u32>, each element becomes a separate argument
        const prizeDistributionArgs = params.prizeDistributionPercentages.map(percentage =>
            BigInt(percentage).toString(16).padStart(8, '0')
        );

        const allowLateJoinHex = params.allowLateJoin ? '01' : '00';

        // Build the transaction data string - MultiversX uses @ as separator
        // Format: registerGame@address@podiumSize@percentage1@percentage2@...@allowLateJoin
        const dataString = `registerGame@${signingServerAddressHex}@${podiumSizeHex}@${prizeDistributionArgs.join('@')}@${allowLateJoinHex}`;

        console.log('registerGame: Transaction data:', dataString);

        // Create the register game transaction
        const registerTransaction = new Transaction({
            data: Buffer.from(dataString),
            receiver: new Address(tournamentHubContract.address),
            gasLimit: BigInt(10000000), // 10M gas for contract interaction
            gasPrice: BigInt(GAS_PRICE),
            chainID: network.chainId,
            sender: new Address(address),
            version: 1,
            value: BigInt(0) // No payment required for registration
        });

        // Send the register game transaction
        console.log('registerGame: Sending transaction to contract:', tournamentHubContract.address);
        console.log('registerGame: Transaction details:', {
            receiver: registerTransaction.receiver.toString(),
            gasLimit: registerTransaction.gasLimit.toString(),
            gasPrice: registerTransaction.gasPrice.toString(),
            value: registerTransaction.value.toString(),
            data: registerTransaction.data.toString()
        });

        const registerSessionId = await signAndSendTransactions({
            transactions: [registerTransaction],
            transactionsDisplayInfo: {
                processingMessage: 'Registering game... Please confirm in your wallet.',
                errorMessage: 'An error occurred while registering the game.',
                successMessage: 'Game registered successfully!'
            }
        });

        console.log('registerGame: Game registered with session ID:', registerSessionId);

        return { registerSessionId };
    };

    return { registerGame };
};
