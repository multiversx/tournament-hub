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
import { Address as MultiversXAddress } from '@multiversx/sdk-core';

const CREATE_TOURNAMENT_TRANSACTION_INFO = {
    processingMessage: 'Creating tournament... Please confirm in your wallet.',
    errorMessage: 'An error occurred while creating the tournament.',
    successMessage: 'Tournament created successfully!'
};

function padEven(hex: string) {
    return hex.length % 2 === 0 ? hex : '0' + hex;
}

function encodeBigUintForSC(valueHex: string): string {
    let cleanHex = valueHex.replace(/^0+/, '');
    if (cleanHex.length % 2 !== 0) cleanHex = '0' + cleanHex;
    const byteLen = cleanHex.length / 2;
    const lenHex = byteLen.toString(16).padStart(8, '0'); // 4 bytes, big endian
    return lenHex + cleanHex;
}

// Encode a single ManagedAddress (32 bytes, no length prefix)
function encodeAddressForSC(bech32: string): string {
    return MultiversXAddress.fromBech32(bech32).hex(); // 64 hex chars
}
// Encode a ManagedVec<ManagedAddress> (4 bytes length, then each address)
function encodeVecAddressForSC(addresses: string[]): string {
    const hexAddresses = addresses.map(addr => MultiversXAddress.fromBech32(addr).hex());
    const lenHex = addresses.length.toString(16).padStart(8, '0'); // 4 bytes, big endian
    return lenHex + hexAddresses.join('');
}
// Encode a ManagedVec<u32> (4 bytes length, then each u32 as 4 bytes)
function encodeVecU32ForSC(values: number[]): string {
    const lenHex = values.length.toString(16).padStart(8, '0');
    const valuesHex = values.map(v => v.toString(16).padStart(8, '0')).join('');
    return lenHex + valuesHex;
}

export const useCreateTournamentTransaction = () => {
    const { network } = useGetNetworkConfig();
    const { address } = useGetAccount();

    const createTournament = async (params: {
        gameId: number;
        joinDeadline: number;
        playDeadline: number;
    }) => {
        if (!address) {
            throw new Error('Please connect your wallet first');
        }

        // Encode arguments per MultiversX serialization rules
        // Always serialize gameId as u64 (8-byte, 16 hex chars)
        const gameIdHex = BigInt(params.gameId).toString(16).padStart(16, '0');
        const joinDeadlineHex = params.joinDeadline.toString(16).padStart(16, '0'); // 8 bytes
        const playDeadlineHex = params.playDeadline.toString(16).padStart(16, '0'); // 8 bytes

        // Build the transaction data string
        console.log('gameIdHex (u64, 8 bytes):', gameIdHex);
        const dataString = `createTournament@${gameIdHex}@${joinDeadlineHex}@${playDeadlineHex}`;

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