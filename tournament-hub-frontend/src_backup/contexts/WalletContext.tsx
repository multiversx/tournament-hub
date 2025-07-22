import React, { createContext, useContext, ReactNode } from 'react';
import { useGetLoginInfo } from '@multiversx/sdk-dapp/out/react/loginInfo/useGetLoginInfo';
import { useGetAccount } from '@multiversx/sdk-dapp/out/react/account/useGetAccount';

interface WalletContextType {
    isConnected: boolean;
    address: string | null;
    providerType: string | null;
    signTransactions: (transactions: any[]) => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const useWalletHook = () => {
    const context = useContext(WalletContext);
    if (context === undefined) {
        throw new Error('useWallet must be used within a WalletProvider');
    }
    return context;
};

useWalletHook.displayName = 'useWallet';
export const useWallet = useWalletHook;

interface WalletProviderProps {
    children: ReactNode;
}

const WalletProviderComponent: React.FC<WalletProviderProps> = ({ children }) => {
    const { isLoggedIn, providerType } = useGetLoginInfo();
    const { address } = useGetAccount();

    // Placeholder for transaction signing (to be implemented with new flow)
    const signTransactions = async (transactions: any[]) => {
        throw new Error('signTransactions not implemented yet.');
    };

    const value: WalletContextType = {
        isConnected: isLoggedIn,
        address: address || null,
        providerType: providerType || null,
        signTransactions
    };

    return (
        <WalletContext.Provider value={value}>
            {children}
        </WalletContext.Provider>
    );
};

WalletProviderComponent.displayName = 'WalletProvider';
export const WalletProvider = WalletProviderComponent;