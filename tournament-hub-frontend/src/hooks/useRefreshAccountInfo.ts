import { useState, useEffect, useCallback } from 'react';
import { useGetAccountInfo } from 'lib';

export const useRefreshAccountInfo = () => {
    const { address, account } = useGetAccountInfo();
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const refreshAccountInfo = useCallback(() => {
        setRefreshTrigger(prev => prev + 1);
    }, []);

    // Listen for custom refresh events
    useEffect(() => {
        const handleRefresh = () => {
            refreshAccountInfo();
        };

        window.addEventListener('refreshAccountInfo', handleRefresh);
        return () => window.removeEventListener('refreshAccountInfo', handleRefresh);
    }, [refreshAccountInfo]);

    return {
        address,
        account,
        refreshAccountInfo,
        refreshTrigger
    };
};
