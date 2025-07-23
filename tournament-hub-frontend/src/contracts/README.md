# Smart Contract ABI Integration

This directory contains the smart contract ABI and related utilities for the Tournament Hub frontend.

## Files

- `tournament-hub.abi.json` - The actual smart contract ABI generated from the Rust contract
- `index.ts` - Contract configuration and utility functions

## Usage

The ABI is automatically copied from the smart contract build output when you run:
- `yarn start-devnet`
- `yarn start-testnet` 
- `yarn start-mainnet`
- `yarn build-devnet`
- `yarn build-testnet`
- `yarn build-mainnet`

Or manually with:
```bash
yarn copy-contract-abi
```

## Contract Utilities

### `tournamentHubContract`
The main contract configuration object containing:
- `address` - Contract address for the current network
- `abi` - The full contract ABI

### Utility Functions

- `getEndpoint(abi, endpointName)` - Get endpoint definition
- `getEndpointInputs(abi, endpointName)` - Get input types for an endpoint
- `isEndpointPayable(abi, endpointName)` - Check if endpoint accepts EGLD payment
- `isEndpointOwnerOnly(abi, endpointName)` - Check if endpoint is owner-only

## Transaction Building

Use the utility functions in `../utils/contractUtils.ts` to build transaction data:

```typescript
import { buildTransactionData, egldToWei } from '../utils/contractUtils';

// Create tournament transaction
const data = buildTransactionData('createTournament', [
  tournamentId,
  gameId,
  egldToWei(entryFee),
  joinDeadline,
  playDeadline
]);
```

## Best Practices

1. **Always use the ABI** - Don't hardcode transaction data
2. **Use utility functions** - For parameter encoding and conversion
3. **Keep ABI updated** - Run `yarn copy-contract-abi` after contract changes
4. **Type safety** - The ABI provides type information for all endpoints 