import React from 'react';
import { useWallet } from '../contexts/WalletContext';
import { getAccountProvider } from '@multiversx/sdk-dapp/out/providers/helpers/accountProvider';

const Navbar: React.FC = () => {
    const { isConnected, address, providerType } = useWallet();

    const handleLogin = async () => {
        const provider = getAccountProvider();
        if (!provider) {
            alert('Wallet provider is not initialized yet. Please try again in a moment.');
            return;
        }
        await provider.login(); // No arguments
    };

    const handleLogout = async () => {
        const provider = getAccountProvider();
        await provider.logout();
        window.location.reload(); // Ensure UI updates after logout
    };

    return (
        <nav className="flex items-center justify-between p-4 bg-white shadow">
            <div className="text-xl font-bold">Tournament Hub</div>
            <div>
                {isConnected ? (
                    <div className="flex items-center space-x-4">
                        <span>{address}</span>
                        <span>{providerType}</span>
                        <button className="px-3 py-1 bg-red-500 text-white rounded" onClick={handleLogout}>Logout</button>
                    </div>
                ) : (
                    <button className="px-3 py-1 bg-blue-500 text-white rounded" onClick={handleLogin}>Login</button>
                )}
            </div>
        </nav>
    );
};

export default Navbar; 