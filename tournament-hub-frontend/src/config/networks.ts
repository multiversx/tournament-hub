export interface NetworkConfig {
    id: string
    name: string
    chainId: string
    gateway: string
    api: string
    explorer: string
    contractAddress: string
}

export const NETWORKS: Record<string, NetworkConfig> = {
    devnet: {
        id: 'devnet',
        name: 'Devnet',
        chainId: 'D',
        gateway: 'https://devnet-gateway.multiversx.com',
        api: 'https://devnet-api.multiversx.com',
        explorer: 'https://devnet-explorer.multiversx.com',
        contractAddress: 'erd1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssycr6th' // Replace with your deployed contract address
    },
    testnet: {
        id: 'testnet',
        name: 'Testnet',
        chainId: 'T',
        gateway: 'https://testnet-gateway.multiversx.com',
        api: 'https://testnet-api.multiversx.com',
        explorer: 'https://testnet-explorer.multiversx.com',
        contractAddress: 'erd1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssycr6th' // Replace with your deployed contract address
    },
    mainnet: {
        id: 'mainnet',
        name: 'Mainnet',
        chainId: '1',
        gateway: 'https://gateway.multiversx.com',
        api: 'https://api.multiversx.com',
        explorer: 'https://explorer.multiversx.com',
        contractAddress: 'erd1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssycr6th' // Replace with your deployed contract address
    }
}

export const DEFAULT_NETWORK = 'devnet'

export const getNetworkConfig = (networkId: string): NetworkConfig => {
    return NETWORKS[networkId] || NETWORKS[DEFAULT_NETWORK]
} 