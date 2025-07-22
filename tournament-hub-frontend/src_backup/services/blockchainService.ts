import { getSmartContractService, CreateTournamentParams, JoinTournamentParams, StartTournamentParams } from './smartContractService'
import { sendTransactions } from '../helpers/sendTransactions';

export interface TransactionResult {
    success: boolean
    txHash?: string
    error?: string
    explorerUrl?: string
}

export interface TransactionStatus {
    pending: boolean
    success?: boolean
    error?: string
    txHash?: string
    explorerUrl?: string
}

class BlockchainService {
    private networkId: string

    constructor(networkId: string = 'devnet') {
        this.networkId = networkId
    }

    public setNetwork(networkId: string) {
        this.networkId = networkId
    }

    public async createTournament(
        params: CreateTournamentParams,
        senderAddress: string
    ): Promise<TransactionResult> {
        try {
            console.log('Creating tournament on blockchain...')
            const smartContractService = getSmartContractService(this.networkId)
            const { contractAddress } = await smartContractService.createTournament(params, senderAddress)
            console.log('Fetched contract address:', contractAddress)

            // Fetch current nonce for the sender
            const nonceUrl = `https://devnet-api.multiversx.com/accounts/${senderAddress}`;
            console.log('Fetching nonce from:', nonceUrl)
            const nonceResponse = await fetch(nonceUrl);
            const account = await nonceResponse.json();
            const currentNonce = account.nonce;
            console.log('Fetched account nonce:', currentNonce)

            // Create the transaction for the dApp SDK
            const transaction = {
                sender: senderAddress,
                receiver: contractAddress,
                value: '0',
                data: this.encodeCreateTournamentData(params),
                gasLimit: 60000000,
                chainID: 'D', // Devnet
                nonce: currentNonce + 1 // <-- Set correct nonce
            }
            console.log('Transaction object to send:', transaction)

            // Send the transaction using the new SDK flow
            await sendTransactions([transaction]);
            console.log('Transaction sent successfully')

            return {
                success: true,
                txHash: 'pending', // Will be updated by transaction hooks
                explorerUrl: smartContractService.getExplorerUrl('pending')
            }
        } catch (error) {
            console.error('Failed to create tournament on blockchain:', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            }
        }
    }

    public async joinTournament(
        params: JoinTournamentParams,
        senderAddress: string
    ): Promise<TransactionResult> {
        try {
            console.log('Joining tournament on blockchain...')

            const smartContractService = getSmartContractService(this.networkId)
            const { contractAddress } = await smartContractService.joinTournament(params, senderAddress)

            // Fetch current nonce for the sender
            const nonceResponse = await fetch(`https://devnet-api.multiversx.com/accounts/${senderAddress}`);
            const account = await nonceResponse.json();
            const currentNonce = account.nonce;

            // Create the transaction for the dApp SDK
            const transaction = {
                sender: senderAddress,
                receiver: contractAddress,
                value: params.entryFee,
                data: this.encodeJoinTournamentData(params),
                gasLimit: 60000000,
                chainID: 'D', // Devnet
                nonce: currentNonce + 1 // <-- Set correct nonce
            }

            // Send the transaction using the new SDK flow
            await sendTransactions([transaction]);
            console.log('Transaction sent successfully')

            return {
                success: true,
                txHash: 'pending', // Will be updated by transaction hooks
                explorerUrl: smartContractService.getExplorerUrl('pending')
            }
        } catch (error) {
            console.error('Failed to join tournament on blockchain:', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            }
        }
    }

    public async startTournament(
        params: StartTournamentParams,
        senderAddress: string
    ): Promise<TransactionResult> {
        try {
            console.log('Starting tournament on blockchain...')

            const smartContractService = getSmartContractService(this.networkId)
            const { contractAddress } = await smartContractService.startTournament(params, senderAddress)

            // Fetch current nonce for the sender
            const nonceResponse = await fetch(`https://devnet-api.multiversx.com/accounts/${senderAddress}`);
            const account = await nonceResponse.json();
            const currentNonce = account.nonce;

            // Create the transaction for the dApp SDK
            const transaction = {
                sender: senderAddress,
                receiver: contractAddress,
                value: '0',
                data: this.encodeStartTournamentData(params),
                gasLimit: 60000000,
                chainID: 'D', // Devnet
                nonce: currentNonce + 1 // <-- Set correct nonce
            }

            // Send the transaction using the new SDK flow
            await sendTransactions([transaction]);
            console.log('Transaction sent successfully')

            return {
                success: true,
                txHash: 'pending', // Will be updated by transaction hooks
                explorerUrl: smartContractService.getExplorerUrl('pending')
            }
        } catch (error) {
            console.error('Failed to start tournament on blockchain:', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            }
        }
    }

    public async getTournament(tournamentId: number) {
        try {
            const smartContractService = getSmartContractService(this.networkId)
            return await smartContractService.getTournament(tournamentId)
        } catch (error) {
            console.error('Failed to get tournament from blockchain:', error)
            throw error
        }
    }

    // Helper methods to encode contract calls
    private encodeCreateTournamentData(params: CreateTournamentParams): string {
        // MultiversX uses hex encoding for function calls
        const tournamentIdHex = params.tournamentId.toString(16).padStart(16, '0')
        const gameIdHex = params.gameId.toString(16).padStart(16, '0')
        const entryFeeHex = BigInt(params.entryFee).toString(16).padStart(16, '0')
        const joinDeadlineHex = params.joinDeadline.toString(16).padStart(16, '0')
        const playDeadlineHex = params.playDeadline.toString(16).padStart(16, '0')

        const encodedData = `createTournament@${tournamentIdHex}@${gameIdHex}@${entryFeeHex}@${joinDeadlineHex}@${playDeadlineHex}`
        console.log('Encoded createTournament data:', encodedData)
        return encodedData
    }

    private encodeJoinTournamentData(params: JoinTournamentParams): string {
        const tournamentIdHex = params.tournamentId.toString(16).padStart(16, '0')
        const encodedData = `joinTournament@${tournamentIdHex}`
        console.log('Encoded joinTournament data:', encodedData)
        return encodedData
    }

    private encodeStartTournamentData(params: StartTournamentParams): string {
        const tournamentIdHex = params.tournamentId.toString(16).padStart(16, '0')
        const encodedData = `startTournament@${tournamentIdHex}`
        console.log('Encoded startTournament data:', encodedData)
        return encodedData
    }
}

// Create a singleton instance
let blockchainService: BlockchainService | null = null

export const getBlockchainService = (networkId?: string): BlockchainService => {
    if (!blockchainService || networkId) {
        blockchainService = new BlockchainService(networkId)
    }
    return blockchainService
}

export default BlockchainService 