import { useState, useEffect } from 'react';
import { useGetAccountInfo } from 'lib';
import { getContractAddress } from '../config/contract';
import { Address } from '@multiversx/sdk-core';
import { getUserStatsFromContract, getActiveTournamentIds, getTournamentDetailsFromContract, isTournamentCompletedByEvents } from '../helpers';

// Simple, direct API calls without complex SDK features
const CONTRACT_ADDRESS = getContractAddress();

interface SimpleUserStats {
    gamesPlayed: number;
    losses: number;
    winRate: number;
    tokensWon: number;
    tokensSpent: number;
    netProfit: number;
    tournamentsCreated: number;
    tournamentsWon: number;
    currentStreak: number;
    bestStreak: number;
    teloRating: number;
    loading: boolean;
    error: string | null;
}

interface SimpleTournamentStats {
    totalTournaments: number;
    joiningTournaments: number;
    readyToStartTournaments: number;
    activeTournaments: number;
    completedTournaments: number;
    loading: boolean;
    error: string | null;
}

// Simple API call with basic error handling
async function makeApiCall(endpoint: string, data: any) {
    try {
        console.log(`Making API call to ${endpoint} with data:`, data);
        const response = await fetch(`https://devnet-api.multiversx.com/vm-values/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                scAddress: CONTRACT_ADDRESS,
                funcName: endpoint,
                args: data,
            }),
        });

        console.log(`API response status: ${response.status}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        console.log(`API response data:`, result);
        console.log(`API response returnData:`, result?.data?.data?.returnData);

        // Handle different response formats
        if (result?.data?.data?.returnData) {
            return result.data.data.returnData[0] || null;
        } else if (result?.data?.returnData) {
            return result.data.returnData[0] || null;
        } else if (result?.returnData) {
            return result.returnData[0] || null;
        } else if (result?.data) {
            return result.data[0] || null;
        }

        return null;
    } catch (error) {
        console.error(`API call failed for ${endpoint}:`, error);
        return null;
    }
}

// Test function to check API connectivity
export async function testApiConnectivity() {
    console.log('Testing API connectivity...');
    console.log('Contract address:', CONTRACT_ADDRESS);

    // Test basic contract access
    const result = await makeApiCall('getTournamentStats', []);
    console.log('Test result:', result);

    // Test user stats with a sample address
    const testAddress = 'erd1qqqqqqqqqqqqqpgq9zhclje8g8n6xlsaj0ds6xj87lt4rgtzd8sspxwzu7';
    console.log('=== TEST ADDRESS ENCODING ===');
    console.log('Test address:', testAddress);
    let testHexAddress;
    try {
        const addressObj = Address.fromBech32(testAddress);
        testHexAddress = addressObj.hex();
        console.log('Test encoded address (SDK method):', testHexAddress);
    } catch (error) {
        console.error('Error encoding test address with SDK:', error);
        const addressBytes = Buffer.from(testAddress, 'utf8');
        testHexAddress = addressBytes.toString('hex');
    }
    const userResult = await makeApiCall('getUserStats', [testHexAddress]);
    console.log('User stats test result:', userResult);

    // Test if contract exists by checking a simple view
    try {
        const response = await fetch(`https://devnet-api.multiversx.com/accounts/${CONTRACT_ADDRESS}`);
        const accountData = await response.json();
        console.log('Contract account data:', accountData);
    } catch (error) {
        console.error('Error checking contract account:', error);
    }

    return result;
}

// Make test function available globally
if (typeof window !== 'undefined') {
    (window as any).testApiConnectivity = testApiConnectivity;
}

// Generate tournament stats based on real contract data
function generateTournamentStats(data: { numberOfTournaments: any, activeTournamentIds: any }): Partial<SimpleTournamentStats> {
    try {
        // Parse the number of tournaments from base64 or hex
        let totalTournaments = 0;
        if (data.numberOfTournaments) {
            let cleanData = data.numberOfTournaments;

            // Handle base64 encoded data
            if (cleanData.includes('=') || /^[A-Za-z0-9+/]+$/.test(cleanData)) {
                try {
                    // Decode base64 to get hex string
                    const decoded = atob(cleanData);
                    // Convert each character to its hex representation
                    const hexString = Array.from(decoded).map(char => char.charCodeAt(0).toString(16).padStart(2, '0')).join('');
                    totalTournaments = parseInt(hexString, 16) || 0;
                    console.log('Tournament stats - Parsed base64 data:', cleanData, '-> decoded:', decoded, '-> hex:', hexString, '-> number:', totalTournaments);
                } catch (error) {
                    console.error('Error decoding base64:', error);
                    // Fallback to treating as hex
                    const cleanHex = cleanData.startsWith('0x') ? cleanData.slice(2) : cleanData;
                    totalTournaments = parseInt(cleanHex, 16) || 0;
                }
            } else {
                // Handle hex data
                const cleanHex = cleanData.startsWith('0x') ? cleanData.slice(2) : cleanData;
                totalTournaments = parseInt(cleanHex, 16) || 0;
            }
        }

        // Parse active tournament IDs to get actual count
        let activeCount = 0;
        if (data.activeTournamentIds) {
            let cleanData = data.activeTournamentIds;

            // Handle base64 encoded data
            if (cleanData.includes('=') || /^[A-Za-z0-9+/]+$/.test(cleanData)) {
                try {
                    // Decode base64 to get hex string
                    const decoded = atob(cleanData);
                    // Convert each character to its hex representation
                    const hexString = Array.from(decoded).map(char => char.charCodeAt(0).toString(16).padStart(2, '0')).join('');
                    // Each tournament ID is 8 bytes (16 hex chars), so divide by 16
                    activeCount = Math.floor(hexString.length / 16);
                    console.log('Tournament stats - Parsed active IDs base64:', cleanData, '-> decoded length:', decoded.length, '-> hex length:', hexString.length, '-> active count:', activeCount);
                } catch (error) {
                    console.error('Error decoding active IDs base64:', error);
                    // Fallback to treating as hex
                    const cleanHex = cleanData.startsWith('0x') ? cleanData.slice(2) : cleanData;
                    activeCount = Math.floor(cleanHex.length / 16);
                }
            } else {
                // Handle hex data
                const cleanHex = cleanData.startsWith('0x') ? cleanData.slice(2) : cleanData;
                activeCount = Math.floor(cleanHex.length / 16);
            }
        }

        // Generate realistic distribution based on real data
        const joining = Math.floor(activeCount * 0.3); // 30% joining
        const readyToStart = Math.floor(activeCount * 0.2); // 20% ready to start
        const active = Math.floor(activeCount * 0.3); // 30% active
        const completed = Math.max(0, totalTournaments - activeCount); // Completed = total - active

        return {
            totalTournaments: totalTournaments,
            joiningTournaments: joining,
            readyToStartTournaments: readyToStart,
            activeTournaments: active,
            completedTournaments: completed
        };
    } catch (error) {
        console.error('Error generating tournament stats:', error);
        // Fallback to basic stats
        return {
            totalTournaments: 12,
            joiningTournaments: 4,
            readyToStartTournaments: 2,
            activeTournaments: 3,
            completedTournaments: 3
        };
    }
}

// Note: Mock data generation functions removed - now using real data from smart contract

// Note: parseUserStatsHex function removed - now using the one from helpers/index.ts

function parseTournamentStatsHex(hex: string): Partial<SimpleTournamentStats> | null {
    try {
        if (!hex || hex === '0x') return null;

        // Remove 0x prefix if present
        const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;

        // Try to parse the hex as a number (number of tournaments)
        const totalTournaments = parseInt(cleanHex, 16);

        if (!isNaN(totalTournaments)) {
            // Use real data from contract
            return {
                totalTournaments: totalTournaments,
                joiningTournaments: Math.floor(totalTournaments * 0.3), // Estimate 30% joining
                readyToStartTournaments: Math.floor(totalTournaments * 0.2), // Estimate 20% ready to start
                activeTournaments: Math.floor(totalTournaments * 0.3), // Estimate 30% active
                completedTournaments: Math.floor(totalTournaments * 0.2) // Estimate 20% completed
            };
        }

        // Fallback to mock data if parsing fails
        return {
            totalTournaments: 12,
            joiningTournaments: 4,
            readyToStartTournaments: 2,
            activeTournaments: 3,
            completedTournaments: 3
        };
    } catch (error) {
        console.error('Error parsing tournament stats hex:', error);
        return null;
    }
}

export function useSimpleUserStats() {
    const { address } = useGetAccountInfo();
    console.log('useSimpleUserStats hook called with address:', address);
    const [stats, setStats] = useState<SimpleUserStats>({
        gamesPlayed: 0,
        losses: 0,
        winRate: 0,
        tokensWon: 0,
        tokensSpent: 0,
        netProfit: 0,
        tournamentsCreated: 0,
        tournamentsWon: 0,
        currentStreak: 0,
        bestStreak: 0,
        teloRating: 1500,
        loading: true,
        error: null,
    });

    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const refreshStats = () => {
        setRefreshTrigger(prev => prev + 1);
    };

    useEffect(() => {
        console.log('useEffect triggered for user stats, address:', address);
        const fetchUserStats = async () => {
            if (!address) {
                console.log('No address, skipping user stats fetch');
                setStats(prev => ({ ...prev, loading: false }));
                return;
            }

            try {
                console.log('Starting user stats fetch for address:', address);
                setStats(prev => ({ ...prev, loading: true, error: null }));

                // Get real user stats from smart contract
                const realUserStats = await getUserStatsFromContract(address);
                console.log('Real user stats from contract:', realUserStats);

                if (realUserStats) {
                    // Calculate correct values from smart contract data
                    const losses = realUserStats.losses || 0;
                    const tournamentsWon = realUserStats.tournaments_won || 0;
                    const gamesPlayed = losses + tournamentsWon; // Calculate correct games played
                    const winRate = gamesPlayed > 0 ? (tournamentsWon / gamesPlayed) * 100 : 0; // Calculate correct win rate

                    setStats(prev => ({
                        ...prev,
                        gamesPlayed,
                        losses,
                        winRate,
                        tokensWon: realUserStats.tokens_won,
                        tokensSpent: realUserStats.tokens_spent,
                        netProfit: realUserStats.net_profit,
                        tournamentsCreated: realUserStats.tournaments_created,
                        tournamentsWon,
                        currentStreak: realUserStats.current_streak,
                        bestStreak: realUserStats.best_streak,
                        teloRating: realUserStats.telo_rating || 1500,
                        loading: false,
                        error: null,
                    }));
                } else {
                    // Fallback to default stats if no data found
                    console.log('No user stats found, using default values');
                    setStats(prev => ({
                        ...prev,
                        gamesPlayed: 0,
                        losses: 0,
                        winRate: 0,
                        tokensWon: 0,
                        tokensSpent: 0,
                        netProfit: 0,
                        tournamentsCreated: 0,
                        tournamentsWon: 0,
                        currentStreak: 0,
                        bestStreak: 0,
                        teloRating: 1500,
                        loading: false,
                        error: null,
                    }));
                }
            } catch (error) {
                console.error('Error fetching user stats:', error);
                setStats(prev => ({
                    ...prev,
                    loading: false,
                    error: 'Failed to load user stats',
                }));
            }
        };

        fetchUserStats();
    }, [address, refreshTrigger]);

    // Auto-refresh every 10 seconds to keep TELO updated
    useEffect(() => {
        if (!address) return;

        const interval = setInterval(() => {
            console.log('Auto-refreshing user stats...');
            setRefreshTrigger(prev => prev + 1);
        }, 10000); // 10 seconds

        return () => clearInterval(interval);
    }, [address]);

    // Listen for transaction completion events to refresh stats
    useEffect(() => {
        const handleTransactionComplete = () => {
            console.log('Transaction completed, refreshing user stats...');
            setRefreshTrigger(prev => prev + 1);
        };

        window.addEventListener('transactionComplete', handleTransactionComplete);
        window.addEventListener('refreshUserStats', handleTransactionComplete);

        return () => {
            window.removeEventListener('transactionComplete', handleTransactionComplete);
            window.removeEventListener('refreshUserStats', handleTransactionComplete);
        };
    }, []);

    return { ...stats, refreshStats };
}

export function useSimpleTournamentStats() {
    console.log('useSimpleTournamentStats hook called');
    const [stats, setStats] = useState<SimpleTournamentStats>({
        totalTournaments: 0,
        joiningTournaments: 0,
        readyToStartTournaments: 0,
        activeTournaments: 0,
        completedTournaments: 0,
        loading: true,
        error: null,
    });

    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const refreshStats = () => {
        setRefreshTrigger(prev => prev + 1);
    };

    useEffect(() => {
        console.log('useEffect triggered for tournament stats');
        const fetchTournamentStats = async () => {
            try {
                console.log('Starting tournament stats fetch with real data');
                setStats(prev => ({ ...prev, loading: true, error: null }));

                // Get all tournament IDs
                const activeIds = await getActiveTournamentIds();
                console.log('Active tournament IDs:', activeIds);

                if (!activeIds || activeIds.length === 0) {
                    console.log('No active tournaments found');
                    setStats(prev => ({
                        ...prev,
                        totalTournaments: 0,
                        joiningTournaments: 0,
                        readyToStartTournaments: 0,
                        activeTournaments: 0,
                        completedTournaments: 0,
                        loading: false,
                        error: null,
                    }));
                    return;
                }

                // Fetch details for all tournaments
                const tournamentPromises = activeIds.map(id =>
                    getTournamentDetailsFromContract(id).catch(() => null)
                );
                const tournaments = await Promise.all(tournamentPromises);
                const validTournaments = tournaments.filter(t => t !== null);


                // Count tournaments by status
                let joiningCount = 0;
                let readyToStartCount = 0;
                let activeCount = 0;
                let completedCount = 0;

                // Check each tournament's status
                for (const tournament of validTournaments) {
                    if (tournament && tournament.status === 0) joiningCount++;
                    else if (tournament && tournament.status === 1) readyToStartCount++;
                    else if (tournament && tournament.status === 2) activeCount++;
                    else if (tournament && tournament.status === 4) completedCount++;
                }

                // Check for completed tournaments among fallback tournaments
                const fallbackTournaments = activeIds.filter(id =>
                    !validTournaments.some(t => t && Number((t as any).id) === Number(id))
                );


                const fallbackCompletionChecks = await Promise.all(
                    fallbackTournaments.map(async (id) => {
                        const isCompleted = await isTournamentCompletedByEvents(id);
                        return { id, isCompleted };
                    })
                );

                const completedFallbacks = fallbackCompletionChecks.filter(({ isCompleted }) => isCompleted);
                completedCount += completedFallbacks.length;


                const totalTournaments = activeIds.length;
                const finalStats = {
                    totalTournaments,
                    joiningTournaments: joiningCount,
                    readyToStartTournaments: readyToStartCount,
                    activeTournaments: activeCount,
                    completedTournaments: completedCount,
                };

                console.log('Final tournament stats:', finalStats);

                setStats(prev => ({
                    ...prev,
                    ...finalStats,
                    loading: false,
                    error: null,
                }));
            } catch (error) {
                console.error('Error fetching tournament stats:', error);
                setStats(prev => ({
                    ...prev,
                    loading: false,
                    error: 'Failed to load tournament stats',
                }));
            }
        };

        fetchTournamentStats();
    }, [refreshTrigger]);

    // DISABLED: Auto-refresh every 30 seconds - using event-based system instead
    // useEffect(() => {
    //     const interval = setInterval(() => {
    //         console.log('Auto-refreshing tournament stats...');
    //         setRefreshTrigger(prev => prev + 1);
    //     }, 30000); // 30 seconds
    //
    //     return () => clearInterval(interval);
    // }, []);

    return { ...stats, refreshStats };
}
