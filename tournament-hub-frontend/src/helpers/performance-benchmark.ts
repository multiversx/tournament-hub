/**
 * Performance Benchmark Utility for Leaderboard
 * 
 * Usage:
 * 1. Import this in your component
 * 2. Call runLeaderboardBenchmark() to test performance
 * 3. Check console for detailed metrics
 */

interface BenchmarkResult {
    name: string;
    duration: number;
    memoryUsed?: number;
}

interface BenchmarkSuite {
    suiteName: string;
    results: BenchmarkResult[];
    totalDuration: number;
    averageDuration: number;
}

/**
 * Measure execution time of a function
 */
export function measureTime<T>(name: string, fn: () => T): { result: T; duration: number } {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    const duration = end - start;

    return { result, duration };
}

/**
 * Measure async function execution time
 */
export async function measureTimeAsync<T>(
    name: string,
    fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    const duration = end - start;

    return { result, duration };
}

/**
 * Measure memory usage (if available)
 */
export function measureMemory(): number | undefined {
    if ('memory' in performance && (performance as any).memory) {
        return (performance as any).memory.usedJSHeapSize;
    }
    return undefined;
}

/**
 * Generate mock player data for testing
 */
export function generateMockPlayers(count: number): any[] {
    const players = [];

    for (let i = 0; i < count; i++) {
        players.push({
            address: `0x${'0'.repeat(56)}${i.toString(16).padStart(8, '0')}`,
            games_played: Math.floor(Math.random() * 100),
            wins: Math.floor(Math.random() * 50),
            losses: Math.floor(Math.random() * 50),
            win_rate: Math.floor(Math.random() * 10000),
            tokens_won: BigInt(Math.floor(Math.random() * 1000000000000000000)),
            tokens_spent: BigInt(Math.floor(Math.random() * 1000000000000000000)),
            tournaments_created: Math.floor(Math.random() * 10),
            tournaments_won: Math.floor(Math.random() * 5),
            current_streak: Math.floor(Math.random() * 10),
            best_streak: Math.floor(Math.random() * 20),
            last_activity: Date.now() - Math.floor(Math.random() * 86400000),
            member_since: Date.now() - Math.floor(Math.random() * 31536000000),
            telo_rating: 1000 + Math.floor(Math.random() * 1000)
        });
    }

    return players;
}

/**
 * Benchmark filter operation
 */
export function benchmarkFilter(players: any[], searchTerm: string): BenchmarkResult {
    const memoryBefore = measureMemory();
    const start = performance.now();

    const lowerSearch = searchTerm.toLowerCase();
    const filtered = players.filter(player =>
        player.address.toLowerCase().includes(lowerSearch)
    );

    const end = performance.now();
    const memoryAfter = measureMemory();

    return {
        name: `Filter ${players.length} players`,
        duration: end - start,
        memoryUsed: memoryAfter && memoryBefore ? memoryAfter - memoryBefore : undefined
    };
}

/**
 * Benchmark sorting operation
 */
export function benchmarkSort(players: any[]): BenchmarkResult {
    const memoryBefore = measureMemory();
    const start = performance.now();

    const sorted = [...players].sort((a, b) => b.telo_rating - a.telo_rating);

    const end = performance.now();
    const memoryAfter = measureMemory();

    return {
        name: `Sort ${players.length} players`,
        duration: end - start,
        memoryUsed: memoryAfter && memoryBefore ? memoryAfter - memoryBefore : undefined
    };
}

/**
 * Benchmark data transformation
 */
export function benchmarkTransform(players: any[]): BenchmarkResult {
    const memoryBefore = measureMemory();
    const start = performance.now();

    const transformed = players.map((player, index) => ({
        address: player.address,
        gamesPlayed: player.games_played || 0,
        wins: player.wins || 0,
        losses: player.losses || 0,
        winRate: player.win_rate ? player.win_rate / 100 : 0,
        tokensWon: player.tokens_won ? Number(player.tokens_won) / 1e18 : 0,
        tokensSpent: player.tokens_spent ? Number(player.tokens_spent) / 1e18 : 0,
        tournamentsWon: player.tournaments_won || 0,
        teloRating: player.telo_rating || 1500,
        rank: index + 1,
    }));

    const end = performance.now();
    const memoryAfter = measureMemory();

    return {
        name: `Transform ${players.length} players`,
        duration: end - start,
        memoryUsed: memoryAfter && memoryBefore ? memoryAfter - memoryBefore : undefined
    };
}

/**
 * Benchmark address formatting
 */
export function benchmarkAddressFormatting(players: any[]): BenchmarkResult {
    const start = performance.now();

    const formatted = players.map(player => {
        return `${player.address.slice(0, 8)}...${player.address.slice(-6)}`;
    });

    const end = performance.now();

    return {
        name: `Format ${players.length} addresses`,
        duration: end - start
    };
}

/**
 * Run complete benchmark suite
 */
export function runBenchmarkSuite(playerCounts: number[] = [10, 100, 500, 1000, 5000]): void {
    console.group('🔬 Leaderboard Performance Benchmark');
    console.log('Running comprehensive performance tests...\n');

    const allSuites: BenchmarkSuite[] = [];

    playerCounts.forEach(count => {
        console.group(`📊 Testing with ${count} players`);

        const players = generateMockPlayers(count);
        const results: BenchmarkResult[] = [];

        // Test 1: Transform
        const transformResult = benchmarkTransform(players);
        results.push(transformResult);
        console.log(`✓ ${transformResult.name}: ${transformResult.duration.toFixed(2)}ms`);

        // Test 2: Sort
        const sortResult = benchmarkSort(players);
        results.push(sortResult);
        console.log(`✓ ${sortResult.name}: ${sortResult.duration.toFixed(2)}ms`);

        // Test 3: Filter (searching for "0x000")
        const filterResult = benchmarkFilter(players, '0x000');
        results.push(filterResult);
        console.log(`✓ ${filterResult.name}: ${filterResult.duration.toFixed(2)}ms`);

        // Test 4: Address Formatting
        const formatResult = benchmarkAddressFormatting(players);
        results.push(formatResult);
        console.log(`✓ ${formatResult.name}: ${formatResult.duration.toFixed(2)}ms`);

        const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
        const avgDuration = totalDuration / results.length;

        console.log(`\n📈 Total: ${totalDuration.toFixed(2)}ms | Average: ${avgDuration.toFixed(2)}ms`);

        allSuites.push({
            suiteName: `${count} players`,
            results,
            totalDuration,
            averageDuration: avgDuration
        });

        console.groupEnd();
        console.log('');
    });

    // Print summary table
    console.log('\n📋 Summary Table:');
    console.table(
        allSuites.map(suite => ({
            'Player Count': suite.suiteName,
            'Total Time (ms)': suite.totalDuration.toFixed(2),
            'Avg Time (ms)': suite.averageDuration.toFixed(2),
            'Transform (ms)': suite.results[0].duration.toFixed(2),
            'Sort (ms)': suite.results[1].duration.toFixed(2),
            'Filter (ms)': suite.results[2].duration.toFixed(2),
            'Format (ms)': suite.results[3].duration.toFixed(2),
        }))
    );

    // Performance warnings
    console.log('\n⚠️ Performance Analysis:');
    allSuites.forEach(suite => {
        const count = parseInt(suite.suiteName);
        if (suite.totalDuration > 1000) {
            console.warn(`  • ${suite.suiteName}: CRITICAL - Total time ${suite.totalDuration.toFixed(0)}ms exceeds 1000ms`);
        } else if (suite.totalDuration > 500) {
            console.warn(`  • ${suite.suiteName}: WARNING - Total time ${suite.totalDuration.toFixed(0)}ms exceeds 500ms`);
        } else if (suite.totalDuration > 200) {
            console.log(`  • ${suite.suiteName}: ACCEPTABLE - Total time ${suite.totalDuration.toFixed(0)}ms`);
        } else {
            console.log(`  • ${suite.suiteName}: EXCELLENT - Total time ${suite.totalDuration.toFixed(0)}ms`);
        }
    });

    console.groupEnd();
}

/**
 * Compare two implementations
 */
export function compareImplementations<T>(
    name: string,
    oldImpl: () => T,
    newImpl: () => T,
    iterations: number = 100
): void {
    console.group(`⚖️ Comparing: ${name}`);

    // Warm up
    oldImpl();
    newImpl();

    // Benchmark old implementation
    const oldTimes: number[] = [];
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        oldImpl();
        const end = performance.now();
        oldTimes.push(end - start);
    }

    // Benchmark new implementation
    const newTimes: number[] = [];
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        newImpl();
        const end = performance.now();
        newTimes.push(end - start);
    }

    const oldAvg = oldTimes.reduce((a, b) => a + b, 0) / oldTimes.length;
    const newAvg = newTimes.reduce((a, b) => a + b, 0) / newTimes.length;
    const improvement = ((oldAvg - newAvg) / oldAvg) * 100;

    console.log(`Old Implementation: ${oldAvg.toFixed(3)}ms average`);
    console.log(`New Implementation: ${newAvg.toFixed(3)}ms average`);
    console.log(`Improvement: ${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%`);

    if (improvement > 20) {
        console.log('🎉 Significant improvement!');
    } else if (improvement > 0) {
        console.log('✓ Minor improvement');
    } else if (improvement > -10) {
        console.log('≈ Similar performance');
    } else {
        console.warn('⚠️ Performance regression!');
    }

    console.groupEnd();
}

/**
 * Monitor React component render performance
 */
export function useRenderPerformance(componentName: string): void {
    const renderCount = React.useRef(0);
    const lastRenderTime = React.useRef(0);

    React.useEffect(() => {
        renderCount.current += 1;
        const now = performance.now();

        if (lastRenderTime.current > 0) {
            const timeSinceLastRender = now - lastRenderTime.current;
            console.log(
                `🔄 ${componentName} render #${renderCount.current} ` +
                `(${timeSinceLastRender.toFixed(2)}ms since last render)`
            );
        } else {
            console.log(`🔄 ${componentName} initial render`);
        }

        lastRenderTime.current = now;
    });
}

/**
 * Track component mount/unmount
 */
export function useComponentLifecycle(componentName: string): void {
    React.useEffect(() => {
        const mountTime = performance.now();
        console.log(`✓ ${componentName} mounted`);

        return () => {
            const unmountTime = performance.now();
            const lifetimeMs = unmountTime - mountTime;
            console.log(`✗ ${componentName} unmounted (lifetime: ${lifetimeMs.toFixed(0)}ms)`);
        };
    }, [componentName]);
}

// Export React for hooks
import React from 'react';

/**
 * Quick benchmark function to use in console
 * 
 * Usage in browser console:
 * ```
 * import { quickBenchmark } from './performance-benchmark';
 * quickBenchmark();
 * ```
 */
export function quickBenchmark(): void {
    console.log('Running quick benchmark...');
    runBenchmarkSuite([100, 500, 1000]);
}

// Make it available globally for console use
if (typeof window !== 'undefined') {
    (window as any).leaderboardBenchmark = {
        runBenchmarkSuite,
        quickBenchmark,
        compareImplementations,
        generateMockPlayers,
    };
    console.log('💡 Benchmark tools available at window.leaderboardBenchmark');
}


