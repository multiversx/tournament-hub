// Smart Contract Configuration
// Update this address whenever you deploy a new version of the contract

export const CONTRACT_CONFIG = {
    // Smart Contract Address - Update this when you deploy a new contract
    ADDRESS: 'erd1qqqqqqqqqqqqqpgqh040ajuxhrf642mmqlaf0jys58cjn0fcd8ssr0v2vw',

    // Network Configuration
    NETWORK: 'devnet', // 'devnet', 'testnet', 'mainnet'

    // Contract ABI file path (relative to src/contracts/)
    ABI_PATH: 'tournament-hub.abi.json',

    // Gas limit for transactions
    GAS_LIMIT: 60000000,

    // Chain ID
    CHAIN_ID: 'D', // 'D' for devnet, 'T' for testnet, '1' for mainnet
} as const;

// Helper function to get the contract address
export const getContractAddress = (): string => {
    return CONTRACT_CONFIG.ADDRESS;
};

// Helper function to get the network
export const getNetwork = (): string => {
    return CONTRACT_CONFIG.NETWORK;
};

// Helper function to get the ABI path
export const getAbiPath = (): string => {
    return CONTRACT_CONFIG.ABI_PATH;
};

// Helper function to get gas limit
export const getGasLimit = (): number => {
    return CONTRACT_CONFIG.GAS_LIMIT;
};

// Helper function to get chain ID
export const getChainId = (): string => {
    return CONTRACT_CONFIG.CHAIN_ID;
};

// Export the entire config for direct access
export default CONTRACT_CONFIG; 