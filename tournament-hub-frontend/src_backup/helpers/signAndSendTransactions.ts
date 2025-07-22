import { getAccountProvider } from '@multiversx/sdk-dapp/out/providers/helpers/accountProvider';
import { TransactionManager } from '@multiversx/sdk-dapp/out/managers/TransactionManager';

export const signAndSendTransactions = async (transactions: any[], transactionsDisplayInfo?: any) => {
    const provider = getAccountProvider();
    const txManager = TransactionManager.getInstance();

    const signedTransactions = await provider.signTransactions(transactions);
    const sentTransactions = await txManager.send(signedTransactions);
    const sessionId = await txManager.track(sentTransactions, {
        transactionsDisplayInfo
    });

    return sessionId;
}; 