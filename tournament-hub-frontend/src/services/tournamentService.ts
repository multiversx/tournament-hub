import { ProxyNetworkProvider, SmartContract, Address, AbiRegistry } from '@multiversx/sdk-core';
import { tournamentHubContract } from '../contracts';
import { egldToWei } from '../utils/contractUtils';

export class TournamentService {
  private networkProvider: ProxyNetworkProvider;
  private contract: SmartContract;

  constructor() {
    this.networkProvider = new ProxyNetworkProvider('https://devnet-api.multiversx.com');
    this.contract = new SmartContract({
      address: new Address(tournamentHubContract.address),
      abi: this.getContractAbi()
    });
  }

  private getContractAbi() {
    return AbiRegistry.create(tournamentHubContract.abi);
  }

  /**
   * Create a new tournament
   * Note: This method is deprecated. Use the useCreateTournamentTransaction hook instead.
   */
  async createTournament(params: {
    tournamentId: number;
    gameId: number;
    entryFee: string;
    joinDeadline: number;
    playDeadline: number;
  }): Promise<{ success: boolean; transactionHash: string; tournamentId: number; error?: string }> {
    console.warn('TournamentService.createTournament is deprecated. Use useCreateTournamentTransaction hook instead.');

    // Return a placeholder response - the actual implementation should use the hook
    return {
      success: false,
      transactionHash: 'deprecated',
      tournamentId: params.tournamentId,
      error: 'Please use useCreateTournamentTransaction hook instead'
    };
  }

  /**
   * Join a tournament
   * Note: This method is deprecated. Use the useJoinTournamentTransaction hook instead.
   */
  async joinTournament(params: {
    tournamentId: number;
    entryFee: string;
  }): Promise<{ success: boolean; transactionHash: string; error?: string }> {
    console.warn('TournamentService.joinTournament is deprecated. Use useJoinTournamentTransaction hook instead.');

    // Return a placeholder response - the actual implementation should use the hook
    return {
      success: false,
      transactionHash: 'deprecated',
      error: 'Please use useJoinTournamentTransaction hook instead'
    };
  }

  /**
   * Get tournament details from blockchain
   */
  async getTournamentDetails(tournamentId: number): Promise<any> {
    try {
      const response = await fetch('https://devnet-api.multiversx.com/vm-values/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scAddress: tournamentHubContract.address,
          funcName: 'getTournament',
          args: [tournamentId.toString(16).padStart(16, '0')]
        })
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching tournament details:', error);
      throw error;
    }
  }

  /**
   * Get all active tournament IDs
   */
  async getActiveTournamentIds(): Promise<number[]> {
    try {
      const response = await fetch('https://devnet-api.multiversx.com/vm-values/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scAddress: tournamentHubContract.address,
          funcName: 'getActiveTournamentIds',
          args: []
        })
      });

      const data = await response.json();
      const [base64Result] = data.data.returnData || [];

      if (!base64Result) return [];

      const hex = Buffer.from(base64Result, 'base64').toString('hex');
      const ids = [];

      // Each u64 is 16 hex chars
      for (let i = 0; i < hex.length; i += 16) {
        ids.push(parseInt(hex.slice(i, i + 16), 16));
      }

      return ids;
    } catch (error) {
      console.error('Error fetching active tournament IDs:', error);
      throw error;
    }
  }
}

export const tournamentService = new TournamentService(); 