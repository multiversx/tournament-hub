import { getNetworkConfig, NetworkConfig } from '../config/networks'

export interface CreateTournamentParams {
    tournamentId: number
    gameId: number
    entryFee: string // EGLD amount
    joinDeadline: number // Unix timestamp
    playDeadline: number // Unix timestamp
}

export interface JoinTournamentParams {
    tournamentId: number
    entryFee: string // EGLD amount
}

export interface StartTournamentParams {
    tournamentId: number
}

export interface TournamentData {
    gameId: number
    status: string
    entryFee: string
    participants: string[]
    prizePool: string
    joinDeadline: number
    playDeadline: number
    finalPodium: string[]
    creator: string
}

export interface ContractInteraction {
    interaction: any
    network: string
    contractAddress: string
}

class SmartContractService {
    private networkConfig: NetworkConfig

    constructor(networkId: string = 'devnet') {
        this.networkConfig = getNetworkConfig(networkId)
    }

    public setNetwork(networkId: string) {
        this.networkConfig = getNetworkConfig(networkId)
    }

    public getNetworkConfig(): NetworkConfig {
        return this.networkConfig
    }

    public async createTournament(params: CreateTournamentParams, _senderAddress: string): Promise<{ contractAddress: string }> {
        try {
            console.log('Creating tournament with params:', params)
            console.log('Network:', this.networkConfig.name)
            console.log('Contract address:', this.networkConfig.contractAddress)

            return {
                contractAddress: this.networkConfig.contractAddress
            }
        } catch (error) {
            console.error('Failed to create tournament interaction:', error)
            throw new Error('Failed to create tournament transaction')
        }
    }

    public async joinTournament(params: JoinTournamentParams, _senderAddress: string): Promise<{ contractAddress: string }> {
        try {
            console.log('Joining tournament with params:', params)
            console.log('Network:', this.networkConfig.name)
            console.log('Contract address:', this.networkConfig.contractAddress)

            return {
                contractAddress: this.networkConfig.contractAddress
            }
        } catch (error) {
            console.error('Failed to join tournament interaction:', error)
            throw new Error('Failed to join tournament transaction')
        }
    }

    public async startTournament(params: StartTournamentParams, _senderAddress: string): Promise<{ contractAddress: string }> {
        try {
            console.log('Starting tournament with params:', params)
            console.log('Network:', this.networkConfig.name)
            console.log('Contract address:', this.networkConfig.contractAddress)

            return {
                contractAddress: this.networkConfig.contractAddress
            }
        } catch (error) {
            console.error('Failed to start tournament interaction:', error)
            throw new Error('Failed to start tournament transaction')
        }
    }

    public async getTournament(tournamentId: number): Promise<TournamentData | null> {
        try {
            console.log('Querying tournament:', tournamentId)
            console.log('Network:', this.networkConfig.name)
            console.log('Contract address:', this.networkConfig.contractAddress)

            // For now, return a mock tournament
            // In a real implementation, this would query the actual contract
            return {
                gameId: 1,
                status: 'Joining',
                entryFee: '1000000000000000000',
                participants: [],
                prizePool: '0',
                joinDeadline: Math.floor(Date.now() / 1000) + 3600,
                playDeadline: Math.floor(Date.now() / 1000) + 7200,
                finalPodium: [],
                creator: 'erd1q7nr9d208slu2mjg3zph2puxlxasld8x95ty9crszwlczxmss30qd3t2tn'
            }
        } catch (error) {
            console.error('Failed to get tournament:', error)
            throw new Error('Failed to query tournament data')
        }
    }

    public getExplorerUrl(txHash: string): string {
        return `${this.networkConfig.explorer}/transactions/${txHash}`
    }
}

// Create a singleton instance
let smartContractService: SmartContractService | null = null

export const getSmartContractService = (networkId?: string): SmartContractService => {
    if (!smartContractService || networkId) {
        smartContractService = new SmartContractService(networkId)
    }
    return smartContractService
}

export default SmartContractService 