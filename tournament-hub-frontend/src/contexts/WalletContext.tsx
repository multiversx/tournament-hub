import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { WalletProvider as MultiversXWalletProvider } from '@multiversx/sdk-web-wallet-provider'
import { ProxyNetworkProvider } from '@multiversx/sdk-network-providers'

// Extend Window interface for MultiversX wallet
declare global {
    interface Window {
        elrondWallet?: any
    }
}

// Wallet types for different MultiversX wallets
type WalletType = 'xportal' | 'defi' | 'web' | 'development'

interface WalletContextType {
    isConnected: boolean
    address: string | null
    connect: (walletType?: WalletType) => Promise<void>
    disconnect: () => void
    provider: MultiversXWalletProvider | null
    walletType: WalletType | null
    error: string | null
    clearError: () => void
    isLoading: boolean
    accessToken?: string | null
    signTransactions: (transactions: any[]) => Promise<void>
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export const useWallet = () => {
    const context = useContext(WalletContext)
    if (context === undefined) {
        throw new Error('useWallet must be used within a WalletProvider')
    }
    return context
}

interface WalletProviderProps {
    children: ReactNode
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
    const [isConnected, setIsConnected] = useState(false)
    const [address, setAddress] = useState<string | null>(null)
    const [provider, setProvider] = useState<MultiversXWalletProvider | null>(null)
    const [walletType, setWalletType] = useState<WalletType | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [accessToken, setAccessToken] = useState<string | null>(null)

    const clearError = () => setError(null)

    const signTransactions = async (transactions: any[]) => {
        if (!provider) {
            throw new Error('No wallet provider available')
        }

        try {
            console.log('Signing transactions:', transactions)
            const signedTransactions = await provider.signTransactions(transactions)
            console.log('Transactions signed successfully:', signedTransactions)

            // Send the signed transactions
            const networkProvider = new ProxyNetworkProvider('https://devnet-gateway.multiversx.com')
            if (Array.isArray(signedTransactions)) {
                for (const signedTx of signedTransactions) {
                    const txHash = await networkProvider.sendTransaction(signedTx)
                    console.log('Transaction sent with hash:', txHash)
                }
            } else {
                console.warn('No signed transactions returned from provider')
            }
        } catch (error) {
            console.error('Failed to sign transactions:', error)
            throw new Error('Failed to sign transactions. Please try again.')
        }
    }

    const connect = async (walletTypeParam: WalletType = 'web') => {
        try {
            setError(null)
            setIsLoading(true)
            setWalletType(walletTypeParam)

            switch (walletTypeParam) {
                case 'development':
                    // For development, we'll use a valid test address
                    const testAddress = 'erd1q7nr9d208slu2mjg3zph2puxlxa5ld8x95ty9crszwlczxmss30qd3t2tn'
                    setAddress(testAddress)
                    setIsConnected(true)
                    setAccessToken(null)
                    console.log('Wallet connected (development mode):', testAddress)
                    break

                case 'web':
                    // Web Wallet integration
                    try {
                        console.log('🔗 Starting Web Wallet connection...')
                        const webWalletProvider = new MultiversXWalletProvider('https://wallet.multiversx.com')
                        console.log('✅ Web Wallet provider created')
                        setProvider(webWalletProvider)

                        const callbackUrl = window.location.origin
                        console.log('📍 Callback URL:', callbackUrl)
                        console.log('🔄 Redirecting to Web Wallet for login...')

                        await webWalletProvider.login({
                            callbackUrl
                        })
                        console.log('✅ Web Wallet login initiated successfully')

                        // After redirect, the address will be set by the useEffect below
                    } catch (error) {
                        console.error('❌ Failed to connect Web Wallet:', error)
                        throw new Error('Failed to connect Web Wallet. Please try again.')
                    }
                    break

                case 'defi':
                    // DeFi Wallet integration (similar to Web Wallet)
                    try {
                        console.log('Connecting to DeFi Wallet...')
                        const defiWalletProvider = new MultiversXWalletProvider('https://wallet.multiversx.com')
                        setProvider(defiWalletProvider)

                        const callbackUrl = window.location.origin
                        console.log('Redirecting to DeFi Wallet for login...')

                        await defiWalletProvider.login({
                            callbackUrl
                        })

                        // After redirect, the address will be set by the useEffect below
                    } catch (error) {
                        console.error('Failed to connect DeFi Wallet:', error)
                        throw new Error('Failed to connect DeFi Wallet. Please try again.')
                    }
                    break

                case 'xportal':
                    // xPortal wallet integration (placeholder for now)
                    try {
                        console.log('Connecting to xPortal...')
                        // xPortal requires WalletConnect V2 setup which is more complex
                        // For now, we'll use a placeholder
                        const placeholderAddress = 'erd1q7nr9d208slu2mjg3zph2puxlxa5ld8x95ty9crszwlczxmss30qd3t2tn'
                        setAddress(placeholderAddress)
                        setIsConnected(true)
                        setAccessToken(null)
                        console.log('xPortal connected (placeholder):', placeholderAddress)
                        console.log('Note: Full xPortal integration requires WalletConnect V2 setup')
                    } catch (error) {
                        console.error('Failed to connect xPortal:', error)
                        throw new Error('xPortal integration not yet fully implemented. Please use Web Wallet or DeFi Wallet.')
                    }
                    break

                default:
                    throw new Error('Unsupported wallet type')
            }
        } catch (error) {
            console.error('Failed to connect wallet:', error)
            const errorMessage = error instanceof Error ? error.message : 'Failed to connect wallet'
            setError(errorMessage)
            throw error
        } finally {
            setIsLoading(false)
        }
    }

    const disconnect = () => {
        setIsConnected(false)
        setAddress(null)
        setProvider(null)
        setWalletType(null)
        setError(null)
        setAccessToken(null)
        // Clean up URL parameters
        window.history.replaceState({}, document.title, window.location.pathname)
        console.log('Wallet disconnected')
    }

    useEffect(() => {
        console.log('🔍 Checking for wallet callback...')
        console.log('📍 Current URL:', window.location.href)

        const params = new URLSearchParams(window.location.search);
        const walletAddress = params.get('address');

        console.log('📋 URL Parameters:', Object.fromEntries(params.entries()))
        console.log('🏠 Wallet Address:', walletAddress)

        if (walletAddress && walletAddress.trim() !== '') {
            console.log('✅ Wallet address found, connecting...')
            setAddress(walletAddress);
            setIsConnected(true);
            window.history.replaceState({}, document.title, window.location.pathname);
            console.log('🎉 Wallet connected successfully!')
        } else if (params.has('address')) {
            console.log('❌ Address parameter exists but is empty')
            setError('Wallet connection failed or was cancelled.');
        } else {
            console.log('ℹ️ No wallet callback detected')
        }
    }, []);

    const value: WalletContextType = {
        isConnected,
        address,
        connect,
        disconnect,
        provider,
        walletType,
        error,
        clearError,
        isLoading,
        accessToken,
        signTransactions
    }

    return (
        <WalletContext.Provider value={value}>
            {children}
        </WalletContext.Provider>
    )
}