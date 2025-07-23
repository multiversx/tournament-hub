import { tournamentHubContract, getEndpointInputs } from '../contracts';

/**
 * Convert a value to hex string with proper padding
 */
export function toHex(value: string | number, padding: number = 16): string {
    const hex = typeof value === 'number' ? value.toString(16) : value;
    return hex.padStart(padding, '0');
}

/**
 * Convert EGLD amount to wei (1 EGLD = 10^18 wei)
 */
export function egldToWei(egldAmount: string): string {
    return (parseFloat(egldAmount) * Math.pow(10, 18)).toString();
}

/**
 * Convert wei to EGLD
 */
export function weiToEgld(weiAmount: string): string {
    return (parseFloat(weiAmount) / Math.pow(10, 18)).toString();
}

/**
 * Build transaction data for a contract call
 */
export function buildTransactionData(endpointName: string, args: (string | number)[]): string {
    const inputs = getEndpointInputs(tournamentHubContract.abi, endpointName);

    if (inputs.length !== args.length) {
        throw new Error(`Expected ${inputs.length} arguments for ${endpointName}, got ${args.length}`);
    }

    const encodedArgs = args.map((arg, index) => {
        const inputType = inputs[index].type;

        switch (inputType) {
            case 'u64':
                return toHex(arg as number, 16);
            case 'u32':
                return toHex(arg as number, 8);
            case 'BigUint':
                return toHex(arg as string);
            case 'Address':
                return arg as string;
            case 'bool':
                return arg ? '01' : '00';
            default:
                return toHex(arg as string);
        }
    });

    return `${endpointName}@${encodedArgs.join('@')}`;
}

/**
 * Parse tournament status from number
 */
export function parseTournamentStatus(status: number): string {
    switch (status) {
        case 0: return 'Joining';
        case 1: return 'Playing';
        case 2: return 'ProcessingResults';
        case 3: return 'Completed';
        default: return 'Unknown';
    }
}

/**
 * Format address for display
 */
export function formatAddress(address: string): string {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
} 