import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useGetIsLoggedIn, useGetAccountInfo, useGetAccount } from 'lib';

interface WalletContextType {
    isConnected: boolean;
    address: string | null;
    connect: () => Promise<void>;
    disconnect: () => void;
    isLoading: boolean;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const useWallet = () => {
    const context = useContext(WalletContext);
    if (context === undefined) {
        throw new Error('useWallet must be used within a WalletProvider');
    }
    return context;
};

interface WalletProviderProps {
    children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
    const isLoggedIn = useGetIsLoggedIn();
    const { address, account } = useGetAccountInfo();
    const { address: accountAddress } = useGetAccount();
    const [isLoading, setIsLoading] = useState(false);

    // Use the existing MultiversX SDK wallet state
    const isConnected = isLoggedIn;
    const walletAddress = address || accountAddress;

    const connect = async () => {
        // This will be handled by the existing MultiversX SDK
        // The user should use the Connect button in the header
        setIsLoading(false);
    };

    const disconnect = () => {
        // This will be handled by the existing MultiversX SDK
        // The user should use the Logout button in the header
    };

    const value: WalletContextType = {
        isConnected,
        address: walletAddress,
        connect,
        disconnect,
        isLoading
    };

    return (
        <WalletContext.Provider value={value}>
            {children}
        </WalletContext.Provider>
    );
}; 