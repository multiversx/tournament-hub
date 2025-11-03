/**
 * Debug utility for leaderboard loading issues
 * 
 * Usage in browser console:
 * import { debugLeaderboard } from './debug-leaderboard';
 * debugLeaderboard();
 */

import { getAllPlayersStats } from './index';

export async function debugLeaderboard() {
    console.group('🔍 Leaderboard Debug Information');

    try {
        console.log('1. Testing getAllPlayersStats function...');
        const startTime = performance.now();

        const playersData = await getAllPlayersStats();

        const endTime = performance.now();
        const duration = endTime - startTime;

        console.log(`✅ getAllPlayersStats completed in ${duration.toFixed(2)}ms`);
        console.log(`📊 Players data:`, playersData);
        console.log(`👥 Total players found: ${playersData?.length || 0}`);

        if (playersData && playersData.length > 0) {
            console.log('📋 Sample player data:');
            console.table(playersData.slice(0, 3));

            // Check for active players
            const activePlayers = playersData.filter(player =>
                (player.games_played || 0) > 0 || (player.tournaments_won || 0) > 0
            );
            console.log(`🎮 Active players (with games/tournaments): ${activePlayers.length}`);

            // Check TELO ratings
            const ratings = playersData.map(p => p.telo_rating || 1500);
            const maxRating = Math.max(...ratings);
            const minRating = Math.min(...ratings);
            const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;

            console.log(`⭐ TELO Rating stats:`);
            console.log(`   - Max: ${maxRating}`);
            console.log(`   - Min: ${minRating}`);
            console.log(`   - Avg: ${avgRating.toFixed(0)}`);

        } else {
            console.warn('⚠️ No players data returned');
            console.log('This could mean:');
            console.log('- No players have registered yet');
            console.log('- Smart contract query failed');
            console.log('- Network/API issues');
        }

    } catch (error) {
        console.error('❌ Error in getAllPlayersStats:', error);
        console.log('Possible causes:');
        console.log('- Network connectivity issues');
        console.log('- Smart contract not deployed');
        console.log('- API endpoint down');
        console.log('- Invalid contract address');
    }

    console.groupEnd();
}

export async function testContractConnection() {
    console.group('🔗 Testing Contract Connection');

    try {
        // Test basic API connectivity
        const apiUrl = process.env.REACT_APP_API_URL || 'https://devnet-api.multiversx.com';
        console.log(`Testing API: ${apiUrl}`);

        const response = await fetch(`${apiUrl}/vm-values/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                scAddress: process.env.REACT_APP_CONTRACT_ADDRESS || 'erd1qqqqqqqqqqqqqpgq...',
                funcName: 'getAllUsersStats',
                args: [],
            }),
        });

        console.log(`API Response status: ${response.status}`);

        if (response.ok) {
            const data = await response.json();
            console.log('✅ API connection successful');
            console.log('Response data:', data);
        } else {
            console.error(`❌ API error: ${response.status} ${response.statusText}`);
        }

    } catch (error) {
        console.error('❌ Connection test failed:', error);
    }

    console.groupEnd();
}

export function checkEnvironmentVariables() {
    console.group('🌍 Environment Variables Check');

    const requiredVars = [
        'REACT_APP_API_URL',
        'REACT_APP_CONTRACT_ADDRESS',
        'REACT_APP_NETWORK_ID',
    ];

    requiredVars.forEach(varName => {
        const value = process.env[varName];
        if (value) {
            console.log(`✅ ${varName}: ${value}`);
        } else {
            console.warn(`⚠️ ${varName}: Not set`);
        }
    });

    console.groupEnd();
}

// Make functions available globally for console use
if (typeof window !== 'undefined') {
    (window as any).debugLeaderboard = {
        debugLeaderboard,
        testContractConnection,
        checkEnvironmentVariables,
    };
    console.log('💡 Debug tools available at window.debugLeaderboard');
    console.log('   - debugLeaderboard.debugLeaderboard()');
    console.log('   - debugLeaderboard.testContractConnection()');
    console.log('   - debugLeaderboard.checkEnvironmentVariables()');
}

