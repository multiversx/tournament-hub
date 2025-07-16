import { WalletProvider } from '@multiversx/sdk-web-wallet-provider'
import { ProxyNetworkProvider, Address } from '@multiversx/sdk-core'

// Network configuration
export const NETWORK_CONFIG = {
    chainId: 'D', // Devnet
    gatewayUrl: 'https://devnet-gateway.multiversx.com',
    apiUrl: 'https://devnet-api.multiversx.com'
}

// Initialize network provider
export const networkProvider = new ProxyNetworkProvider(NETWORK_CONFIG.gatewayUrl)

// Initialize web wallet provider
export const initializeWebWallet = () => {
    return new WalletProvider('https://web-wallet.multiversx.com')
}

// Helper function to check if web wallet is available
export const isWebWalletAvailable = () => {
    return typeof window !== 'undefined' && (window as any).elrondWallet
}

// Helper function to get account info
export const getAccountInfo = async (address: string) => {
    try {
        const accountAddress = new Address(address)
        const account = await networkProvider.getAccount(accountAddress)
        return account
    } catch (error) {
        console.error('Error getting account info:', error)
        return null
    }
}

// Helper function to get account balance
export const getAccountBalance = async (address: string) => {
    try {
        const accountAddress = new Address(address)
        const account = await networkProvider.getAccount(accountAddress)
        return account.balance
    } catch (error) {
        console.error('Error getting account balance:', error)
        return '0'
    }
} 