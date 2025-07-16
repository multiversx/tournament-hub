import { Link, useLocation } from 'react-router-dom'
import { useWallet } from '../contexts/WalletContext'
import { useNetwork } from '../contexts/NetworkContext'
import { Trophy, Wallet, Home, Settings, ChevronDown, Globe, Loader2 } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'

const Navbar = () => {
    const { isConnected, address, connect, disconnect, walletType, error, clearError, isLoading } = useWallet()
    const { currentNetwork, availableNetworks, setNetwork, isLoading: networkLoading, error: networkError, clearError: clearNetworkError } = useNetwork()
    const location = useLocation()
    const [showWalletMenu, setShowWalletMenu] = useState(false)
    const [showNetworkMenu, setShowNetworkMenu] = useState(false)
    const walletMenuRef = useRef<HTMLDivElement>(null)
    const networkMenuRef = useRef<HTMLDivElement>(null)

    // Close menus when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (walletMenuRef.current && !walletMenuRef.current.contains(event.target as Node)) {
                setShowWalletMenu(false)
            }
            if (networkMenuRef.current && !networkMenuRef.current.contains(event.target as Node)) {
                setShowNetworkMenu(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    const navItems = [
        { path: '/', label: 'Home', icon: Home },
        { path: '/tournaments', label: 'Tournaments', icon: Trophy },
        { path: '/admin', label: 'Admin', icon: Settings },
    ]

    const formatAddress = (addr: string) => {
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`
    }

    const handleWalletConnect = async (walletType: 'xportal' | 'defi' | 'web' | 'development') => {
        try {
            console.log('🎯 Wallet connect button clicked for type:', walletType)
            console.log('📞 Calling connect function...')
            await connect(walletType)
            console.log('✅ Connect function completed successfully')
            setShowWalletMenu(false)
        } catch (error) {
            // Error is handled by the wallet context
            console.error('❌ Wallet connection failed:', error)
        }
    }

    return (
        <nav className="bg-white shadow-sm border-b border-gray-200">
            <div className="container mx-auto px-4">
                <div className="flex justify-between items-center h-16">
                    {/* Logo and Navigation */}
                    <div className="flex items-center space-x-8">
                        <Link to="/" className="flex items-center space-x-2">
                            <Trophy className="h-8 w-8 text-primary-600" />
                            <span className="text-xl font-bold text-gray-900">Tournament Hub</span>
                        </Link>

                        <div className="hidden md:flex space-x-6">
                            {navItems.map((item) => {
                                const Icon = item.icon
                                const isActive = location.pathname === item.path
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive
                                            ? 'text-primary-600 bg-primary-50'
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                            }`}
                                    >
                                        <Icon className="h-4 w-4" />
                                        <span>{item.label}</span>
                                    </Link>
                                )
                            })}
                        </div>
                    </div>

                    {/* Network Selection and Wallet Connection */}
                    <div className="flex items-center space-x-4">
                        {/* Network Error Message */}
                        {networkError && (
                            <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm max-w-xs">
                                <div className="flex justify-between items-center">
                                    <span>{networkError}</span>
                                    <button
                                        onClick={clearNetworkError}
                                        className="ml-2 text-red-500 hover:text-red-700"
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Wallet Error Message */}
                        {error && (
                            <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm max-w-xs">
                                <div className="flex justify-between items-center">
                                    <span>{error}</span>
                                    <button
                                        onClick={clearError}
                                        className="ml-2 text-red-500 hover:text-red-700"
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Network Selector */}
                        <div className="relative" ref={networkMenuRef}>
                            <button
                                onClick={() => setShowNetworkMenu(!showNetworkMenu)}
                                className="btn-secondary flex items-center space-x-2"
                                disabled={networkLoading}
                            >
                                <Globe className="h-4 w-4" />
                                <span>{currentNetwork.name}</span>
                                <ChevronDown className="h-4 w-4" />
                            </button>

                            {showNetworkMenu && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                                    <div className="py-1">
                                        {availableNetworks.map((network) => (
                                            <button
                                                key={network.id}
                                                onClick={() => {
                                                    setNetwork(network.id)
                                                    setShowNetworkMenu(false)
                                                }}
                                                className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${network.id === currentNetwork.id
                                                    ? 'text-primary-600 bg-primary-50'
                                                    : 'text-gray-700'
                                                    }`}
                                            >
                                                {network.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Wallet Connection */}
                        {isConnected ? (
                            <div className="flex items-center space-x-3">
                                <div className="text-sm text-gray-600">
                                    {formatAddress(address!)} ({walletType})
                                </div>
                                <button
                                    onClick={disconnect}
                                    className="btn-secondary text-sm"
                                    disabled={isLoading}
                                >
                                    Disconnect
                                </button>
                            </div>
                        ) : (
                            <div className="relative" ref={walletMenuRef}>
                                <button
                                    onClick={() => {
                                        console.log('🔘 Main Connect Wallet button clicked!')
                                        setShowWalletMenu(!showWalletMenu)
                                    }}
                                    className="btn-primary flex items-center space-x-2"
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Wallet className="h-4 w-4" />
                                    )}
                                    <span>{isLoading ? 'Connecting...' : 'Connect Wallet'}</span>
                                    {!isLoading && <ChevronDown className="h-4 w-4" />}
                                </button>

                                {showWalletMenu && !isLoading && (
                                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                                        <div className="py-1">
                                            <button
                                                onClick={() => handleWalletConnect('development')}
                                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            >
                                                Development Mode
                                            </button>
                                            <button
                                                onClick={() => {
                                                    console.log('🔘 Web Wallet button clicked!')
                                                    handleWalletConnect('web')
                                                }}
                                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            >
                                                Web Wallet
                                            </button>
                                            <button
                                                onClick={() => handleWalletConnect('defi')}
                                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            >
                                                DeFi Wallet
                                            </button>
                                            <button
                                                onClick={() => handleWalletConnect('xportal')}
                                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            >
                                                xPortal Wallet
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    )
}

export default Navbar 