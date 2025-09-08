import './styles/globals.css';

import { walletConnectV2ProjectId } from './config/sharedConfig';
import { EnvironmentsEnum, ICustomProvider, InitAppType } from './lib';
import { InMemoryProvider } from './provider/inMemoryProvider';

// Configure providers for MultiversX SDK
const providers: ICustomProvider[] = [
  {
    name: 'In Memory Provider',
    type: 'inMemoryProvider',
    iconUrl: `${window.location.origin}/multiversx-white.svg`,
    constructor: async (options) => new InMemoryProvider(options)
  }
];

export const config: InitAppType = {
  storage: { getStorageCallback: () => sessionStorage },
  dAppConfig: {
    nativeAuth: true,
    environment: EnvironmentsEnum.devnet,
    providers: {
      walletConnect: {
        walletConnectV2ProjectId
      }
    }
  }
};