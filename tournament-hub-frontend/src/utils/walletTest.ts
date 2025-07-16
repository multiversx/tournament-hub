import { Address } from '@multiversx/sdk-core'

// Test utility for wallet integration
export const testWalletIntegration = () => {
    console.log('🧪 Testing Wallet Integration...')

    // Test address validation
    const testAddress = 'erd1q7nr9d208slu2mjg3zph2puxlxasld8x95ty9crszwlczxmss30qd3t2tn'
    const invalidAddress = 'invalid-address'

    try {
        new Address(testAddress)
        console.log('✅ Valid address test passed')
    } catch (error) {
        console.error('❌ Valid address test failed:', error)
    }

    try {
        new Address(invalidAddress)
        console.error('❌ Invalid address test failed - should have thrown error')
    } catch (error) {
        console.log('✅ Invalid address test passed - correctly threw error')
    }

    // Test wallet types
    const walletTypes = ['development', 'xportal', 'defi', 'web'] as const
    console.log('📋 Available wallet types:', walletTypes)

    // Test environment
    console.log('🌐 Environment:', process.env.NODE_ENV || 'unknown')
    console.log('🔗 Origin:', window.location.origin)

    console.log('✅ Wallet integration test completed')
}

// Utility to check if wallet is available
export const checkWalletAvailability = () => {
    const availability = {
        xportal: false,
        defi: false,
        web: true // Web wallet is always available
    }

    // Check for DeFi Wallet extension
    if (typeof window !== 'undefined' && (window as any).elrondWallet) {
        availability.defi = true
        console.log('✅ DeFi Wallet extension detected')
    }

    // Check for xPortal (WalletConnect)
    if (typeof window !== 'undefined' && (window as any).WalletConnect) {
        availability.xportal = true
        console.log('✅ WalletConnect detected')
    }

    console.log('📊 Wallet availability:', availability)
    return availability
} 