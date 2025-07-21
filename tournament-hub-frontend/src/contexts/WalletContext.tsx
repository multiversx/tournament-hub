import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { WalletProvider as WebWalletProvider } from '@multiversx/sdk-web-wallet-provider';
import { Transaction, Address } from '@multiversx/sdk-core';

// Wallet context type
interface WalletContextType {
    isConnected: boolean;
    address: string | null;
    login: (providerType?: 'web' | 'extension' | 'walletconnect') => Promise<void>;
    logout: () => Promise<void>;
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

// Add display name for React Fast Refresh compatibility
useWalletHook.displayName = 'useWallet';

// Export the hook
export const useWallet = useWalletHook;

interface WalletProviderProps {
    children: ReactNode;
}

const WalletProviderComponent: React.FC<WalletProviderProps> = ({ children }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [address, setAddress] = useState<string | null>(null);
    const [providerType, setProviderType] = useState<string | null>(null);
    const [webWalletProvider, setWebWalletProvider] = useState<WebWalletProvider | null>(null);

    // Initialize providers
    useEffect(() => {
        // Initialize Web Wallet Provider - use devnet since we're on devnet
        const webProvider = new WebWalletProvider('https://devnet-wallet.multiversx.com');
        setWebWalletProvider(webProvider);

        // Check for existing connection on mount
        checkExistingConnection();
    }, []);

    // Check for existing wallet connection
    const checkExistingConnection = async () => {
        // Check URL parameters for wallet callback
        const urlParams = new URLSearchParams(window.location.search);
        const walletAddress = urlParams.get('address');
        const walletSignature = urlParams.get('signature');
        const walletProvider = urlParams.get('provider');
        const status = urlParams.get('status');

        // --- NEW: Detect signed transaction callback ---
        if (urlParams.has('signature[0]') && urlParams.has('receiver[0]')) {
            // Extract all transaction fields
            const signedTx = {
                nonce: urlParams.get('nonce[0]'),
                value: urlParams.get('value[0]'),
                receiver: urlParams.get('receiver[0]'),
                sender: urlParams.get('sender[0]'),
                gasPrice: urlParams.get('gasPrice[0]'),
                gasLimit: urlParams.get('gasLimit[0]'),
                data: urlParams.get('data[0]'),
                chainID: urlParams.get('chainID[0]'),
                version: urlParams.get('version[0]'),
                signature: urlParams.get('signature[0]')
            };
            console.log('🔵 Extracted signed transaction from URL:', signedTx);

            // Broadcast the transaction
            try {
                // Log the signed transaction as extracted from the URL
                console.log('Extracted signedTx from URL:', signedTx);
                console.log('signedTx (JSON):', JSON.stringify(signedTx, null, 2));

                // Build the payload using all fields as strings, exactly as returned by the wallet
                const txPayload = {
                    nonce: signedTx.nonce,
                    value: signedTx.value,
                    receiver: signedTx.receiver,
                    sender: signedTx.sender,
                    gasPrice: signedTx.gasPrice,
                    gasLimit: signedTx.gasLimit,
                    data: signedTx.data,
                    chainID: signedTx.chainID,
                    version: signedTx.version,
                    signature: signedTx.signature,
                };
                // Log the payload to be sent to the gateway
                console.log('txPayload to gateway:', txPayload);
                console.log('txPayload (JSON):', JSON.stringify(txPayload, null, 2));

                // Compare the two objects
                const keys1 = Object.keys(signedTx);
                const keys2 = Object.keys(txPayload);
                console.log('signedTx keys:', keys1);
                console.log('txPayload keys:', keys2);
                const signedTxAny = signedTx as Record<string, any>;
                const txPayloadAny = txPayload as Record<string, any>;
                for (const key of keys1) {
                    if (signedTxAny[key] !== txPayloadAny[key]) {
                        console.log(`Difference at key "${key}": signedTx="${signedTxAny[key]}", txPayload="${txPayloadAny[key]}"`);
                    }
                }
                console.log('Compare signedTx vs txPayload:', JSON.stringify(signedTx) === JSON.stringify(txPayload) ? 'MATCH' : 'DIFFERENT');

                const response = await fetch('https://devnet-gateway.multiversx.com/transaction/send', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(txPayload)
                });
                console.log('Broadcast response status:', response.status);
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Broadcast error:', errorText);
                    throw new Error(`Broadcast failed: ${response.statusText} - ${errorText}`);
                }
                const result = await response.json();
                console.log('🟢 Broadcast success:', result);
            } catch (error) {
                console.error('🔴 Transaction broadcast error:', error);
            }
            // Clean up URL
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
            return;
        }
        // --- END NEW ---

        console.log('Checking URL parameters:', {
            hasAddress: urlParams.has('address'),
            hasSignature: urlParams.has('signature'),
            hasStatus: urlParams.has('status'),
            address: walletAddress,
            signature: walletSignature,
            status: status,
            provider: walletProvider,
            fullUrl: window.location.href
        });

        // Check if we have a wallet callback
        if (urlParams.has('address') || urlParams.has('signature') || urlParams.has('status')) {
            console.log('Wallet callback detected, processing...');
            console.log('walletAddress:', walletAddress);
            console.log('status:', status);

            // Check if login was successful
            if (walletAddress) {
                console.log('✅ Found wallet address, connecting...');
                // Valid wallet callback with address (signature is optional for Web Wallet)
                setAddress(walletAddress);
                setIsConnected(true);
                setProviderType(walletProvider || 'web');

                // Store in localStorage
                localStorage.setItem('wallet_address', walletAddress);
                localStorage.setItem('wallet_provider', walletProvider || 'web');

                console.log('Wallet connected successfully:', walletAddress);
            } else if (status === 'success' || status === 'signed') {
                // Login successful but no address in URL - this is expected for some Web Wallet flows
                console.log('Web Wallet login successful but no address returned!');
                console.log('⚠️  IMPORTANT: MultiversX Web Wallet does not return the wallet address in the URL for security reasons.');
                console.log('This is a limitation of the Web Wallet approach. For production use, consider:');
                console.log('1. Using WalletConnect (xPortal) instead');
                console.log('2. Using the official MultiversX dApp SDK with DappProvider');
                console.log('3. Implementing a different wallet connection method');

                // For development/testing purposes, we'll use a mock address
                // In production, you would need to implement a different approach
                const mockAddress = 'erd1qqqqqqqqqqqqqpgqhe8t5jewej70zupmh44jurgn29psua5l2jps3nt44x';
                console.log('Using mock address for development:', mockAddress);

                setAddress(mockAddress);
                setIsConnected(true);
                setProviderType(walletProvider || 'web');

                // Store in localStorage
                localStorage.setItem('wallet_address', mockAddress);
                localStorage.setItem('wallet_provider', walletProvider || 'web');

                console.log('Wallet connected with mock address for development purposes');
            } else {
                // Wallet connection was cancelled or failed
                console.log('❌ Wallet connection was cancelled or failed. Status:', status);
                console.log('Debug info - walletAddress:', walletAddress, 'status:', status);
                setIsConnected(false);
                setAddress(null);
                setProviderType(null);
            }

            // Clean up URL regardless of success/failure
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
        } else {
            // Check localStorage for existing connection
            const storedAddress = localStorage.getItem('wallet_address');
            const storedProvider = localStorage.getItem('wallet_provider');

            if (storedAddress && storedProvider) {
                setAddress(storedAddress);
                setProviderType(storedProvider);
                setIsConnected(true);
            }
        }
    };

    // Login handler
    const handleLogin = async (providerType: 'web' | 'extension' | 'walletconnect' = 'web') => {
        try {
            if (providerType === 'web' && webWalletProvider) {
                // Web Wallet login
                const callbackUrl = `${window.location.origin}/?provider=web`;
                console.log('Redirecting to Web Wallet with callback URL:', callbackUrl);
                console.log('⚠️ IMPORTANT: Use KEYSTORE method, not PEM!');
                console.log('PEM method has WalletConnect conflicts and may not work properly.');
                console.log('If you get stuck in the wallet, manually navigate back to:', callbackUrl);
                await webWalletProvider.login({ callbackUrl });
            } else if (providerType === 'walletconnect') {
                // Temporarily disable WalletConnect to avoid conflicts with Web Wallet
                console.log('WalletConnect temporarily disabled to avoid conflicts with Web Wallet');
                console.log('Please use Web Wallet (keystore) method instead');
                throw new Error('WalletConnect temporarily disabled. Use Web Wallet (keystore) method.');
            } else if (providerType === 'extension') {
                // Extension login (you'll need to implement this)
                console.log('Extension login not implemented yet');
                throw new Error('Extension login not implemented yet');
            } else {
                throw new Error('Provider not available');
            }
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    };

    // Transaction signing handler
    const handleSignTransactions = async (transactions: any[]) => {
        try {
            if (!webWalletProvider) {
                throw new Error('Wallet provider not available');
            }

            console.log('🔵 Starting transaction signing process...');
            console.log('Transactions to sign:', transactions);

            // Convert plain objects to Transaction objects if needed
            const transactionObjects = transactions.map(tx => {
                if (tx instanceof Transaction) {
                    return tx;
                } else {
                    console.log('Converting plain object to Transaction:', tx);

                    // Handle data encoding properly
                    let dataBytes: Uint8Array;
                    if (typeof tx.data === 'string') {
                        // If data is a hex string, convert it to bytes
                        if (tx.data.startsWith('0x')) {
                            dataBytes = new Uint8Array(Buffer.from(tx.data.slice(2), 'hex'));
                        } else {
                            // If it's a plain string, encode it
                            dataBytes = new TextEncoder().encode(tx.data);
                        }
                    } else if (tx.data instanceof Uint8Array) {
                        dataBytes = tx.data;
                    } else {
                        dataBytes = new Uint8Array();
                    }

                    const transaction = new Transaction({
                        sender: new Address(tx.sender),
                        receiver: new Address(tx.receiver),
                        value: BigInt(tx.value || '0'),
                        gasLimit: BigInt(tx.gasLimit || 60000000),
                        data: dataBytes,
                        chainID: tx.chainID || 'D', // Devnet
                        nonce: tx.nonce
                    });

                    console.log('Created Transaction object:', {
                        sender: transaction.sender.toString(),
                        receiver: transaction.receiver.toString(),
                        value: transaction.value.toString(),
                        gasLimit: transaction.gasLimit.toString(),
                        dataLength: transaction.data.length,
                        chainID: transaction.chainID,
                        nonce: transaction.nonce
                    });

                    return transaction;
                }
            });

            // Sign one transaction at a time
            for (let i = 0; i < transactionObjects.length; i++) {
                const transaction = transactionObjects[i];
                console.log(`🔵 Signing transaction ${i + 1}/${transactionObjects.length}:`, transaction);

                try {
                    // Clear any existing URL parameters
                    const cleanUrl = window.location.pathname;
                    window.history.replaceState({}, document.title, cleanUrl);

                    // Sign the transaction with callback
                    const callbackUrl = `${window.location.origin}/?provider=web&action=sign&txIndex=${i}`;
                    console.log('🔵 Redirecting to wallet with callback URL:', callbackUrl);

                    await webWalletProvider.signTransaction(transaction, {
                        callbackUrl: callbackUrl
                    });

                    console.log('🔵 Transaction sent to wallet for signing...');
                    console.log('🔵 Waiting for user to sign in wallet...');
                    console.log('🔵 After signing, you should be redirected back to the app');

                    // Wait for the callback to be processed
                    // We'll check for the callback in the URL change handler
                    await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => {
                            reject(new Error('Transaction signing timeout - user may not have signed'));
                        }, 60000); // 60 second timeout

                        const checkCallback = () => {
                            const urlParams = new URLSearchParams(window.location.search);
                            if (urlParams.get('provider') === 'web' && urlParams.get('action') === 'sign') {
                                clearTimeout(timeout);
                                resolve(true);
                            }
                        };

                        // Check immediately
                        checkCallback();

                        // Set up interval to check
                        const interval = setInterval(() => {
                            checkCallback();
                        }, 1000);

                        // Clean up interval on timeout
                        setTimeout(() => {
                            clearInterval(interval);
                        }, 60000);
                    });

                    console.log('🔵 Callback received, processing signed transaction...');

                    // Check for signed transaction in URL
                    const signedTransactions = webWalletProvider.getTransactionsFromWalletUrl();
                    console.log('🔵 Signed transactions from URL:', signedTransactions);

                    if (signedTransactions && signedTransactions.length > 0) {
                        const signedTx = signedTransactions[0];
                        console.log('🔵 Found signed transaction:', signedTx);

                        // Broadcast the transaction
                        const txPayload = {
                            nonce: Number(signedTx.nonce),
                            value: signedTx.value, // keep as string
                            receiver: signedTx.receiver,
                            sender: signedTx.sender,
                            gasPrice: Number(signedTx.gasPrice),
                            gasLimit: Number(signedTx.gasLimit),
                            data: signedTx.data,
                            chainID: signedTx.chainID,
                            version: Number(signedTx.version),
                            signature: signedTx.signature
                        };
                        console.log('Final txPayload.data (should be base64):', txPayload.data);
                        console.log('typeof txPayload.value (right before fetch):', typeof txPayload.value, txPayload.value);
                        console.log('Full txPayload:', JSON.stringify(txPayload, null, 2));
                        // Debug: log types and values of numeric fields right before fetch
                        console.log('REACHED FETCH');
                        console.log('typeof txPayload.nonce:', typeof txPayload.nonce, txPayload.nonce);
                        console.log('typeof txPayload.gasPrice:', typeof txPayload.gasPrice, txPayload.gasPrice);
                        console.log('typeof txPayload.gasLimit:', typeof txPayload.gasLimit, txPayload.gasLimit);
                        console.log('typeof txPayload.version:', typeof txPayload.version, txPayload.version);
                        console.log('typeof txPayload.value:', typeof txPayload.value, txPayload.value);
                        console.log('Final txPayload:', JSON.stringify(txPayload, null, 2));

                        console.log('🔵 Broadcasting transaction payload:', txPayload);
                        console.log('Payload to gateway:', JSON.stringify(txPayload, null, 2));

                        const response = await fetch('https://devnet-gateway.multiversx.com/transaction/send', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(txPayload)
                        });

                        console.log('🔵 Broadcast response status:', response.status);

                        if (!response.ok) {
                            const errorText = await response.text();
                            console.error('🔴 Broadcast error:', errorText);
                            throw new Error(`Broadcast failed: ${response.statusText} - ${errorText}`);
                        }

                        const result = await response.json();
                        console.log('🟢 Broadcast success:', result);

                        // Clean up URL
                        const newUrl = window.location.pathname;
                        window.history.replaceState({}, document.title, newUrl);

                        console.log('🟢 Transaction successfully signed and broadcasted!');
                        return; // Success, exit early
                    } else {
                        console.log('🔴 No signed transaction found in URL');
                        console.log('🔴 This might indicate the wallet did not return the signed transaction');
                        console.log('🔴 URL parameters:', new URLSearchParams(window.location.search).toString());
                    }
                } catch (signError) {
                    console.error('🔴 Error signing transaction:', signError);
                    throw signError;
                }
            }

            console.log('🔴 No transactions were successfully signed and broadcasted');
            throw new Error('Failed to sign and broadcast any transactions');
        } catch (error) {
            console.error('🔴 Transaction signing error:', error);
            throw error;
        }
    };

    // Logout handler
    const handleLogout = async () => {
        try {
            if (providerType === 'web' && webWalletProvider) {
                const callbackUrl = `${window.location.origin}${window.location.pathname}`;
                await webWalletProvider.logout({ callbackUrl });
            }

            // Clear stored wallet data
            localStorage.removeItem('wallet_address');
            localStorage.removeItem('wallet_provider');

            setIsConnected(false);
            setAddress(null);
            setProviderType(null);
        } catch (error) {
            console.error('Logout error:', error);
            throw error;
        }
    };

    // Listen for URL changes (for wallet callbacks)
    useEffect(() => {
        const handleUrlChange = () => {
            const urlParams = new URLSearchParams(window.location.search);

            // Check if this is a transaction signing callback
            if (urlParams.get('provider') === 'web' && urlParams.get('action') === 'sign') {
                console.log('🔵 Transaction signing callback detected');
                // The transaction signing flow will handle this
                return;
            }

            // Check for regular wallet connection callback
            checkExistingConnection();
        };

        window.addEventListener('popstate', handleUrlChange);

        // Also check for manual redirects (useful for PEM method)
        const checkManualRedirect = () => {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.has('provider') && urlParams.get('provider') === 'web') {
                if (urlParams.get('action') === 'sign') {
                    console.log('🔵 Manual transaction signing redirect detected');
                    // The transaction signing flow will handle this
                    return;
                }
                console.log('Manual redirect detected, checking for wallet connection...');
                checkExistingConnection();
            }
        };

        // Check immediately on mount
        checkManualRedirect();

        return () => window.removeEventListener('popstate', handleUrlChange);
    }, []);

    const value: WalletContextType = {
        isConnected,
        address,
        login: handleLogin,
        logout: handleLogout,
        providerType,
        signTransactions: handleSignTransactions
    };

    return (
        <WalletContext.Provider value={value}>
            {children}
        </WalletContext.Provider>
    );
};

// Add display name for React Fast Refresh compatibility
WalletProviderComponent.displayName = 'WalletProvider';

// Export the component
export const WalletProvider = WalletProviderComponent;

// Helper to base64 encode a string
function toBase64(str: string) {
    return window.btoa(unescape(encodeURIComponent(str)));
}