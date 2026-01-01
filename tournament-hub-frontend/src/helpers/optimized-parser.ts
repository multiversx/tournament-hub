/**
 * Optimized version of getAllPlayersStats and parseAllUsersStatsHex
 * 
 * Key improvements:
 * 1. Removed excessive console.log statements
 * 2. Added DEBUG flag for development logging
 * 3. Optimized string operations
 * 4. Better error handling
 * 5. Type safety improvements
 */

// Debug flag - set to false in production
const DEBUG = process.env.NODE_ENV === 'development';
const debugLog = DEBUG ? console.log.bind(console) : () => { };

interface UserStatsRaw {
    address: string;
    games_played: number;
    wins: number;
    losses: number;
    win_rate: number;
    tokens_won: bigint;
    tokens_spent: bigint;
    tournaments_created: number;
    tournaments_won: number;
    current_streak: number;
    best_streak: number;
    last_activity: number;
    member_since: number;
    telo_rating: number;
}

/**
 * Optimized version of parseAllUsersStatsHex
 * Removed excessive logging and optimized string operations
 */
export function parseAllUsersStatsHexOptimized(encodedData: string): UserStatsRaw[] {
    try {
        debugLog('parseAllUsersStatsHex - Starting parse');

        // Convert base64 to hex if needed
        let hex: string;
        if (encodedData.includes('=') || /^[A-Za-z0-9+/]+$/.test(encodedData)) {
            try {
                const decoded = atob(encodedData);
                hex = Array.from(decoded, char =>
                    char.charCodeAt(0).toString(16).padStart(2, '0')
                ).join('');
                debugLog('parseAllUsersStatsHex - Converted base64 to hex');
            } catch (error) {
                console.error('Error decoding base64:', error);
                return [];
            }
        } else {
            hex = encodedData.startsWith('0x') ? encodedData.slice(2) : encodedData;
        }

        // Parse the managed vector
        let offset = 0;

        function readHex(len: number): string {
            if (!len || len <= 0 || !isFinite(len)) {
                return '';
            }
            const end = offset + len;
            if (end > hex.length) {
                return '';
            }
            const result = hex.slice(offset, end);
            offset = end;
            return result;
        }

        function readU32(): number {
            const hexValue = readHex(8);
            if (!hexValue) return 0;
            return parseInt(hexValue, 16);
        }

        function readU64(): bigint {
            const hexValue = readHex(16);
            if (!hexValue) return BigInt(0);
            return BigInt('0x' + hexValue);
        }

        function readBigUint(): bigint {
            const len = readU32();
            if (len === 0) return BigInt(0);
            if (len > 1000) return BigInt(0);
            const hexValue = readHex(len * 2);
            if (!hexValue) return BigInt(0);
            return BigInt('0x' + hexValue);
        }

        function readAddress(): string {
            // ManagedAddress in MultiversX is always 32 bytes (64 hex chars) when in a struct/tuple
            const hexValue = readHex(64);
            if (hexValue === '') return '';
            return '0x' + hexValue;
        }

        // Flat parsing: data starts with first user's address directly (32 bytes)
        // Iterate until we exhaust the hex buffer
        const allUsersStats: UserStatsRaw[] = [];
        const MAX_USERS = 10000;

        while (offset + 64 <= hex.length && allUsersStats.length < MAX_USERS) {
            const startOffset = offset;
            try {
                // Address (32 bytes)
                const addressHex = readHex(64);
                const address = addressHex ? '0x' + addressHex : '';
                if (!address) break;

                // Fields
                const games_played = readU32();
                const wins = readU32();
                const losses = readU32();
                const win_rate = readU32();
                const tokens_won = readBigUint();
                const tokens_spent = readBigUint();
                const tournaments_created = readU32();
                const tournaments_won = readU32();
                const current_streak = readU32();
                const best_streak = readU32();
                const last_activity = readU64();
                const member_since = readU64();
                const telo_rating = readU32();

                allUsersStats.push({
                    address,
                    games_played,
                    wins,
                    losses,
                    win_rate,
                    tokens_won,
                    tokens_spent,
                    tournaments_created,
                    tournaments_won,
                    current_streak,
                    best_streak,
                    last_activity: Number(last_activity),
                    member_since: Number(member_since),
                    telo_rating
                });
            } catch (e) {
                // If we fail mid-parse, rewind this item and exit loop
                offset = startOffset;
                break;
            }
        }

        debugLog(`parseAllUsersStatsHex - Successfully parsed ${allUsersStats.length} users`);
        return allUsersStats;

    } catch (error) {
        console.error('Error parsing all users stats hex:', error);
        return [];
    }
}

/**
 * Optimized version of getAllPlayersStats
 * Uses the optimized parser and reduces logging
 */
export async function getAllPlayersStatsOptimized(
    getApiUrl: () => string,
    getContractAddress: () => string,
    fetchWithTimeout: (url: string, init?: RequestInit, timeout?: number, retries?: number) => Promise<Response>,
    deduplicateApiRequest: <T>(key: string, fn: () => Promise<T>) => Promise<T>
): Promise<UserStatsRaw[]> {
    const cacheKey = 'all_players_stats';

    return deduplicateApiRequest(cacheKey, async () => {
        try {
            debugLog('Fetching all players stats for leaderboard...');

            const requestBody = {
                scAddress: getContractAddress(),
                funcName: 'getAllUsersStats',
                args: [],
            };

            const response = await fetchWithTimeout(
                `${getApiUrl()}/vm-values/query`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody),
                },
                20000,
                2
            );

            if (!response.ok) {
                if (response.status === 429) {
                    console.warn('Rate limited when fetching all users stats');
                    return [];
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data?.data?.data?.returnData && data.data.data.returnData.length > 0) {
                const encodedData = data.data.data.returnData[0];
                const parsedData = parseAllUsersStatsHexOptimized(encodedData);
                debugLog(`getAllPlayersStats - Retrieved ${parsedData.length} players`);
                return parsedData || [];
            }

            debugLog('getAllPlayersStats - No return data found');
            return [];

        } catch (error) {
            console.error('Error fetching all players stats:', error);
            return [];
        }
    });
}

/**
 * Batch processor for large datasets
 * Processes data in chunks to avoid blocking the main thread
 */
export async function processBatchedData<T, R>(
    data: T[],
    processor: (item: T) => R,
    batchSize: number = 100
): Promise<R[]> {
    const results: R[] = [];

    for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        const batchResults = batch.map(processor);
        results.push(...batchResults);

        // Yield to browser to prevent blocking
        if (i + batchSize < data.length) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    return results;
}

/**
 * Memoized address formatter
 * Cache formatted addresses to avoid repeated string operations
 */
const addressFormatCache = new Map<string, string>();

export function formatAddressCached(addr: string): string {
    if (addressFormatCache.has(addr)) {
        return addressFormatCache.get(addr)!;
    }

    const formatted = `${addr.slice(0, 8)}...${addr.slice(-6)}`;

    // Keep cache size limited
    if (addressFormatCache.size > 1000) {
        const firstKey = addressFormatCache.keys().next().value;
        if (firstKey) {
            addressFormatCache.delete(firstKey);
        }
    }

    addressFormatCache.set(addr, formatted);
    return formatted;
}

/**
 * Clear format cache (useful when unmounting component)
 */
export function clearAddressFormatCache(): void {
    addressFormatCache.clear();
}

/**
 * Performance monitoring utility
 */
export class PerformanceMonitor {
    private static marks = new Map<string, number>();

    static start(label: string): void {
        if (DEBUG) {
            this.marks.set(label, performance.now());
        }
    }

    static end(label: string, threshold: number = 100): void {
        if (DEBUG && this.marks.has(label)) {
            const start = this.marks.get(label)!;
            const duration = performance.now() - start;

            if (duration > threshold) {
                console.warn(`⚠️ Performance: ${label} took ${duration.toFixed(2)}ms (threshold: ${threshold}ms)`);
            } else {
                debugLog(`✓ Performance: ${label} took ${duration.toFixed(2)}ms`);
            }

            this.marks.delete(label);
        }
    }

    static measure(label: string, fn: () => void): void {
        this.start(label);
        fn();
        this.end(label);
    }

    static async measureAsync(label: string, fn: () => Promise<void>): Promise<void> {
        this.start(label);
        await fn();
        this.end(label);
    }
}

/**
 * Debounce utility for search inputs
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
    const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

    React.useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(timer);
        };
    }, [value, delay]);

    return debouncedValue;
}

// Re-export for convenience
import React from 'react';


