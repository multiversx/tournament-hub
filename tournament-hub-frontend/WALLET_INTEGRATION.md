# MultiversX Wallet Integration Guide

This document provides a comprehensive guide for implementing real MultiversX wallet integrations in the Tournament Hub frontend.

## Current Implementation Status

### ✅ Implemented
- **Development Mode**: Uses a valid test address for development and testing
- **Wallet Type Selection**: Dropdown menu to choose between different wallet types
- **Error Handling**: Proper error handling and user feedback
- **Address Validation**: Utility functions to validate MultiversX addresses

### 🔄 Partially Implemented (Placeholders)
- **xPortal Wallet**: Basic structure ready, needs WalletConnect V2 setup
- **DeFi Wallet**: Basic structure ready, needs ExtensionProvider implementation
- **Web Wallet**: Basic structure ready, needs WebWalletProvider implementation

## Wallet Integration Details

### 1. xPortal Wallet Integration

**Current Status**: Placeholder implementation
**Requirements**: WalletConnect V2 setup

**Implementation Steps**:
1. Register your project at [WalletConnect Cloud](https://cloud.walletconnect.com/)
2. Get your Project ID
3. Update the WalletConnectV2Provider configuration:

```typescript
const walletConnectProvider = new WalletConnectV2Provider({
    projectId: 'YOUR_PROJECT_ID',
    chainId: 'D', // MultiversX mainnet
    metadata: {
        name: 'Tournament Hub',
        description: 'MultiversX Tournament Hub DApp',
        url: window.location.origin,
        icons: ['https://your-domain.com/icon.png']
    }
})
```

**User Flow**:
1. User clicks "xPortal Wallet"
2. QR code or deep link is generated
3. User scans QR code or opens link in xPortal
4. User approves connection in xPortal
5. Connection is established

### 2. DeFi Wallet Integration

**Current Status**: Placeholder implementation
**Requirements**: DeFi Wallet browser extension

**Implementation Steps**:
1. Ensure DeFi Wallet extension is installed
2. Use ExtensionProvider for connection:

```typescript
const extensionProvider = new ExtensionProvider()
await extensionProvider.init()
const account = await extensionProvider.connect()
```

**User Flow**:
1. User clicks "DeFi Wallet"
2. DeFi Wallet extension popup appears
3. User approves connection
4. Connection is established

### 3. Web Wallet Integration

**Current Status**: Placeholder implementation
**Requirements**: Web wallet provider setup

**Implementation Steps**:
1. Configure WebWalletProvider:

```typescript
const webWalletProvider = new MultiversXWalletProvider('https://wallet.multiversx.com')
// Note: API may vary based on SDK version
```

**User Flow**:
1. User clicks "Web Wallet"
2. Redirects to MultiversX web wallet
3. User connects wallet
4. Redirects back to app with connection

## Environment Configuration

### Required Environment Variables

Create a `.env` file in the frontend directory:

```env
# WalletConnect Project ID (for xPortal)
VITE_WALLET_CONNECT_PROJECT_ID=your_project_id_here

# Network Configuration
VITE_MULTIVERSX_NETWORK=mainnet # or testnet
VITE_MULTIVERSX_CHAIN_ID=D # for mainnet, T for testnet

# Web Wallet URL
VITE_WEB_WALLET_URL=https://wallet.multiversx.com
```

### Network Configuration

```typescript
// networks.ts
export const NETWORKS = {
    mainnet: {
        chainId: 'D',
        gateway: 'https://gateway.multiversx.com',
        api: 'https://api.multiversx.com',
        explorer: 'https://explorer.multiversx.com'
    },
    testnet: {
        chainId: 'T',
        gateway: 'https://testnet-gateway.multiversx.com',
        api: 'https://testnet-api.multiversx.com',
        explorer: 'https://testnet-explorer.multiversx.com'
    }
}
```

## Testing Wallet Integrations

### Development Testing

1. **Development Mode**: Always works with test address
2. **xPortal Testing**: Use WalletConnect test project
3. **DeFi Wallet Testing**: Install DeFi Wallet extension
4. **Web Wallet Testing**: Use testnet for development

### Production Testing

1. **xPortal**: Test with real xPortal app
2. **DeFi Wallet**: Test with production DeFi Wallet
3. **Web Wallet**: Test with production web wallet

## Error Handling

The current implementation includes comprehensive error handling:

```typescript
try {
    await connect('xportal')
} catch (error) {
    // Error is automatically set in context
    console.error('Connection failed:', error)
}
```

### Common Error Scenarios

1. **Wallet Not Installed**: "Please install xPortal/DeFi Wallet"
2. **Connection Rejected**: "Connection was rejected by user"
3. **Network Issues**: "Network connection failed"
4. **Invalid Address**: "Invalid MultiversX address"

## Security Considerations

### Best Practices

1. **Always validate addresses** before using them
2. **Use HTTPS** in production
3. **Implement proper error handling**
4. **Don't store sensitive data** in localStorage
5. **Use environment variables** for configuration

### Address Validation

```typescript
import { Address } from '@multiversx/sdk-core'

const isValidAddress = (address: string): boolean => {
    try {
        new Address(address)
        return true
    } catch {
        return false
    }
}
```

## Next Steps for Full Implementation

### Priority 1: xPortal Integration
1. Register at WalletConnect Cloud
2. Implement proper WalletConnect V2 flow
3. Add QR code display component
4. Handle connection callbacks

### Priority 2: DeFi Wallet Integration
1. Research ExtensionProvider API
2. Implement extension detection
3. Add connection flow
4. Handle extension events

### Priority 3: Web Wallet Integration
1. Research WebWalletProvider API
2. Implement redirect flow
3. Handle return from web wallet
4. Add connection state management

## Troubleshooting

### Common Issues

1. **WalletConnect URI not generating**: Check project ID and configuration
2. **Extension not detected**: Ensure DeFi Wallet is installed
3. **Web wallet not redirecting**: Check URL configuration
4. **Address validation failing**: Check address format

### Debug Mode

Enable debug logging:

```typescript
// In WalletContext.tsx
const DEBUG = import.meta.env.DEV

if (DEBUG) {
    console.log('Wallet connection attempt:', walletType)
    console.log('Provider:', provider)
    console.log('Address:', address)
}
```

## Resources

- [MultiversX SDK Documentation](https://docs.multiversx.com/sdk-and-tools/sdk-js/)
- [WalletConnect Documentation](https://docs.walletconnect.com/)
- [xPortal Documentation](https://docs.xportal.com/)
- [DeFi Wallet Documentation](https://docs.defiwallet.com/)

## Support

For issues with wallet integration:
1. Check the browser console for errors
2. Verify wallet is properly installed
3. Check network connectivity
4. Review this documentation
5. Create an issue in the project repository 