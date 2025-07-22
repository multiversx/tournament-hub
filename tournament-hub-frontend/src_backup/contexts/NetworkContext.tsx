import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { NETWORKS, NetworkConfig, DEFAULT_NETWORK } from '../config/networks'
import { getSmartContractService } from '../services/smartContractService'

interface NetworkContextType {
    currentNetwork: NetworkConfig
    availableNetworks: NetworkConfig[]
    setNetwork: (networkId: string) => void
    isLoading: boolean
    error: string | null
    clearError: () => void
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined)

export const useNetwork = () => {
    const context = useContext(NetworkContext)
    if (context === undefined) {
        throw new Error('useNetwork must be used within a NetworkProvider')
    }
    return context
}

interface NetworkProviderProps {
    children: ReactNode
}

export const NetworkProvider: React.FC<NetworkProviderProps> = ({ children }) => {
    const [currentNetwork, setCurrentNetwork] = useState<NetworkConfig>(NETWORKS[DEFAULT_NETWORK])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const availableNetworks = Object.values(NETWORKS)

    const setNetwork = (networkId: string) => {
        try {
            setError(null)
            setIsLoading(true)

            if (!NETWORKS[networkId]) {
                throw new Error(`Network ${networkId} not found`)
            }

            const newNetwork = NETWORKS[networkId]
            setCurrentNetwork(newNetwork)

            // Update smart contract service with new network
            getSmartContractService(networkId)

            // Save to localStorage
            localStorage.setItem('selectedNetwork', networkId)

            console.log(`Network changed to: ${newNetwork.name}`)
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to change network'
            setError(errorMessage)
            console.error('Network change failed:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const clearError = () => setError(null)

    // Load saved network on mount
    useEffect(() => {
        const savedNetwork = localStorage.getItem('selectedNetwork')
        if (savedNetwork && NETWORKS[savedNetwork]) {
            setCurrentNetwork(NETWORKS[savedNetwork])
            getSmartContractService(savedNetwork)
        }
    }, [])

    const value: NetworkContextType = {
        currentNetwork,
        availableNetworks,
        setNetwork,
        isLoading,
        error,
        clearError
    }

    return (
        <NetworkContext.Provider value={value}>
            {children}
        </NetworkContext.Provider>
    )
} 