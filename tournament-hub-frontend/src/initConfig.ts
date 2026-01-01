import './styles/globals.css';

import { walletConnectV2ProjectId } from './config/sharedConfig';
import { EnvironmentsEnum, InitAppType } from './lib';

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