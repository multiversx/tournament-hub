import tournamentHubAbi from './tournament-hub.abi.json';
import { contractAddress } from '../config';

export interface ContractAbi {
    name: string;
    endpoints: Array<{
        name: string;
        mutability: string;
        inputs: Array<{
            name: string;
            type: string;
        }>;
        outputs: Array<{
            type: string;
        }>;
        payableInTokens?: string[];
        onlyOwner?: boolean;
    }>;
    types: Record<string, any>;
}

export const tournamentHubContract = {
    address: contractAddress,
    abi: tournamentHubAbi as ContractAbi,
};

/**
 * Get endpoint definition from ABI
 */
export function getEndpoint(abi: ContractAbi, endpointName: string) {
    return abi.endpoints.find(endpoint => endpoint.name === endpointName);
}

/**
 * Get input types for an endpoint
 */
export function getEndpointInputs(abi: ContractAbi, endpointName: string) {
    const endpoint = getEndpoint(abi, endpointName);
    return endpoint?.inputs || [];
}

/**
 * Check if endpoint is payable
 */
export function isEndpointPayable(abi: ContractAbi, endpointName: string): boolean {
    const endpoint = getEndpoint(abi, endpointName);
    return endpoint?.payableInTokens?.includes('EGLD') || false;
}

/**
 * Check if endpoint is owner-only
 */
export function isEndpointOwnerOnly(abi: ContractAbi, endpointName: string): boolean {
    const endpoint = getEndpoint(abi, endpointName);
    return endpoint?.onlyOwner || false;
}

export default tournamentHubContract; 