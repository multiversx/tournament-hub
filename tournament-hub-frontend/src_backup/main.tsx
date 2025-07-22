import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { initApp } from '@multiversx/sdk-dapp/out/methods/initApp/initApp';
import { EnvironmentsEnum } from '@multiversx/sdk-dapp/out/types/enums.types';
import { walletConnectV2ProjectId } from './config/sharedConfig';


console.log('About to call initApp');
initApp({
    dAppConfig: {
        environment: EnvironmentsEnum.devnet
    }
}).then(() => {
    console.log('initApp resolved, rendering app');
    ReactDOM.createRoot(document.getElementById('root')!).render(
        <React.StrictMode>
            <BrowserRouter>
                <App />
            </BrowserRouter>
        </React.StrictMode>
    );
}).catch((err) => {
    console.error('initApp failed:', err);
}); 