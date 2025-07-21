import { Link, useLocation } from 'react-router-dom'
import { useWallet } from '../contexts/WalletContext'
import { useNetwork } from '../contexts/NetworkContext'
import { Trophy, Wallet, Home, Settings, ChevronDown, Globe } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'

const Navbar = () => {
    const { isConnected, address, login, logout, providerType } = useWallet()
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
                                    {formatAddress(address!)} ({providerType})
                                </div>
                                <button
                                    onClick={logout}
                                    className="btn-secondary text-sm"
                                >
                                    Disconnect
                                </button>
                            </div>
                        ) : (
                            <div className="relative" ref={walletMenuRef}>
                                <button
                                    onClick={() => setShowWalletMenu(!showWalletMenu)}
                                    className="btn-primary flex items-center space-x-2"
                                >
                                    <Wallet className="h-4 w-4" />
                                    <span>Connect Wallet</span>
                                    <ChevronDown className="h-4 w-4" />
                                </button>

                                {showWalletMenu && (
                                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                                        <div className="py-1">
                                            <button
                                                onClick={() => { login('web'); setShowWalletMenu(false); }}
                                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            >
                                                <div className="flex flex-col">
                                                    <span className="font-medium">Web Wallet (Keystore)</span>
                                                    <span className="text-xs text-gray-500">Recommended - Use keystore file</span>
                                                </div>
                                            </button>
                                            <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100">
                                                <div className="mb-1">⚠️ PEM method has known issues</div>
                                                <div>Use keystore instead for best compatibility</div>
                                            </div>
                                            <button
                                                onClick={() => { login('extension'); setShowWalletMenu(false); }}
                                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            >
                                                Extension Wallet
                                            </button>
                                            <button
                                                onClick={() => { login('walletconnect'); setShowWalletMenu(false); }}
                                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            >
                                                xPortal (WalletConnect)
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