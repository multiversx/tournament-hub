# Smart Contract Integration Guide

This guide explains how the Tournament Hub frontend integrates with the MultiversX smart contract for blockchain operations.

## Overview

The frontend now supports:
- **Network Selection**: Switch between devnet, testnet, and mainnet
- **Smart Contract Interactions**: Create, join, and start tournaments on-chain
- **Transaction Management**: Handle transaction signing and status tracking
- **Wallet Integration**: Support for multiple wallet types

## Architecture

### 1. Network Configuration (`src/config/networks.ts`)

Defines network configurations for different MultiversX environments:

```typescript
export interface NetworkConfig {
    id: string
    name: string
    chainId: string
    gateway: string
    api: string
    explorer: string
    contractAddress: string
}
```

**Important**: Update the `contractAddress` in each network configuration with your deployed smart contract address.

### 2. Smart Contract Service (`src/services/smartContractService.ts`)

Handles smart contract interactions using the MultiversX SDK:

- **Contract Initialization**: Creates contract instances with ABI
- **Method Interactions**: Prepares transaction data for contract calls
- **Query Operations**: Reads tournament data from the blockchain

### 3. Blockchain Service (`src/services/blockchainService.ts`)

Manages transaction lifecycle:

- **Transaction Creation**: Builds transactions with proper parameters
- **Transaction Signing**: Integrates with wallet providers
- **Status Tracking**: Monitors transaction status and provides feedback

### 4. Network Context (`src/contexts/NetworkContext.tsx`)

Provides network state management across the application:

- **Network Selection**: Allows users to switch between networks
- **State Persistence**: Saves selected network to localStorage
- **Error Handling**: Manages network-related errors

## Setup Instructions

### 1. Deploy Your Smart Contract

1. Build and deploy your smart contract to the desired network (devnet/testnet/mainnet)
2. Note the contract address after deployment

### 2. Update Contract Addresses

Edit `src/config/networks.ts` and replace the placeholder contract addresses:

```typescript
export const NETWORKS: Record<string, NetworkConfig> = {
    devnet: {
        // ... other config
        contractAddress: 'erd1qqqqqqqqqqqqqpgqhe8t5jewej70zupmh44jurgn29psua5l2jps3nt44g' // YOUR_DEVNET_CONTRACT_ADDRESS
    },
    testnet: {
        // ... other config
        contractAddress: 'erd1qqqqqqqqqqqqqpgqhe8t5jewej70zupmh44jurgn29psua5l2jps3nt44g' // YOUR_TESTNET_CONTRACT_ADDRESS
    },
    mainnet: {
        // ... other config
        contractAddress: 'erd1qqqqqqqqqqqqqpgqhe8t5jewej70zupmh44jurgn29psua5l2jps3nt44g' // YOUR_MAINNET_CONTRACT_ADDRESS
    }
}
```

### 3. Update Smart Contract ABI

Replace the placeholder ABI in `src/services/smartContractService.ts` with your actual smart contract ABI:

```typescript
const CONTRACT_ABI = `
[
    // Your actual smart contract ABI here
    // This should match your deployed contract's interface
]
`
```

### 4. Configure Wallet Integration

The wallet integration supports multiple wallet types:

- **Development Mode**: For testing with mock addresses
- **xPortal Wallet**: Mobile wallet integration
- **DeFi Wallet**: Browser extension wallet
- **Web Wallet**: Web-based wallet

## Usage

### Network Selection

Users can switch between networks using the network selector in the navbar:

1. Click the network dropdown (shows current network)
2. Select desired network (devnet/testnet/mainnet)
3. The application will automatically update to use the new network

### Creating Tournaments

1. Navigate to Admin Panel
2. Connect wallet
3. Fill in tournament details
4. Click "Create Tournament"
5. The system will:
   - Create transaction on blockchain
   - Show transaction status
   - Provide explorer link when complete

### Joining Tournaments

1. Navigate to Tournaments page
2. Select a tournament
3. Click "Join Tournament"
4. Confirm transaction in wallet
5. Wait for transaction confirmation

### Starting Tournaments

1. Navigate to Admin Panel
2. Select tournament to start
3. Click "Start Tournament"
4. Confirm transaction in wallet
5. Monitor transaction status

## Transaction Flow

### 1. Transaction Creation
```typescript
const blockchainService = getBlockchainService(networkId)
const result = await blockchainService.createTournament(params, address, provider)
```

### 2. Transaction Signing
The transaction is signed using the connected wallet provider.

### 3. Transaction Broadcasting
The signed transaction is broadcast to the network.

### 4. Status Tracking
Transaction status is monitored and displayed to the user.

## Error Handling

The system handles various error scenarios:

- **Network Errors**: Connection issues, invalid network
- **Contract Errors**: Invalid parameters, insufficient funds
- **Wallet Errors**: Connection failures, signing rejections
- **Transaction Errors**: Gas limit exceeded, nonce issues

## Development vs Production

### Development Mode
- Uses mock transactions for testing
- Simulates blockchain interactions
- No real network calls

### Production Mode
- Real blockchain transactions
- Actual wallet integration
- Live network interactions

## Testing

### Local Testing
1. Start the development server: `npm run dev`
2. Connect wallet in development mode
3. Test tournament creation/joining
4. Verify transaction simulation

### Network Testing
1. Deploy contract to devnet/testnet
2. Update contract addresses
3. Test with real wallet connection
4. Verify transactions on explorer

## Troubleshooting

### Common Issues

1. **"Smart contract not initialized"**
   - Check contract address configuration
   - Verify ABI matches deployed contract

2. **"Invalid network"**
   - Ensure network configuration is correct
   - Check gateway and API endpoints

3. **"Transaction failed"**
   - Verify sufficient balance for gas fees
   - Check transaction parameters
   - Review contract state

4. **"Wallet connection failed"**
   - Ensure wallet extension is installed
   - Check wallet connection permissions
   - Verify network compatibility

### Debug Information

Enable debug logging by checking browser console for:
- Transaction creation details
- Network configuration
- Contract interaction logs
- Error messages

## Security Considerations

1. **Contract Address Verification**: Always verify contract addresses
2. **Transaction Confirmation**: Require user confirmation for all transactions
3. **Error Handling**: Never expose sensitive information in error messages
4. **Network Validation**: Validate network configuration before transactions

## Future Enhancements

1. **Real-time Updates**: WebSocket integration for transaction status
2. **Batch Transactions**: Support for multiple tournament operations
3. **Advanced Wallet Support**: Additional wallet integrations
4. **Transaction History**: Persistent transaction tracking
5. **Gas Optimization**: Dynamic gas estimation

## Support

For issues or questions:
1. Check the browser console for error messages
2. Verify network and contract configuration
3. Test with development mode first
4. Review MultiversX documentation for SDK usage 