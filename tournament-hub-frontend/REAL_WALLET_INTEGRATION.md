# Real Wallet Integration Guide

This guide explains how to integrate real MultiversX wallets to perform actual blockchain transactions.

## Current Issue

The current implementation uses mock transactions and addresses, which cannot sign real blockchain transactions. To perform actual on-chain operations, you need:

1. **Real Wallet Connection** (xPortal, DeFi Wallet, or Web Wallet)
2. **Private Key Access** for transaction signing
3. **Deployed Smart Contract** with correct address

## Solutions

### Option 1: Use MultiversX dApp SDK (Recommended)

The `@multiversx/sdk-dapp` package provides built-in wallet integration:

```bash
npm install @multiversx/sdk-dapp
```

#### Setup DappProvider

```tsx
import { DappProvider } from '@multiversx/sdk-dapp/wrappers/DappProvider'

function App() {
    return (
        <DappProvider
            environment="devnet"
            customNetworkConfig={{
                name: 'customConfig',
                walletConnectV2ProjectId: 'YOUR_PROJECT_ID'
            }}
        >
            <YourApp />
        </DappProvider>
    )
}
```

#### Use Built-in Hooks

```tsx
import { useGetAccountInfo, useSignTransactions } from '@multiversx/sdk-dapp/hooks'

function TournamentCreator() {
    const { address } = useGetAccountInfo()
    const { signTransactions } = useSignTransactions()

    const createTournament = async () => {
        // Create transaction
        const transaction = {
            receiver: 'YOUR_CONTRACT_ADDRESS',
            value: '0',
            data: 'createTournament@...', // Encoded function call
            gasLimit: 60000000
        }

        // Sign and send
        await signTransactions([transaction])
    }
}
```

### Option 2: Manual Wallet Integration

#### 1. Install Required Packages

```bash
npm install @multiversx/sdk-core @multiversx/sdk-wallet
```

#### 2. Create Wallet Service

```typescript
import { UserSecretKey, UserSigner } from '@multiversx/sdk-wallet'
import { ProxyNetworkProvider, Transaction, Address } from '@multiversx/sdk-core'

class WalletService {
    private signer: UserSigner | null = null
    private provider: ProxyNetworkProvider

    constructor(gateway: string) {
        this.provider = new ProxyNetworkProvider(gateway)
    }

    setPrivateKey(privateKeyHex: string) {
        const secretKey = UserSecretKey.fromPem(privateKeyHex)
        this.signer = UserSigner.fromSecretKey(secretKey)
    }

    async signAndSendTransaction(transaction: Transaction): Promise<string> {
        if (!this.signer) {
            throw new Error('No signer available')
        }

        const signedTx = await this.signer.sign(transaction)
        return await this.provider.sendTransaction(signedTx)
    }
}
```

#### 3. Update Blockchain Service

```typescript
import { getRealBlockchainService } from './realBlockchainService'

// In your component
const blockchainService = getRealBlockchainService('devnet')

// Set private key (from wallet)
blockchainService.setSigner(privateKeyHex)

// Create tournament
const result = await blockchainService.createTournament(params, address)
```

### Option 3: Use Wallet Extensions

#### DeFi Wallet Integration

```typescript
import { ExtensionProvider } from '@multiversx/sdk-extension-provider'

const connectDeFiWallet = async () => {
    const provider = ExtensionProvider.getInstance()
    await provider.init()
    
    const account = await provider.login()
    return account.address
}
```

#### xPortal Integration

```typescript
import { WalletConnectV2Provider } from '@multiversx/sdk-wallet-connect-provider'

const connectXPortal = async () => {
    const provider = new WalletConnectV2Provider({
        projectId: 'YOUR_PROJECT_ID'
    })
    
    await provider.init()
    const account = await provider.login()
    return account.address
}
```

## Implementation Steps

### Step 1: Deploy Your Smart Contract

1. Build your smart contract:
```bash
cd tournament-hub-sc
mxpy contract build
```

2. Deploy to devnet:
```bash
mxpy contract deploy --bytecode=output/tournament_hub.wasm --recall-nonce --gas-limit=60000000 --send --outfile=deploy.json
```

3. Note the contract address from the deployment output.

### Step 2: Update Configuration

Update `src/config/networks.ts` with your deployed contract address:

```typescript
export const NETWORKS: Record<string, NetworkConfig> = {
    devnet: {
        // ... other config
        contractAddress: 'erd1qqqqqqqqqqqqqpgqhe8t5jewej70zupmh44jurgn29psua5l2jps3nt44g' // YOUR_ACTUAL_CONTRACT_ADDRESS
    }
}
```

### Step 3: Update Smart Contract ABI

Replace the ABI in your service with your actual contract ABI:

```typescript
const CONTRACT_ABI = `
[
    // Your actual smart contract ABI here
    // This should match your deployed contract's interface
]
`
```

### Step 4: Test with Real Wallet

1. **Get Test EGLD**: Use the devnet faucet to get test EGLD
2. **Connect Real Wallet**: Use xPortal or DeFi Wallet
3. **Test Transactions**: Create tournaments and verify on explorer

## Testing Checklist

- [ ] Smart contract deployed successfully
- [ ] Contract address updated in config
- [ ] ABI matches deployed contract
- [ ] Wallet connected with real address
- [ ] Account has sufficient EGLD for gas fees
- [ ] Transaction appears on explorer
- [ ] Contract state updated correctly

## Common Issues

### "No signer available"
- Ensure wallet is connected
- Check private key is set correctly
- Verify wallet type supports signing

### "Insufficient funds"
- Add EGLD to test account
- Check gas limit is reasonable
- Verify entry fee amount

### "Contract not found"
- Verify contract address is correct
- Check network configuration
- Ensure contract is deployed to correct network

### "Invalid ABI"
- Update ABI to match deployed contract
- Check function names and parameters
- Verify data types match contract

## Security Considerations

1. **Never expose private keys** in frontend code
2. **Use environment variables** for sensitive data
3. **Validate all inputs** before sending transactions
4. **Test thoroughly** on devnet before mainnet
5. **Use proper error handling** for failed transactions

## Next Steps

1. Choose your preferred wallet integration method
2. Deploy your smart contract to devnet
3. Update configuration with real contract address
4. Test with real wallet connection
5. Implement proper error handling
6. Add transaction status tracking

## Resources

- [MultiversX dApp SDK Documentation](https://docs.multiversx.com/sdk-and-tools/sdk-dapp/)
- [Smart Contract Development Guide](https://docs.multiversx.com/developers/developer-reference/smart-contracts/)
- [Wallet Integration Examples](https://github.com/multiversx/mx-sdk-dapp)
- [Devnet Faucet](https://r3d4.fr/multiversx/devnet) 