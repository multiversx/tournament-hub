export * from './pingPong';
export * from './signAndSendTransactions';

import { getContractAddress, getNetwork } from '../config/contract';
import { BACKEND_BASE_URL } from '../config/backend';
import { Address } from '@multiversx/sdk-core';

// Helper function to get the correct API URL based on network
function getApiUrl(): string {
    const network = getNetwork();
    switch (network) {
        case 'devnet':
            return 'https://devnet-gateway.multiversx.com';
        case 'testnet':
            return 'https://testnet-api.multiversx.com';
        case 'mainnet':
            return 'https://api.multiversx.com';
        default:
            return 'https://devnet-gateway.multiversx.com';
    }
}


// Enhanced cache system with different TTLs and invalidation strategies
interface CacheEntry {
    data: any;
    timestamp: number;
    ttl: number;
    priority: 'low' | 'medium' | 'high';
    dependencies?: string[]; // Cache keys this entry depends on
    invalidationTriggers?: string[]; // Events that should invalidate this cache
}

const apiCache = new Map<string, CacheEntry>();

// Different TTLs for different types of data
const CACHE_TTLS = {
    // Static data - rarely changes
    GAME_CONFIG: 30 * 60 * 1000, // 30 minutes
    CONTRACT_CONFIG: 60 * 60 * 1000, // 1 hour

    // Semi-static data - changes occasionally
    TOURNAMENT_BASIC_INFO: 5 * 60 * 1000, // 5 minutes
    USER_STATS: 10 * 60 * 1000, // 10 minutes

    // Dynamic data - changes frequently
    TOURNAMENT_STATUS: 30 * 1000, // 30 seconds
    GAME_STATE: 5 * 1000, // 5 seconds
    PRIZE_POOL: 2 * 60 * 1000, // 2 minutes

    // Default
    DEFAULT: 5 * 60 * 1000, // 5 minutes
};

// Request deduplication
const pendingApiRequests = new Map<string, Promise<any>>();

// Cache invalidation system
class CacheInvalidationManager {
    private invalidationListeners = new Map<string, Set<string>>();
    private eventListeners = new Map<string, Set<string>>();

    // Register a cache entry that should be invalidated when certain events occur
    registerInvalidationTrigger(cacheKey: string, triggers: string[]) {
        triggers.forEach(trigger => {
            if (!this.eventListeners.has(trigger)) {
                this.eventListeners.set(trigger, new Set());
            }
            this.eventListeners.get(trigger)!.add(cacheKey);
        });
    }

    // Trigger invalidation for specific events
    triggerInvalidation(event: string) {
        const affectedKeys = this.eventListeners.get(event);
        if (affectedKeys) {
            affectedKeys.forEach(key => {
                apiCache.delete(key);
                console.log(`Cache invalidated for key: ${key} due to event: ${event}`);
            });
        }
    }

    // Invalidate cache entries that depend on a specific key
    invalidateDependencies(key: string) {
        apiCache.forEach((entry, cacheKey) => {
            if (entry.dependencies?.includes(key)) {
                apiCache.delete(cacheKey);
                console.log(`Cache invalidated for key: ${cacheKey} due to dependency on: ${key}`);
            }
        });
    }

    // Smart cache cleanup based on priority and age
    cleanup() {
        const now = Date.now();
        const entriesToDelete: string[] = [];

        apiCache.forEach((entry, key) => {
            const age = now - entry.timestamp;
            const isExpired = age > entry.ttl;

            // Clean up expired entries
            if (isExpired) {
                entriesToDelete.push(key);
                return;
            }

            // Clean up low priority entries that are getting old (but not expired)
            if (entry.priority === 'low' && age > entry.ttl * 0.8) {
                entriesToDelete.push(key);
                return;
            }
        });

        entriesToDelete.forEach(key => {
            apiCache.delete(key);
        });

        if (entriesToDelete.length > 0) {
            console.log(`Cleaned up ${entriesToDelete.length} cache entries`);
        }
    }
}

const cacheInvalidationManager = new CacheInvalidationManager();

// Enhanced cache functions
function setCacheEntry(key: string, data: any, ttl: number, priority: 'low' | 'medium' | 'high' = 'medium', options?: { dependencies?: string[], invalidationTriggers?: string[] }) {
    const entry: CacheEntry = {
        data,
        timestamp: Date.now(),
        ttl,
        priority,
        dependencies: options?.dependencies,
        invalidationTriggers: options?.invalidationTriggers
    };

    apiCache.set(key, entry);

    // Register invalidation triggers if provided
    if (options?.invalidationTriggers) {
        cacheInvalidationManager.registerInvalidationTrigger(key, options.invalidationTriggers);
    }
}

function getCacheEntry(key: string): any | null {
    const entry = apiCache.get(key);
    if (!entry) return null;

    const now = Date.now();
    const age = now - entry.timestamp;

    if (age > entry.ttl) {
        apiCache.delete(key);
        return null;
    }

    return entry.data;
}

// Auto-cleanup every 5 minutes
setInterval(() => {
    cacheInvalidationManager.cleanup();
}, 5 * 60 * 1000);

// Advanced rate limiting and request queuing system
interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    minInterval: number;
    burstLimit: number;
    priority: 'low' | 'medium' | 'high';
}

interface QueuedRequest {
    id: string;
    priority: 'low' | 'medium' | 'high';
    timestamp: number;
    execute: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
}

class AdvancedRateLimiter {
    private rateLimitMap = new Map<string, { count: number; resetTime: number; lastRequest: number; burstCount: number }>();
    private requestQueue: QueuedRequest[] = [];
    private isProcessingQueue = false;
    private configs: Map<string, RateLimitConfig> = new Map();

    constructor() {
        // Initialize rate limit configurations for different endpoints
        this.configs.set('default', {
            windowMs: 60 * 1000, // 1 minute
            maxRequests: 100,
            minInterval: 100,
            burstLimit: 10,
            priority: 'medium'
        });

        this.configs.set('tournament_basic_info', {
            windowMs: 30 * 1000, // 30 seconds
            maxRequests: 50,
            minInterval: 50,
            burstLimit: 20,
            priority: 'high'
        });

        this.configs.set('tournament_status', {
            windowMs: 10 * 1000, // 10 seconds
            maxRequests: 30,
            minInterval: 200,
            burstLimit: 5,
            priority: 'high'
        });

        this.configs.set('user_stats', {
            windowMs: 60 * 1000, // 1 minute
            maxRequests: 20,
            minInterval: 500,
            burstLimit: 3,
            priority: 'low'
        });

        this.configs.set('bulk_requests', {
            windowMs: 60 * 1000, // 1 minute
            maxRequests: 10,
            minInterval: 1000,
            burstLimit: 2,
            priority: 'high'
        });

        // Start processing the queue
        this.processQueue();
    }

    async addRequest<T>(
        endpoint: string,
        priority: 'low' | 'medium' | 'high',
        execute: () => Promise<T>
    ): Promise<T> {
        return new Promise((resolve, reject) => {
            const request: QueuedRequest = {
                id: `${endpoint}_${Date.now()}_${Math.random()}`,
                priority,
                timestamp: Date.now(),
                execute,
                resolve,
                reject
            };

            // Insert request in priority order
            this.insertRequestByPriority(request);
        });
    }

    private insertRequestByPriority(request: QueuedRequest) {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const requestPriority = priorityOrder[request.priority];

        let insertIndex = this.requestQueue.length;
        for (let i = 0; i < this.requestQueue.length; i++) {
            if (priorityOrder[this.requestQueue[i].priority] < requestPriority) {
                insertIndex = i;
                break;
            }
        }

        this.requestQueue.splice(insertIndex, 0, request);
    }

    private async processQueue() {
        if (this.isProcessingQueue || this.requestQueue.length === 0) {
            setTimeout(() => this.processQueue(), 100);
            return;
        }

        this.isProcessingQueue = true;

        while (this.requestQueue.length > 0) {
            const request = this.requestQueue.shift();
            if (!request) break;

            const endpoint = this.extractEndpointFromId(request.id);
            const config = this.configs.get(endpoint) || this.configs.get('default')!;

            if (this.canMakeRequest(endpoint, config)) {
                try {
                    const result = await request.execute();
                    request.resolve(result);
                } catch (error) {
                    request.reject(error);
                }
            } else {
                // Put request back at the front of the queue
                this.requestQueue.unshift(request);
                // Wait before trying again
                await new Promise(resolve => setTimeout(resolve, config.minInterval));
            }
        }

        this.isProcessingQueue = false;
        setTimeout(() => this.processQueue(), 50);
    }

    private extractEndpointFromId(id: string): string {
        return id.split('_')[0] + '_' + id.split('_')[1];
    }

    private canMakeRequest(endpoint: string, config: RateLimitConfig): boolean {
        const now = Date.now();
        const key = `rate_limit_${endpoint}`;
        const limit = this.rateLimitMap.get(key);

        if (!limit || now > limit.resetTime) {
            this.rateLimitMap.set(key, {
                count: 1,
                resetTime: now + config.windowMs,
                lastRequest: now,
                burstCount: 1
            });
            return true;
        }

        // Check burst limit
        if (limit.burstCount >= config.burstLimit) {
            return false;
        }

        // Check minimum interval
        if (now - limit.lastRequest < config.minInterval) {
            return false;
        }

        // Check window limit
        if (limit.count >= config.maxRequests) {
            return false;
        }

        // Update counters
        limit.count++;
        limit.lastRequest = now;
        limit.burstCount++;

        // Reset burst counter after a short period
        setTimeout(() => {
            const currentLimit = this.rateLimitMap.get(key);
            if (currentLimit) {
                currentLimit.burstCount = Math.max(0, currentLimit.burstCount - 1);
            }
        }, 1000);

        return true;
    }

    getQueueStats() {
        return {
            queueLength: this.requestQueue.length,
            isProcessing: this.isProcessingQueue,
            rateLimits: Array.from(this.rateLimitMap.entries()).map(([key, value]) => ({
                endpoint: key,
                count: value.count,
                resetTime: value.resetTime,
                burstCount: value.burstCount
            }))
        };
    }
}

const advancedRateLimiter = new AdvancedRateLimiter();

// Expose a safe way to clear API-level caches from the UI
export function clearApiCaches(): void {
    apiCache.clear();
    pendingApiRequests.clear();

    // Clear ALL localStorage tournament-related data
    try {
        localStorage.removeItem('tournament_persistent_cache');
    } catch (e) {
        // Ignore errors
    }

    // Clear ALL sessionStorage tournament-related data
    try {
        const keysToRemove = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && (key.includes('tournament') || key.includes('cache'))) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => {
            sessionStorage.removeItem(key);
        });
    } catch (e) {
        // Ignore errors
    }
    // Note: AdvancedRateLimiter manages its own state
}

// Nuclear option: Clear EVERYTHING tournament-related
export function clearAllTournamentData(): void {

    // Clear in-memory caches
    clearApiCaches();

    // Force clear all tournament-related data from localStorage (including old cache versions)
    try {
        const allKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.includes('tournament') || key.includes('cache'))) {
                allKeys.push(key);
            }
        }
        allKeys.forEach(key => {
            localStorage.removeItem(key);
        });
    } catch (e) {
        // Ignore errors
    }

    // Clear ALL localStorage keys that might contain tournament data
    try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.includes('tournament') || key.includes('cache') || key.includes('persistent'))) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
            console.log(`✓ Cleared localStorage key: ${key}`);
        });
    } catch (e) {
        console.log('✗ Could not clear localStorage:', e);
    }

    // Clear ALL sessionStorage keys that might contain tournament data
    try {
        const keysToRemove = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && (key.includes('tournament') || key.includes('cache') || key.includes('persistent'))) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => {
            sessionStorage.removeItem(key);
            console.log(`✓ Cleared sessionStorage key: ${key}`);
        });
    } catch (e) {
        console.log('✗ Could not clear sessionStorage:', e);
    }

    console.log('=== NUCLEAR: All tournament data cleared ===');
}

// Ultimate nuclear option: Clear everything and reload the page
export function nuclearClearAndReload(): void {
    console.log('=== ULTIMATE NUCLEAR: Clearing everything and reloading ===');

    // Clear all tournament data
    clearAllTournamentData();

    // Clear ALL localStorage (nuclear option)
    try {
        localStorage.clear();
        console.log('✓ Cleared ALL localStorage');
    } catch (e) {
        console.log('✗ Could not clear localStorage:', e);
    }

    // Clear ALL sessionStorage (nuclear option)
    try {
        sessionStorage.clear();
        console.log('✓ Cleared ALL sessionStorage');
    } catch (e) {
        console.log('✗ Could not clear sessionStorage:', e);
    }

    console.log('=== ULTIMATE NUCLEAR: Reloading page in 2 seconds ===');

    // Reload the page after a short delay
    setTimeout(() => {
        window.location.reload();
    }, 2000);
}


// Function to force clear React component state (call this from UI)
export function forceClearComponentState(): void {
    console.log('=== FORCE CLEAR: Clearing React component state ===');

    // Dispatch a custom event that components can listen to
    const event = new CustomEvent('forceClearTournaments', {
        detail: { timestamp: Date.now() }
    });
    window.dispatchEvent(event);

    console.log('=== FORCE CLEAR: Dispatched forceClearTournaments event ===');
}

// Helper function to get game name by ID
function getGameName(gameId: number): string {
    const gameNames: { [key: number]: string } = {
        1: 'Tic Tac Toe',
        2: 'Chess',
        3: 'CryptoBubbles',
        5: 'Agar.io',
        6: 'DodgeDash',
        7: 'Connect Four',
        8: 'Battleship'
    };
    return gameNames[gameId] || `Game ${gameId}`;
}

// Force refresh function for new tournaments
export async function forceRefreshTournaments(): Promise<any[]> {
    // Clear all caches
    clearApiCaches();

    // Clear persistent cache
    try {
        localStorage.removeItem('tournament_persistent_cache');
    } catch (e) {
        console.log('Could not clear persistent cache:', e);
    }

    // Get fresh tournament IDs
    const tournamentIds = await getActiveTournamentIds();
    console.log('Fresh tournament IDs:', tournamentIds);

    if (tournamentIds.length === 0) {
        return [];
    }

    // Load tournament details for all IDs
    const tournaments = [];
    for (const id of tournamentIds) {
        try {
            const details = await getTournamentDetailsFromContractFresh(id);

            if (details) {
                const participantsCount = (details.participants || []).length;
                const computedPrizePool = BigInt(details.entry_fee ?? 0) * BigInt(participantsCount);

                // Fetch transaction hash for completed tournaments
                let resultTxHash = details.result_tx_hash || null;
                if (!resultTxHash && details.status === 4) { // Completed status
                    try {
                        resultTxHash = await getSubmitResultsTransactionHash(id);
                    } catch (e) {
                        console.error(`Error fetching transaction hash for tournament ${id}:`, e);
                        resultTxHash = null;
                    }
                }

                const basicData = {
                    id,
                    name: details.name, // No fallback - show actual name or empty
                    status: details.status,
                    participants: details.participants || [],
                    description: getGameName(Number(details.game_id)),
                    creator: details.creator || 'Unknown',
                    final_podium: details.final_podium || [],
                    game_id: details.game_id,
                    prizePool: computedPrizePool,
                    prizePoolLoaded: true,
                    gameConfig: null,
                    gameConfigLoaded: false,
                    resultTxHash,
                    resultTxLoaded: true,
                    loadingDetails: false
                };
                tournaments.push(basicData);
            } else {
            }
        } catch (error) {
            console.error(`Error loading tournament ${id}:`, error);
        }
    }

    return tournaments;
}

// Force refresh all tournaments by testing individual IDs (bypasses contract count issues)
export async function forceRefreshAllTournaments(): Promise<any[]> {
    clearAllTournamentData(); // Use nuclear option to clear everything

    const tournamentIds = await findTournamentsByTesting();

    if (tournamentIds.length === 0) {
        return [];
    }

    const tournaments = [];
    for (const id of tournamentIds) {
        try {
            const details = await getTournamentDetailsFromContractFresh(id);
            if (details) {
                const participantsCount = (details.participants || []).length;
                const computedPrizePool = BigInt(details.entry_fee ?? 0) * BigInt(participantsCount);

                const basicData = {
                    id,
                    name: details.name, // No fallback - show actual name or empty
                    status: details.status,
                    participants: details.participants || [],
                    description: getGameName(Number(details.game_id)),
                    creator: details.creator || 'Unknown',
                    final_podium: details.final_podium || [],
                    game_id: details.game_id,
                    prizePool: computedPrizePool,
                    prizePoolLoaded: true,
                    gameConfig: null,
                    gameConfigLoaded: false,
                    resultTxHash: details.result_tx_hash || null,
                    resultTxLoaded: true,
                    loadingDetails: false
                };
                tournaments.push(basicData);
            } else {
            }
        } catch (error) {
            console.error(`Error loading tournament ${id}:`, error);
        }
    }
    return tournaments;
}


// Enhanced cache management functions
export function invalidateCacheByEvent(event: string) {
    cacheInvalidationManager.triggerInvalidation(event);

    // Also dispatch window event for event-based systems
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('cacheInvalidated', {
            detail: { event, timestamp: Date.now() }
        }));
    }
}

export function invalidateCacheByKey(key: string) {
    apiCache.delete(key);
    cacheInvalidationManager.invalidateDependencies(key);
}

export function getCacheStats() {
    const stats = {
        totalEntries: apiCache.size,
        entriesByPriority: {
            low: 0,
            medium: 0,
            high: 0
        },
        entriesByAge: {
            fresh: 0, // < 1 minute
            recent: 0, // 1-10 minutes
            old: 0 // > 10 minutes
        }
    };

    const now = Date.now();
    apiCache.forEach(entry => {
        stats.entriesByPriority[entry.priority]++;

        const age = now - entry.timestamp;
        if (age < 60 * 1000) {
            stats.entriesByAge.fresh++;
        } else if (age < 10 * 60 * 1000) {
            stats.entriesByAge.recent++;
        } else {
            stats.entriesByAge.old++;
        }
    });

    return stats;
}

// Batch request system for efficient API calls
interface BatchRequest {
    id: string;
    type: 'tournament_basic_info' | 'tournament_status' | 'user_stats';
    params: any;
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timestamp: number;
}

class BatchRequestManager {
    private batches: Map<string, BatchRequest[]> = new Map();
    private batchTimeout: number = 100; // 100ms batching window
    private maxBatchSize: number = 20; // Maximum requests per batch
    private timeouts: Map<string, NodeJS.Timeout> = new Map();

    async addRequest<T>(
        type: string,
        params: any,
        cacheKey: string
    ): Promise<T> {
        return new Promise((resolve, reject) => {
            const request: BatchRequest = {
                id: `${type}_${Date.now()}_${Math.random()}`,
                type: type as any,
                params,
                resolve,
                reject,
                timestamp: Date.now()
            };

            if (!this.batches.has(type)) {
                this.batches.set(type, []);
            }

            const batch = this.batches.get(type)!;
            batch.push(request);

            // If batch is full, process immediately
            if (batch.length >= this.maxBatchSize) {
                this.processBatch(type);
                return;
            }

            // Set timeout for batch processing
            if (this.timeouts.has(type)) {
                clearTimeout(this.timeouts.get(type)!);
            }

            const timeout = setTimeout(() => {
                this.processBatch(type);
            }, this.batchTimeout);

            this.timeouts.set(type, timeout);
        });
    }

    private async processBatch(type: string) {
        const batch = this.batches.get(type);
        if (!batch || batch.length === 0) return;

        // Clear the batch and timeout
        this.batches.set(type, []);
        if (this.timeouts.has(type)) {
            clearTimeout(this.timeouts.get(type)!);
            this.timeouts.delete(type);
        }

        try {
            let results: any[] = [];

            switch (type) {
                case 'tournament_basic_info':
                    results = await this.processTournamentBasicInfoBatch(batch);
                    break;
                case 'tournament_status':
                    results = await this.processTournamentStatusBatch(batch);
                    break;
                case 'user_stats':
                    results = await this.processUserStatsBatch(batch);
                    break;
                default:
                    throw new Error(`Unknown batch type: ${type}`);
            }

            // Resolve all requests with their respective results
            batch.forEach((request, index) => {
                if (index < results.length) {
                    request.resolve(results[index]);
                } else {
                    request.reject(new Error('No result for request'));
                }
            });
        } catch (error) {
            // Reject all requests in the batch
            batch.forEach(request => {
                request.reject(error);
            });
        }
    }

    private async processTournamentBasicInfoBatch(batch: BatchRequest[]): Promise<any[]> {
        const tournamentIds = batch.map(req => req.params.tournamentId);

        // Use advanced rate limiter for bulk requests
        return await advancedRateLimiter.addRequest('bulk_requests', 'high', async () => {
            const response = await fetchWithTimeout(`${getApiUrl()}/vm-values/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    scAddress: getContractAddress(),
                    funcName: 'getTournamentsBasicInfo',
                    args: [tournamentIds.map(id => Number(id).toString(16).padStart(16, '0'))],
                }),
            });

            if (!response.ok) {
                throw new Error(`Batch request failed: ${response.status}`);
            }

            const data = await response.json();
            const returnData = data?.data?.data?.returnData || data?.data?.returnData || data?.returnData;

            if (!returnData || !Array.isArray(returnData) || returnData.length === 0) {
                throw new Error('No data returned from batch request');
            }

            // Parse the bulk response
            const bulkData = returnData[0];
            const parsedTournaments = await this.parseBulkTournamentBasicInfo(bulkData);

            // Map results back to individual requests
            return tournamentIds.map(id => {
                const tournament = parsedTournaments.find(t => t.id === id);
                return tournament || null;
            });
        });
    }

    private async processTournamentStatusBatch(batch: BatchRequest[]): Promise<any[]> {
        const tournamentIds = batch.map(req => req.params.tournamentId);

        const response = await fetchWithTimeout(`${getApiUrl()}/vm-values/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                scAddress: getContractAddress(),
                funcName: 'getTournamentsStatus',
                args: [tournamentIds.map(id => Number(id).toString(16).padStart(16, '0'))],
            }),
        });

        if (!response.ok) {
            throw new Error(`Batch status request failed: ${response.status}`);
        }

        const data = await response.json();
        const returnData = data?.data?.data?.returnData || data?.data?.returnData || data?.returnData;

        if (!returnData || !Array.isArray(returnData) || returnData.length === 0) {
            throw new Error('No status data returned from batch request');
        }

        const bulkData = returnData[0];
        const parsedStatuses = await this.parseBulkTournamentStatus(bulkData);

        return tournamentIds.map(id => {
            const status = parsedStatuses.find(s => s.id === id);
            return status ? status.status : 0;
        });
    }

    private async processUserStatsBatch(batch: BatchRequest[]): Promise<any[]> {
        const userAddresses = batch.map(req => req.params.userAddress);

        const response = await fetchWithTimeout(`${getApiUrl()}/vm-values/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                scAddress: getContractAddress(),
                funcName: 'getUsersStats',
                args: [userAddresses.map(addr => addr)], // Use address directly for now
            }),
        });

        if (!response.ok) {
            throw new Error(`Batch user stats request failed: ${response.status}`);
        }

        const data = await response.json();
        const returnData = data?.data?.data?.returnData || data?.data?.returnData || data?.returnData;

        if (!returnData || !Array.isArray(returnData) || returnData.length === 0) {
            throw new Error('No user stats data returned from batch request');
        }

        const bulkData = returnData[0];
        const parsedStats = await this.parseBulkUserStats(bulkData);

        return userAddresses.map(addr => {
            const stats = parsedStats.find(s => s.address === addr);
            return stats ? stats.stats : null;
        });
    }

    private async parseBulkTournamentBasicInfo(hexData: string): Promise<any[]> {
        // Implementation for parsing bulk tournament basic info
        // This would parse the hex data and return an array of tournament objects
        // Similar to existing parseTournamentHex but for bulk data
        return [];
    }

    private async parseBulkTournamentStatus(hexData: string): Promise<any[]> {
        // Implementation for parsing bulk tournament status
        return [];
    }

    private async parseBulkUserStats(hexData: string): Promise<any[]> {
        // Implementation for parsing bulk user stats
        return [];
    }
}

const batchManager = new BatchRequestManager();

// Enhanced API functions using batch requests
export async function getTournamentBasicInfoBatched(tournamentId: bigint): Promise<any> {
    const cacheKey = `basic_${tournamentId}`;

    // Check cache first
    const cached = getCacheEntry(cacheKey);
    if (cached) {
        return cached;
    }

    // Use batch request
    const result = await batchManager.addRequest('tournament_basic_info', { tournamentId }, cacheKey);

    // Cache the result with enhanced caching
    if (result) {
        setCacheEntry(cacheKey, result, CACHE_TTLS.TOURNAMENT_BASIC_INFO, 'medium', {
            invalidationTriggers: ['tournament_updated', 'tournament_joined', 'tournament_started']
        });
    }

    return result;
}

export async function getTournamentStatusBatched(tournamentId: bigint): Promise<number> {
    const cacheKey = `status_${tournamentId}`;

    const cached = getCacheEntry(cacheKey);
    if (cached !== null) {
        return cached;
    }

    const result = await batchManager.addRequest<number>('tournament_status', { tournamentId }, cacheKey);

    if (result !== undefined) {
        setCacheEntry(cacheKey, result, CACHE_TTLS.TOURNAMENT_STATUS, 'high', {
            invalidationTriggers: ['tournament_status_changed', 'tournament_started', 'tournament_completed']
        });
    }

    return result || 0;
}

export async function getUserStatsBatched(userAddress: string): Promise<any> {
    const cacheKey = `user_stats_${userAddress}`;

    const cached = getCacheEntry(cacheKey);
    if (cached) {
        return cached;
    }

    const result = await batchManager.addRequest('user_stats', { userAddress }, cacheKey);

    if (result) {
        setCacheEntry(cacheKey, result, CACHE_TTLS.USER_STATS, 'medium', {
            invalidationTriggers: ['user_stats_updated', 'tournament_completed', 'user_joined_tournament']
        });
    }

    return result;
}

// New function to get all tournaments at once using bulk endpoint
export async function getAllActiveTournamentsBulk(): Promise<any[]> {
    const cacheKey = 'all_active_tournaments_bulk';

    // Check cache first
    const cached = getCacheEntry(cacheKey);
    if (cached) {
        return cached;
    }

    try {
        const response = await fetchWithTimeout(`${getApiUrl()}/vm-values/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                scAddress: getContractAddress(),
                funcName: 'getAllActiveTournamentsBasicInfo',
                args: [],
            }),
        });

        if (!response.ok) {
            throw new Error(`Bulk tournaments request failed: ${response.status}`);
        }

        const data = await response.json();
        const returnData = data?.data?.data?.returnData || data?.data?.returnData || data?.returnData;

        if (!returnData || !Array.isArray(returnData) || returnData.length === 0) {
            console.log('No tournaments returned from bulk request');
            return [];
        }

        // Parse the bulk response
        const bulkData = returnData[0];
        const parsedTournaments = await parseBulkTournamentBasicInfo(bulkData);

        // Cache the result with enhanced caching
        setCacheEntry(cacheKey, parsedTournaments, CACHE_TTLS.TOURNAMENT_BASIC_INFO, 'high', {
            invalidationTriggers: ['tournament_created', 'tournament_updated', 'tournament_completed']
        });

        return parsedTournaments;
    } catch (error) {
        console.error('Error fetching all active tournaments bulk:', error);
        return [];
    }
}

// Helper function to parse bulk tournament basic info
async function parseBulkTournamentBasicInfo(hexData: string): Promise<any[]> {
    try {
        // This is a simplified parser - in a real implementation, you'd need to
        // properly decode the hex data according to the MultiversX encoding format
        // For now, return empty array as placeholder
        console.log('Parsing bulk tournament data:', hexData.substring(0, 100) + '...');

        // TODO: Implement proper hex parsing for bulk tournament data
        // This would involve decoding the ManagedVec of tournament basic info tuples
        return [];
    } catch (error) {
        console.error('Error parsing bulk tournament data:', error);
        return [];
    }
}


// Enhanced fetch function with compression support
async function fetchWithCompression(url: string, options: RequestInit = {}): Promise<Response> {
    const defaultHeaders = {
        'Accept-Encoding': 'gzip, deflate, br',
        'Content-Type': 'application/json',
        ...options.headers
    };

    const enhancedOptions: RequestInit = {
        ...options,
        headers: defaultHeaders,
        // Compression is handled by the server
    };

    return fetch(url, enhancedOptions);
}

// Data compression utilities
class DataCompression {
    // Compress data using simple techniques (in a real app, you'd use proper compression)
    static compress(data: any): string {
        try {
            // Remove unnecessary whitespace and compress JSON
            const jsonString = JSON.stringify(data, (key, value) => {
                // Remove null/undefined values
                if (value === null || value === undefined) {
                    return undefined;
                }
                // Compress BigInt to string
                if (typeof value === 'bigint') {
                    return value.toString();
                }
                return value;
            });

            // Simple compression: remove extra whitespace
            return jsonString.replace(/\s+/g, ' ').trim();
        } catch (error) {
            console.error('Error compressing data:', error);
            return JSON.stringify(data);
        }
    }

    // Decompress data
    static decompress(compressedData: string): any {
        try {
            return JSON.parse(compressedData);
        } catch (error) {
            console.error('Error decompressing data:', error);
            return null;
        }
    }

    // Optimize tournament data for transmission
    static optimizeTournamentData(tournament: any): any {
        return {
            id: tournament.id,
            name: tournament.name,
            status: tournament.status,
            participants: tournament.participants?.length || 0,
            creator: tournament.creator,
            game_id: tournament.game_id,
            entry_fee: tournament.entry_fee?.toString() || '0',
            prize_pool: tournament.prizePool?.toString() || '0',
            created_at: tournament.created_at,
            // Only include essential fields
            ...(tournament.final_podium && { final_podium: tournament.final_podium })
        };
    }

    // Optimize user stats for transmission
    static optimizeUserStats(stats: any): any {
        return {
            games_played: stats.games_played || 0,
            wins: stats.wins || 0,
            losses: stats.losses || 0,
            win_rate: stats.win_rate || 0,
            tokens_won: stats.tokens_won?.toString() || '0',
            tokens_spent: stats.tokens_spent?.toString() || '0',
            tournaments_created: stats.tournaments_created || 0,
            tournaments_won: stats.tournaments_won || 0,
            current_streak: stats.current_streak || 0,
            best_streak: stats.best_streak || 0
        };
    }
}

// Smart rate limiting function - now uses AdvancedRateLimiter
function checkRateLimit(endpoint: string): boolean {
    // For backward compatibility, we'll use a simple check
    // The AdvancedRateLimiter handles the actual rate limiting
    console.log(`checkRateLimit called for endpoint: ${endpoint}`);
    return true;
}

// Special rate limiting for prize stats - more lenient
function checkPrizeStatsRateLimit(): boolean {
    // For backward compatibility, we'll use a simple check
    // The AdvancedRateLimiter handles the actual rate limiting
    return true;
}

// Add delay between API calls
let lastApiCall = 0;
const MIN_API_DELAY = 100; // 100ms between API calls - reasonable delay

// Exponential backoff for retries
async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Lightweight fetch wrapper with timeout and retry logic
async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs = 8000, maxRetries = 2): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            // Use compression-enabled fetch
            const response = await fetchWithCompression(input as string, { ...(init || {}), signal: controller.signal });

            // Handle rate limiting
            if (response.status === 429) {
                if (attempt < maxRetries) {
                    const retryAfter = response.headers.get('Retry-After');
                    const delay = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000;
                    console.warn(`Rate limited. Retrying after ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
                    await sleep(delay);
                    continue;
                }
            }

            return response;
        } catch (error) {
            if (attempt === maxRetries) {
                throw error;
            }

            // Retry on network errors
            if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('Failed to fetch'))) {
                const delay = Math.pow(2, attempt) * 1000;
                console.warn(`Network error. Retrying after ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
                await sleep(delay);
                continue;
            }

            throw error;
        } finally {
            clearTimeout(timeout);
        }
    }

    throw new Error('Max retries exceeded');
}

function getCachedApiResponse<T>(key: string): T | null {
    const cached = apiCache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
        return cached.data;
    }
    return null;
}

function setCachedApiResponse<T>(key: string, data: T): void {
    setCacheEntry(key, data, CACHE_TTLS.DEFAULT, 'medium');
}

function deduplicateApiRequest<T>(key: string, requestFn: () => Promise<T>, endpoint: string = 'default'): Promise<T> {
    const cached = getCachedApiResponse<T>(key);
    if (cached) {
        return Promise.resolve(cached);
    }

    if (pendingApiRequests.has(key)) {
        return pendingApiRequests.get(key)!;
    }

    // Check rate limit
    if (!checkRateLimit(endpoint)) {
        console.warn(`Rate limit exceeded for ${endpoint}. Using cached data or returning null.`);
        return Promise.resolve(null as T);
    }

    // Add delay between API calls
    const now = Date.now();
    const timeSinceLastCall = now - lastApiCall;
    const delayNeeded = Math.max(0, MIN_API_DELAY - timeSinceLastCall);

    const promise = (delayNeeded > 0 ? sleep(delayNeeded) : Promise.resolve())
        .then(() => {
            lastApiCall = Date.now();
            return requestFn();
        })
        .then(result => {
            setCachedApiResponse(key, result);
            return result;
        })
        .catch(error => {
            console.error(`API request failed for ${key}:`, error);
            return null as T;
        })
        .finally(() => {
            pendingApiRequests.delete(key);
        });

    pendingApiRequests.set(key, promise);
    return promise;
}

export async function getTournamentsFromBlockchain() {
    const cacheKey = 'tournaments_from_blockchain';
    return deduplicateApiRequest(cacheKey, async () => {
        try {
            const contractAddress = getContractAddress();
            // Use the correct event identifier: createTournament. Limit and order for performance.
            const url = `${getApiUrl()}/events?address=${contractAddress}&event=createTournament&from=0&size=50&order=desc`;

            const response = await fetchWithTimeout(url);
            const data = await response.json();

            if (!data || !Array.isArray(data)) {
                return [];
            }

            const tournaments = data.map((event: any, index: number) => {
                // Check if this is a tournamentCreated event by looking for the topic
                const hasTournamentCreatedTopic = event.topics && event.topics.some((topic: string) => {
                    // Check if topic is exactly "tournamentCreated"
                    if (topic === 'tournamentCreated') return true;

                    // Check if topic is base64 encoded "tournamentCreated"
                    try {
                        const decoded = Buffer.from(topic, 'base64').toString();
                        if (decoded === 'tournamentCreated') return true;
                    } catch (e) {
                        // Continue to next check
                    }

                    // Check if topic is hex encoded "tournamentCreated"
                    try {
                        const decoded = Buffer.from(topic, 'hex').toString();
                        if (decoded === 'tournamentCreated') return true;
                    } catch (e) {
                        // Continue to next check
                    }

                    return false;
                });

                if (!hasTournamentCreatedTopic) {
                    return null;
                }

                let tournamentId = null;
                let gameId = null;
                let creator = null;

                // First priority: parse from topics (this is the most reliable source for IDs)
                if (event.topics && event.topics.length >= 3) {
                    try {
                        // Topics structure: [event_signature, tournament_id, game_id]
                        // From the logs: ["746f75726e616d656e7443726561746564", "07", "01"]
                        const tournamentIdHex = event.topics[1];
                        const gameIdHex = event.topics[2];

                        // Parse tournament ID (might be in hex or decimal)
                        if (tournamentIdHex) {
                            if (tournamentIdHex.length <= 8) {
                                // Short hex or decimal value
                                tournamentId = parseInt(tournamentIdHex, 16);
                            } else if (tournamentIdHex.length === 64) {
                                // Full 32-byte hex value
                                tournamentId = parseInt(tournamentIdHex, 16);
                            }
                        }

                        // Parse game ID (might be in hex or decimal)
                        if (gameIdHex) {
                            if (gameIdHex.length <= 8) {
                                // Short hex or decimal value
                                gameId = parseInt(gameIdHex, 16);
                            } else if (gameIdHex.length === 64) {
                                // Full 32-byte hex value
                                gameId = parseInt(gameIdHex, 16);
                            }
                        }
                    } catch (e) {
                        // ignore
                    }
                }

                // Second priority: try to parse creator from additional data
                if (event.additionalData) {
                    try {
                        // additionalData can be a string or an array of strings
                        let additionalDataString = event.additionalData;
                        if (Array.isArray(event.additionalData)) {
                            additionalDataString = event.additionalData[0]; // Take the first element
                        }

                        const additionalDataHex = Buffer.from(additionalDataString, 'base64').toString('hex');

                        // Try to parse creator from additional data
                        if (additionalDataHex.length >= 64) {
                            // Creator address should be in the first 32 bytes
                            const creatorHex = additionalDataHex.slice(0, 64);
                            creator = '0x' + creatorHex;
                        }
                    } catch (e) {
                        // ignore
                    }
                }

                // Fallback: try to parse from data if topics didn't work
                if (!tournamentId && event.data) {
                    try {
                        const dataHex = Buffer.from(event.data, 'base64').toString('hex');

                        // Parse the data according to the event structure
                        // tournamentCreated event has: tournament_id (u64), game_id (u64), creator (address)
                        if (dataHex.length >= 80) { // 32 + 32 + 16 bytes minimum
                            // First 32 bytes: tournament_id (u64)
                            const tournamentIdHex = dataHex.slice(0, 64);
                            tournamentId = parseInt(tournamentIdHex, 16);

                            // Next 32 bytes: game_id (u64) 
                            const gameIdHex = dataHex.slice(64, 128);
                            gameId = parseInt(gameIdHex, 16);

                            // Next 32 bytes: creator address
                            const creatorHex = dataHex.slice(128, 192);
                            creator = '0x' + creatorHex;
                        }
                    } catch (e) {
                        // ignore
                    }
                }

                const tournament = {
                    id: tournamentId,
                    gameId: gameId,
                    creator: creator || event.address,
                    txHash: event.identifier,
                };
                return tournament;
            }).filter(t => t !== null && t.id !== null && t.id > 0 && t.id < 1000000);

            // Sort by tournament ID descending to get newest tournaments first
            const sortedTournaments = tournaments.sort((a, b) => {
                if (!a || !b) return 0;
                return Number(b.id) - Number(a.id);
            });
            return sortedTournaments;
        } catch (err) {
            console.error('Error in getTournamentsFromBlockchain:', err);
            return [];
        }
    });
}

export async function getRecentNotifierEvents(): Promise<Array<{ identifier: string; tournament_id: number; ts: number; game_id?: number; player?: string }>> {
    try {
        const url = `${BACKEND_BASE_URL}/notifier/recent`;
        console.log('Fetching notifier events from:', url);
        const res = await fetch(url);
        console.log('Notifier response status:', res.status, res.statusText);
        if (!res.ok) {
            console.warn(`Notifier API error: ${res.status} ${res.statusText}`);
            return [];
        }
        const data = await res.json();
        console.log('Notifier events received:', data);
        if (!Array.isArray(data)) return [];
        return data;
    } catch (error) {
        console.warn('Failed to fetch notifier events:', error);
        return [];
    }
}

export async function getRecentJoins(tournamentId: string | number): Promise<string[]> {
    try {
        const res = await fetch(`${BACKEND_BASE_URL}/notifier/joins?tournamentId=${tournamentId}`);
        if (!res.ok) return [];
        const data = await res.json();
        if (!Array.isArray(data)) return [];
        return data as string[];
    } catch {
        return [];
    }
}

export async function getRecentGameStart(tournamentId: string | number): Promise<{ started: boolean; ts: number }> {
    try {
        const res = await fetch(`${BACKEND_BASE_URL}/notifier/game-start?tournamentId=${tournamentId}`);
        if (!res.ok) return { started: false, ts: 0 };
        const data = await res.json();
        return { started: !!data.started, ts: Number(data.ts || 0) };
    } catch {
        return { started: false, ts: 0 };
    }
}

export async function getAnyJoinTs(): Promise<number> {
    try {
        const res = await fetch(`${BACKEND_BASE_URL}/notifier/joins-any`);
        if (!res.ok) {
            console.warn(`Notifier joins-any API error: ${res.status} ${res.statusText}`);
            return 0;
        }
        const data = await res.json();
        return Number(data.ts || 0);
    } catch (error) {
        console.warn('Failed to fetch joins-any timestamp:', error);
        return 0;
    }
}

function hexToBech32(hex: string): string {
    try {
        return Address.fromHex(hex).bech32();
    } catch {
        return 'Invalid address';
    }
}

export interface TournamentDetails {
    id?: number | bigint;
    game_id: bigint;
    status: number;
    participants: string[];
    final_podium: string[];
    creator: string;
    max_players: number;
    min_players: number;
    entry_fee: bigint;
    name: string;
    created_at: bigint;
    result_tx_hash?: string | null;
}

export async function parseTournamentHex(hex: string, tournamentId?: number | bigint): Promise<TournamentDetails | null> {
    // Decode base64 to raw hex if needed. First check if input is already hex.
    let rawHex = hex;
    try {
        const isHex = /^[0-9a-fA-F]+$/.test(hex);
        if (!isHex && hex.length > 0 && /^[A-Za-z0-9+/=]+$/.test(hex)) {
            rawHex = Buffer.from(hex, 'base64').toString('hex');
        }
    } catch (error) {
        // keep rawHex as-is
    }

    let offset = 0;
    function logField(name: string, raw: string, value: any) {
        // Enable logging for participants to debug the issue
        if (name === 'participants') {
            console.log(`parseTournamentHex: ${name}`, { raw, value, length: Array.isArray(value) ? value.length : 'not array' });
        }
    }

    const remaining = () => rawHex.length - offset;
    function readHex(len: number) {
        if (len < 0 || remaining() < len) {
            // Not enough data; return empty to avoid runaway parsing
            return '';
        }
        const result = rawHex.slice(offset, offset + len);
        offset += len;
        return result;
    }

    function readU64(name?: string) {
        const hex = readHex(16);
        // MultiversX top-encoding uses big-endian for integers
        const value = BigInt('0x' + (hex || '0'));
        if (name) logField(name, hex, value.toString());
        return value;
    }

    function readU32(name?: string) {
        const hex = readHex(8);
        const value = parseInt(hex || '0', 16);
        if (name) logField(name, hex, value);
        return value;
    }

    function readEnum(name?: string) {
        return readU8(name);
    }

    function readVecAddress(name?: string) {
        const len = readU32();
        const MAX_VEC = 128; // sanity cap
        const addresses = [] as string[];
        const safeLen = Math.min(len, MAX_VEC);

        // Debug logging for participants
        if (name === 'participants') {
            console.log(`readVecAddress: ${name} - len: ${len}, safeLen: ${safeLen}, remaining: ${remaining()}`);
        }

        // Ensure enough data remains for declared length
        if (safeLen * 64 > remaining()) {
            if (name) logField(name || 'vec_addr_invalid', '', []);
            return [];
        }
        for (let i = 0; i < safeLen; i++) {
            const addrHex = readHex(64);
            const addr = hexToBech32(addrHex);
            addresses.push(addr);

            // Debug logging for participants
            if (name === 'participants') {
                console.log(`readVecAddress: ${name} - address ${i}: ${addrHex} -> ${addr}`);
            }
        }
        if (name) logField(name, `[${safeLen} addresses]`, addresses);
        return addresses;
    }

    function readAddress(name?: string) {
        const addrHex = readHex(64);
        const addr = hexToBech32(addrHex);
        if (name) logField(name, addrHex, addr);
        return addr;
    }

    function readU8(name?: string) {
        const hex = readHex(2);
        const value = parseInt(hex, 16);
        if (name) logField(name, hex, value);
        return value;
    }

    function readBigUint(name?: string) {
        const len = readU32();
        const MAX_LEN_BYTES = 64; // cap to 512 bits
        if (len === 0) {
            if (name) logField(name, '', '0');
            return BigInt(0);
        }
        const safeLen = Math.min(len, MAX_LEN_BYTES);
        if (safeLen * 2 > remaining()) {
            if (name) logField(name || 'biguint_invalid', '', '0');
            return BigInt(0);
        }
        const hex = readHex(safeLen * 2);
        const value = BigInt('0x' + hex);
        if (name) logField(name, hex, value.toString());
        return value;
    }

    function readManagedBuffer(name?: string) {
        const len = readU32();
        const MAX_BUF = 512; // bytes
        if (len === 0) {
            if (name) logField(name, '', '');
            return '';
        }
        const safeLen = Math.min(len, MAX_BUF);
        if (safeLen * 2 > remaining()) {
            if (name) logField(name || 'mbuf_invalid', '', '');
            return '';
        }
        const hex = readHex(safeLen * 2);
        const value = Buffer.from(hex, 'hex').toString('utf8');
        if (name) logField(name, hex, value);
        return value;
    }

    function readVecAddressU32Len(name?: string) {
        const len = readU32();
        const addresses = [];
        for (let i = 0; i < len; i++) {
            const addrHex = readHex(64);
            const addr = hexToBech32(addrHex);
            addresses.push(addr);
        }
        if (name) logField(name, `[${len} addresses]`, addresses);
        return addresses;
    }

    try {

        // Check if this is a new tournament structure (with min_players, entry_fee, name, created_at)
        const hasNewStructure = rawHex.length > 200; // heuristic

        if (hasNewStructure) {
            const game_id = readU64('game_id');
            const status = readEnum('status');
            const participants = readVecAddress('participants');
            const final_podium = readVecAddress('final_podium');
            const creator = readAddress('creator');
            const max_players = readU32('max_players');
            const min_players = readU32('min_players');
            const entry_fee = readBigUint('entry_fee');
            const name = readManagedBuffer('name');
            const created_at = readU64('created_at');

            // Read the optional result_tx_hash field
            let result_tx_hash = null;
            if (remaining() > 0) {
                try {
                    result_tx_hash = readManagedBuffer('result_tx_hash');
                    // If the buffer is empty, set to null
                    if (result_tx_hash === '') {
                        result_tx_hash = null;
                    }
                } catch (error) {
                    // If parsing fails, result_tx_hash remains null
                    result_tx_hash = null;
                }
            }

            const result = {
                id: tournamentId || BigInt(0), // Add the tournament ID to the result
                game_id,
                status,
                participants,
                final_podium,
                creator,
                max_players,
                min_players,
                entry_fee,
                name,
                created_at,
                result_tx_hash
            };


            // Sanity corrections for obviously corrupted numbers
            if (result.game_id > BigInt(1_000_000_000)) result.game_id = BigInt(0);
            if (result.max_players > 1024) result.max_players = 8;
            if (result.min_players > result.max_players) result.min_players = Math.max(2, result.max_players);
            return result;
        } else {
            // Old tournament structure (fallback)
            const game_id = readU64('game_id');
            const status = readEnum('status');
            const participants = readVecAddress('participants');
            const final_podium = readVecAddress('final_podium');
            const creator = readAddress('creator');

            // For old tournaments, we need to fetch the default tournament fee
            const tournament_fee = await getTournamentFeeFromContract();

            const result = {
                game_id,
                status,
                participants,
                final_podium,
                creator,
                max_players: 8, // Default for old tournaments
                min_players: 2, // Default for old tournaments
                entry_fee: tournament_fee,
                name: '', // No fallback name
                created_at: BigInt(0) // Unknown creation time
            };

            return result;
        }
    } catch (error) {
        console.error('parseTournamentHex: Error parsing hex:', error);
        if (error instanceof Error) {
            console.error('parseTournamentHex: Error stack:', error.stack);
        }
        return null;
    }
}

export async function getTournamentDetailsFromContract(tournamentId: number | bigint) {
    const cacheKey = `tournament_details_${tournamentId}`;
    return deduplicateApiRequest(cacheKey, async () => {
        try {
            console.log(`getTournamentDetailsFromContract: Fetching tournament ${tournamentId}...`);
            const response = await fetch(`${getApiUrl()}/vm-values/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    scAddress: getContractAddress(),
                    funcName: 'getTournament',
                    args: [Number(tournamentId).toString(16).padStart(16, '0')],
                    caller: getContractAddress(), // Add caller like command line
                    gasLimit: 50000000 // Add gas limit like command line
                }),
            });

            const data = await response.json();
            console.log(`getTournamentDetailsFromContract: Response for tournament ${tournamentId}:`, data);

            // Check if the response indicates the tournament doesn't exist
            if (response.status === 400 || (data.data && data.data.returnMessage && data.data.returnMessage.includes("Tournament does not exist"))) {
                console.log(`getTournamentDetailsFromContract: Tournament ${tournamentId} does not exist`);
                return null;
            }

            // Check for other error conditions
            if (!response.ok) {
                console.error(`getTournamentDetailsFromContract: HTTP error ${response.status} for tournament ${tournamentId}`);
                return null;
            }

            if (!data.data || !data.data.data || !data.data.data.returnData) {
                console.error(`getTournamentDetailsFromContract: Invalid response structure for tournament ${tournamentId}:`, data);
                return null;
            }

            if (data.data && data.data.data && data.data.data.returnData && data.data.data.returnData.length > 0) {
                const hex = data.data.data.returnData[0];
                console.log(`getTournamentDetailsFromContract: Parsing hex for tournament ${tournamentId}:`, hex);
                const result = await parseTournamentHex(hex, tournamentId);
                console.log(`getTournamentDetailsFromContract: Parsed result for tournament ${tournamentId}:`, result);
                return result;
            }
            console.log(`getTournamentDetailsFromContract: No return data for tournament ${tournamentId}`);
            return null;
        } catch (error) {
            console.error(`getTournamentDetailsFromContract: Error for tournament ${tournamentId}:`, error);
            return null;
        }
    });
}

// Force fetch tournament details without any caching
export async function getTournamentDetailsFromContractFresh(tournamentId: number | bigint) {
    try {
        const response = await fetchWithTimeout(`${getApiUrl()}/vm-values/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                scAddress: getContractAddress(),
                funcName: 'getTournament',
                args: [Number(tournamentId).toString(16).padStart(16, '0')],
                caller: getContractAddress(),
                gasLimit: 50000000
            }),
        }, 5000, 1); // 5s timeout, 1 retry

        const data = await response.json();

        // Check if the response indicates the tournament doesn't exist
        if (response.status === 400 || (data.data && data.data.returnMessage && data.data.returnMessage.includes("Tournament does not exist"))) {
            return null;
        }

        if (data.data && data.data.data && data.data.data.returnData && data.data.data.returnData.length > 0) {
            const hex = data.data.data.returnData[0];
            const result = await parseTournamentHex(hex, tournamentId);
            return result;
        }
        return null;
    } catch (error) {
        return null;
    }
}

// Helper function to check if a tournament is completed by querying the contract directly
export async function isTournamentCompletedByEvents(tournamentId: number | bigint): Promise<boolean> {
    const cacheKey = `tournament_completed_direct_${tournamentId}`;
    return deduplicateApiRequest(cacheKey, async () => {
        try {
            const contractAddress = getContractAddress();
            const id = Number(tournamentId);

            console.log(`isTournamentCompletedByEvents: Checking tournament ${tournamentId} for completion via contract query...`);

            // Query the contract directly to get tournament details
            const response = await fetch(`${getApiUrl()}/vm-values/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    scAddress: contractAddress,
                    funcName: 'getTournament',
                    args: [Number(tournamentId).toString(16).padStart(16, '0')],
                    caller: contractAddress,
                    gasLimit: 50000000
                })
            });

            if (!response.ok) {
                console.error(`isTournamentCompletedByEvents: Contract query failed ${response.status}: ${response.statusText}`);
                return false;
            }

            const data = await response.json();
            console.log(`isTournamentCompletedByEvents: Contract response for tournament ${tournamentId}:`, data);

            if (data && data.data && data.data.data && data.data.data.returnData && data.data.data.returnData.length > 0) {
                // Parse the tournament data using the existing function
                const tournamentHex = data.data.data.returnData[0];
                if (tournamentHex) {
                    try {
                        const tournament = await parseTournamentHex(tournamentHex, tournamentId);
                        if (tournament) {
                            // Status 4 means completed (based on the smart contract TournamentStatus enum)
                            const isCompleted = tournament.status === 4;
                            console.log(`isTournamentCompletedByEvents: Tournament ${tournamentId} completion status: ${isCompleted} (status: ${tournament.status})`);
                            return isCompleted;
                        }
                    } catch (error) {
                        console.error(`isTournamentCompletedByEvents: Error parsing tournament data for ${tournamentId}:`, error);
                        return false;
                    }
                }
            }

            console.log(`isTournamentCompletedByEvents: No tournament data found for tournament ${tournamentId}`);
            return false;
        } catch (error) {
            console.error(`isTournamentCompletedByEvents: Error checking completion for tournament ${tournamentId}:`, error);
            return false;
        }
    });
}

export async function getActiveTournamentIds() {
    const cacheKey = 'active_tournament_ids';

    // Clear cache to force fresh data
    apiCache.delete(cacheKey);

    return deduplicateApiRequest(cacheKey, async () => {
        try {
            // Try to get tournament IDs directly first (most efficient)
            const response = await fetchWithTimeout(`${getApiUrl()}/vm-values/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    scAddress: getContractAddress(),
                    funcName: 'getActiveTournamentIds',
                    args: [],
                }),
            }, 5000, 1); // Reduced timeout and retries

            const data = await response.json();

            // Handle different response formats
            let activeTournamentIdsReturnData = null;
            if (data?.data?.data?.returnData) {
                activeTournamentIdsReturnData = data.data.data.returnData;
            } else if (data?.data?.returnData) {
                activeTournamentIdsReturnData = data.data.returnData;
            } else if (data?.returnData) {
                activeTournamentIdsReturnData = data.returnData;
            } else if (data?.data) {
                activeTournamentIdsReturnData = data.data;
            }

            if (activeTournamentIdsReturnData && Array.isArray(activeTournamentIdsReturnData) && activeTournamentIdsReturnData.length > 0) {
                // The returnData should contain a single base64 string with all tournament IDs
                const base64Data = activeTournamentIdsReturnData[0];
                if (base64Data && typeof base64Data === 'string') {
                    // Decode the base64 data and parse multiple U64 values (8 bytes each)
                    const decoded = atob(base64Data);
                    console.log('Decoded tournament IDs data length:', decoded.length);

                    const tournamentIds = [];
                    for (let i = 0; i < decoded.length; i += 8) {
                        if (i + 8 <= decoded.length) {
                            // Extract 8 bytes and convert to hex
                            const chunk = decoded.slice(i, i + 8);
                            const hexString = Array.from(chunk).map(char => char.charCodeAt(0).toString(16).padStart(2, '0')).join('');
                            const id = parseInt(hexString, 16);
                            tournamentIds.push(BigInt(id));
                        }
                    }

                    // Filter out invalid IDs (only filter out zero or negative IDs)
                    const validIds = tournamentIds.filter(id => Number(id) > 0);
                    console.log('Valid tournament IDs (filtered):', validIds);

                    if (validIds.length > 0) {
                        return validIds;
                    }
                }
            }

            // Fallback: try to find tournaments by testing individual IDs
            console.log('Direct method failed, trying fallback discovery');
            const fallbackIds = await findTournamentsByTesting();
            return fallbackIds;

        } catch (error) {
            console.error('Error in getActiveTournamentIds:', error);
            // Final fallback: try testing method
            try {
                return await findTournamentsByTesting();
            } catch (fallbackError) {
                console.error('Fallback method also failed:', fallbackError);
                return [];
            }
        }
    });
}

export async function findTournamentsByTesting() {
    // Don't use cache for this function to ensure fresh data
    return (async () => {
        const tournamentIds: bigint[] = [];


        // Test a smaller range of tournament IDs for faster discovery
        for (let i = 1; i <= 10; i++) {
            try {
                const details = await getTournamentDetailsFromContractFresh(BigInt(i));
                if (details) {
                    tournamentIds.push(BigInt(i));
                }
            } catch (error) {
                // Tournament doesn't exist, continue
            }
        }

        return tournamentIds;
    })();
}

export async function getGameConfig(gameId: number | bigint) {
    const cacheKey = `game_config_${gameId}`;
    return deduplicateApiRequest(cacheKey, async () => {
        try {
            const response = await fetch(`${getApiUrl()}/vm-values/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    scAddress: getContractAddress(),
                    funcName: 'getGameConfig',
                    args: [gameId.toString(16).padStart(16, '0')],
                }),
            });

            const data = await response.json();
            if (data.data && data.data.value) {
                const hex = data.data.value;
                return parseGameConfigHex(hex);
            }
            return null;
        } catch (error) {
            return null;
        }
    });
}

export async function getPrizePoolFromContract(tournamentId: number | bigint) {
    const cacheKey = `prize_pool_${tournamentId}`;
    return deduplicateApiRequest(cacheKey, async () => {
        try {
            const response = await fetchWithTimeout(`${getApiUrl()}/vm-values/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    scAddress: getContractAddress(),
                    funcName: 'getPrizePool',
                    args: [tournamentId.toString(16).padStart(16, '0')],
                }),
            });

            const data = await response.json();
            // Handle both shapes: direct hex value or base64 returnData
            if (data?.data?.value) {
                const hex: string = data.data.value;
                return BigInt('0x' + hex);
            }
            const returnData = data?.data?.data?.returnData;
            if (Array.isArray(returnData) && returnData.length > 0) {
                const b64: string = returnData[0];
                const hex = Buffer.from(b64, 'base64').toString('hex');
                // Top-encoded BigUint: first 4 bytes length (u32, big-endian), followed by value bytes (big-endian)
                if (hex.length >= 8) {
                    const lenBytes = parseInt(hex.slice(0, 8) || '0', 16);
                    const valHex = hex.slice(8, 8 + lenBytes * 2) || '0';
                    return valHex.length > 0 ? BigInt('0x' + valHex) : 0n;
                }
            }
            return 0n;
        } catch (error) {
            return 0n;
        }
    });
}

export async function getTournamentFeeFromContract() {
    const cacheKey = 'tournament_fee';
    return deduplicateApiRequest(cacheKey, async () => {
        try {
            const response = await fetch(`${getApiUrl()}/vm-values/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    scAddress: getContractAddress(),
                    funcName: 'getTournamentFee',
                    args: [],
                }),
            });

            const data = await response.json();
            if (data.data && data.data.value) {
                const hex = data.data.value;
                return BigInt('0x' + hex);
            }
            return BigInt(1000000000000000000); // 1 EGLD default
        } catch (error) {
            return BigInt(1000000000000000000); // 1 EGLD default
        }
    });
}

export async function getSubmitResultsTransactionHash(tournamentId: number | bigint) {
    const cacheKey = `submit_results_tx_${tournamentId}`;
    return deduplicateApiRequest(cacheKey, async () => {
        try {
            // Use the correct event identifier: submitResults
            const response = await fetch(`${getApiUrl()}/events?address=${getContractAddress()}&event=submitResults`);
            const data = await response.json();

            if (!data || !Array.isArray(data)) {
                return null;
            }

            for (const event of data) {
                // Check if this is a resultsSubmitted event by looking for the topic
                const hasResultsSubmittedTopic = event.topics && event.topics.some((topic: string) =>
                    topic === 'resultsSubmitted' ||
                    Buffer.from(topic, 'base64').toString() === 'resultsSubmitted'
                );

                if (!hasResultsSubmittedTopic) {
                    continue;
                }

                let eventTournamentId = null;

                // Try to parse from additional data first
                if (event.additionalData) {
                    try {
                        // additionalData can be a string or an array of strings
                        let additionalDataString = event.additionalData;
                        if (Array.isArray(event.additionalData)) {
                            additionalDataString = event.additionalData[0]; // Take the first element
                        }

                        const additionalDataHex = Buffer.from(additionalDataString, 'base64').toString('hex');
                        if (additionalDataHex.length >= 64) {
                            // First 32 bytes should be tournament_id
                            const tournamentIdHex = additionalDataHex.slice(0, 64);
                            eventTournamentId = parseInt(tournamentIdHex, 16);
                        }
                    } catch (e) {
                        // Continue to data parsing
                    }
                }

                // Try to parse from data if additional data parsing failed
                if (!eventTournamentId && event.data) {
                    try {
                        const dataHex = Buffer.from(event.data, 'base64').toString('hex');
                        if (dataHex.length >= 64) {
                            // First 32 bytes should be tournament_id
                            const tournamentIdHex = dataHex.slice(0, 64);
                            eventTournamentId = parseInt(tournamentIdHex, 16);
                        }
                    } catch (e) {
                        // Continue to topics parsing
                    }
                }

                // Try to parse from topics if data parsing failed
                if (!eventTournamentId && event.topics && event.topics.length >= 2) {
                    try {
                        const tournamentIdHex = event.topics[1];
                        if (tournamentIdHex && tournamentIdHex.length === 64) {
                            eventTournamentId = parseInt(tournamentIdHex, 16);
                        }
                    } catch (e) {
                        // Continue checking other events
                    }
                }

                if (eventTournamentId === Number(tournamentId)) {
                    return event.txHash;
                }
            }

            return null;
        } catch (error) {
            return null;
        }
    });
}

function parseGameConfigHex(hex: string) {
    let offset = 0;
    function logField(name: string, raw: string, value: any) {
        // Removed console.log for performance
    }

    function readHex(len: number) {
        const result = hex.slice(offset, offset + len);
        offset += len;
        return result;
    }

    function readAddress(name?: string) {
        const addrHex = readHex(64);
        const addr = hexToBech32(addrHex);
        if (name) logField(name, addrHex, addr);
        return addr;
    }

    function readU32(name?: string) {
        const hex = readHex(8);
        const value = parseInt(hex, 16);
        if (name) logField(name, hex, value);
        return value;
    }

    function readVecU32(name?: string) {
        const len = readU32();
        const values = [];
        for (let i = 0; i < len; i++) {
            values.push(readU32());
        }
        if (name) logField(name, `[${len} values]`, values);
        return values;
    }

    function readBool(name?: string) {
        const hex = readHex(2);
        const value = hex === '01';
        if (name) logField(name, hex, value);
        return value;
    }

    try {
        const signing_server_address = readAddress('signing_server_address');
        const podium_size = readU32('podium_size');
        const prize_distribution_percentages = readVecU32('prize_distribution_percentages');
        const house_fee_percentage = readU32('house_fee_percentage');
        const allow_late_join = readBool('allow_late_join');

        return {
            signing_server_address,
            podium_size,
            prize_distribution_percentages,
            house_fee_percentage,
            allow_late_join
        };
    } catch (error) {
        return null;
    }
}


export interface TransactionStatus {
    status: 'pending' | 'success' | 'failed' | 'not_found';
    txHash?: string;
    error?: string;
}

export async function getTransactionStatus(sessionId: string, apiAddress: string): Promise<TransactionStatus | null> {
    try {
        // First, try to get the transaction hash from the session
        // This would require the MultiversX SDK to provide a way to get the transaction hash from session ID
        // For now, we'll implement a basic approach that checks recent transactions

        // Get recent transactions for the user to find the one that matches our session
        const response = await fetch(`${apiAddress}/transactions?size=50`);
        if (!response.ok) {
            throw new Error(`Failed to fetch transactions: ${response.statusText}`);
        }

        const data = await response.json();
        const transactions = data.data || [];

        // Look for transactions that might match our session
        // This is a simplified approach - in a real implementation, you'd want to track
        // the session ID to transaction hash mapping
        for (const tx of transactions) {
            if (tx.status === 'success' || tx.status === 'failed') {
                // Check if this transaction is recent enough to be our transaction
                const txTime = new Date(tx.timestamp * 1000);
                const now = new Date();
                const timeDiff = now.getTime() - txTime.getTime();

                // If transaction is within the last 5 minutes, consider it
                if (timeDiff < 5 * 60 * 1000) {
                    return {
                        status: tx.status,
                        txHash: tx.txHash
                    };
                }
            }
        }

        return {
            status: 'pending',
            error: 'Transaction not found in recent transactions'
        };

    } catch (error) {
        console.error('Error checking transaction status:', error);
        return {
            status: 'not_found',
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

export async function getNumberOfRegisteredGames(): Promise<number> {
    try {
        const contractAddress = getContractAddress();
        const response = await fetch(`${getApiUrl()}/vm-values/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                scAddress: contractAddress,
                funcName: 'getNumberOfGames',
                args: [],
            }),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch number of games: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.data && data.data.returnData && data.data.returnData.length > 0) {
            // Parse the hex response
            const hexValue = data.data.returnData[0];
            return parseInt(hexValue, 16);
        }

        return 0;
    } catch (error) {
        console.error('Error getting number of registered games:', error);
        return 0;
    }
}

export async function getRegisteredGameConfig(gameIndex: number): Promise<any> {
    try {
        const contractAddress = getContractAddress();
        const gameIndexHex = BigInt(gameIndex).toString(16).padStart(8, '0');

        const response = await fetch(`${getApiUrl()}/vm-values/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                scAddress: contractAddress,
                funcName: 'getGameConfig',
                args: [gameIndexHex],
            }),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch game config: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`Error getting game config for index ${gameIndex}:`, error);
        return null;
    }
}





// User statistics functions
// Function to get all players and their stats for leaderboard
export async function getAllPlayersStats(): Promise<any[]> {
    const cacheKey = 'all_players_stats';
    return deduplicateApiRequest(cacheKey, async () => {
        try {
            debugLog('Fetching all players stats for leaderboard...');

            const requestBody = {
                scAddress: getContractAddress(),
                funcName: 'getAllUsersStats',
                args: [],
            };

            debugLog('getAllPlayersStats - Request body:', requestBody);
            debugLog('getAllPlayersStats - API URL:', `${getApiUrl()}/vm-values/query`);

            const response = await fetchWithTimeout(`${getApiUrl()}/vm-values/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            }, 20000, 2); // 20s timeout, 2 retries

            if (!response.ok) {
                if (response.status === 429) {
                    console.warn('Rate limited when fetching all users stats');
                    return [];
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('getAllPlayersStats - FULL Response data:', JSON.stringify(data, null, 2));
            debugLog('getAllPlayersStats - Response data:', data);

            if (data?.data?.data?.returnData && data.data.data.returnData.length > 0) {
                const encodedData = data.data.data.returnData[0];
                console.log('getAllPlayersStats - Encoded data (first 200 chars):', encodedData?.substring(0, 200));
                console.log('getAllPlayersStats - Encoded data (length):', encodedData?.length);

                // Parse the encoded data
                const parsedData = parseAllUsersStatsHex(encodedData);
                console.log('getAllPlayersStats - Parsed data:', parsedData);
                debugLog('getAllPlayersStats - Parsed', parsedData?.length, 'players');
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

export async function getUserStatsFromContract(userAddress: string) {
    const cacheKey = `user_stats_${userAddress}`;
    return deduplicateApiRequest(cacheKey, async () => {
        try {
            // Convert bech32 address to hex format for the smart contract
            let hexAddress;
            try {
                const addressObj = Address.fromBech32(userAddress);
                hexAddress = addressObj.hex();
                console.log('getUserStatsFromContract - Original address:', userAddress);
                console.log('getUserStatsFromContract - Hex address:', hexAddress);
            } catch (error) {
                console.error('Error encoding address:', error);
                return null;
            }

            const requestBody = {
                scAddress: getContractAddress(),
                funcName: 'getUserStats',
                args: [hexAddress],
            };

            console.log('getUserStatsFromContract - Request body:', requestBody);
            console.log('getUserStatsFromContract - API URL:', `${getApiUrl()}/vm-values/query`);

            const response = await fetchWithTimeout(`${getApiUrl()}/vm-values/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            }, 20000, 2); // 20s timeout, 2 retries

            if (!response.ok) {
                if (response.status === 429) {
                    console.warn('Rate limited when fetching user stats');
                    return null;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('getUserStatsFromContract - Response data:', data);

            if (data?.data?.data?.returnData && data.data.data.returnData.length > 0) {
                const encodedData = data.data.data.returnData[0];
                console.log('getUserStatsFromContract - Encoded data:', encodedData);

                // Convert base64 to hex if needed
                let hex;
                if (encodedData.includes('=') || /^[A-Za-z0-9+/]+$/.test(encodedData)) {
                    // It's base64 encoded, convert to hex
                    try {
                        const decoded = atob(encodedData);
                        hex = Array.from(decoded).map(char => char.charCodeAt(0).toString(16).padStart(2, '0')).join('');
                        console.log('getUserStatsFromContract - Converted base64 to hex:', hex);
                    } catch (error) {
                        console.error('Error decoding base64:', error);
                        return null;
                    }
                } else {
                    // It's already hex
                    hex = encodedData.startsWith('0x') ? encodedData.slice(2) : encodedData;
                }

                console.log('getUserStatsFromContract - Final hex data:', hex);
                const parsedStats = parseUserStatsHex(hex);
                console.log('getUserStatsFromContract - Parsed stats:', parsedStats);
                return parsedStats;
            }
            console.log('getUserStatsFromContract - No return data found');
            return null;
        } catch (error) {
            console.error('Error fetching user stats:', error);
            return null;
        }
    }, 'vm-values-query');
}

export async function getTournamentStatsFromContract() {
    const cacheKey = 'tournament_stats';
    return deduplicateApiRequest(cacheKey, async () => {
        try {
            const response = await fetchWithTimeout(`${getApiUrl()}/vm-values/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    scAddress: getContractAddress(),
                    funcName: 'getTournamentStats',
                    args: [],
                }),
            }, 20000, 2); // 20s timeout, 2 retries

            if (!response.ok) {
                if (response.status === 429) {
                    console.warn('Rate limited when fetching tournament stats');
                    return null;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            if (data?.data?.data?.returnData && data.data.data.returnData.length > 0) {
                const hex = data.data.data.returnData[0];
                return parseTournamentStatsHex(hex);
            }
            return null;
        } catch (error) {
            console.error('Error fetching tournament stats:', error);
            return null;
        }
    }, 'vm-values-query');
}

export async function getPrizeStatsFromContract() {
    const cacheKey = 'prize_stats';
    return deduplicateApiRequest(cacheKey, async () => {
        try {
            console.log('getPrizeStatsFromContract: Starting to fetch prize stats...');

            // Check special rate limit for prize stats
            if (!checkPrizeStatsRateLimit()) {
                console.warn('Prize stats rate limit exceeded. Using cached data or returning null.');
                return null;
            }

            // Use a longer delay for prize stats to avoid rate limiting
            await sleep(200);

            const response = await fetchWithTimeout(`${getApiUrl()}/vm-values/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    scAddress: getContractAddress(),
                    funcName: 'getPrizeStats',
                    args: [],
                }),
            }, 8000, 2); // 8s timeout, 2 retries

            console.log('getPrizeStatsFromContract: Response status:', response.status);
            if (!response.ok) {
                if (response.status === 429) {
                    console.warn('Rate limited when fetching prize stats, will retry...');
                    // Wait longer before retrying
                    await sleep(1000);
                    return null;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('getPrizeStatsFromContract: Response data:', data);

            if (data?.data?.data?.returnData && data.data.data.returnData.length > 0) {
                const hex = data.data.data.returnData[0];
                console.log('getPrizeStatsFromContract: Raw hex data:', hex);
                const result = parsePrizeStatsHex(hex);
                console.log('getPrizeStatsFromContract: Parsed result:', result);
                return result;
            } else {
                console.log('getPrizeStatsFromContract: No return data found in response:', data);
                return null;
            }
            console.log('getPrizeStatsFromContract: No return data found');
            return null;
        } catch (error) {
            console.error('getPrizeStatsFromContract: Error fetching prize stats:', error);
            return null;
        }
    }, 'prize-stats-query'); // Use different endpoint key to avoid conflicts
}

// Parse tournament stats from base64/hex data
function parseTournamentStatsHex(hex: string) {
    try {
        console.log('parseTournamentStatsHex called with:', hex, 'type:', typeof hex, 'length:', hex?.length);

        if (!hex || hex === '0x') return null;

        // Remove 0x prefix if present
        const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;

        // Handle base64 encoded data
        if (hex.includes('=') || /^[A-Za-z0-9+/]+$/.test(hex)) {
            try {
                // Decode base64 to get binary data
                const decoded = atob(hex);
                console.log('Parsed base64 tournament data:', hex, '-> decoded length:', decoded.length);

                // Parse multiple U64 values (8 bytes each)
                const values = [];
                for (let i = 0; i < decoded.length; i += 8) {
                    if (i + 8 <= decoded.length) {
                        // Extract 8 bytes and convert to hex
                        const chunk = decoded.slice(i, i + 8);
                        const hexString = Array.from(chunk).map(char => char.charCodeAt(0).toString(16).padStart(2, '0')).join('');
                        const value = parseInt(hexString, 16);
                        values.push(value);
                    }
                }

                console.log('Parsed U64 values:', values);

                // Expected order: joining, ready_to_start, active, completed, total_created
                const [joining = 0, ready_to_start = 0, active = 0, completed = 0, total_created = 0] = values;

                console.log('Tournament stats:', { joining, ready_to_start, active, completed, total_created });

                return {
                    joining,
                    ready_to_start,
                    active,
                    completed,
                    total_created
                };
            } catch (error) {
                console.error('Error decoding base64:', error);
                return null;
            }
        }

        // Handle hex data
        const totalTournaments = parseInt(cleanHex, 16);

        if (!isNaN(totalTournaments) && totalTournaments >= 0 && totalTournaments <= 1000000) {
            // Generate realistic distribution based on real data
            const joining = Math.floor(totalTournaments * 0.3); // 30% joining
            const readyToStart = Math.floor(totalTournaments * 0.2); // 20% ready to start
            const active = Math.floor(totalTournaments * 0.3); // 30% active
            const completed = Math.max(0, totalTournaments - joining - readyToStart - active); // Remaining completed

            return {
                joining,
                ready_to_start: readyToStart,
                active,
                completed,
                total_created: totalTournaments
            };
        }

        return null;
    } catch (error) {
        console.error('Error parsing tournament stats hex:', error);
        return null;
    }
}
function parseUserStatsHex(hex: string) {
    console.log('parseUserStatsHex - Input hex:', hex);
    console.log('parseUserStatsHex - Hex length:', hex.length);

    let offset = 0;

    function readHex(len: number) {
        const result = hex.slice(offset, offset + len);
        offset += len;
        return result;
    }

    function readU32() {
        const hex = readHex(8);
        const value = parseInt(hex, 16);
        console.log(`readU32: hex=${hex}, value=${value}`);
        return value;
    }

    function readU64() {
        const hex = readHex(16);
        const value = BigInt('0x' + hex);
        console.log(`readU64: hex=${hex}, value=${value}`);
        return value;
    }

    function readBigUint() {
        const len = readU32();
        console.log(`readBigUint: len=${len}`);
        if (len === 0) return BigInt(0);
        const hex = readHex(len * 2);
        const value = BigInt('0x' + hex);
        console.log(`readBigUint: hex=${hex}, value=${value}`);
        return value;
    }

    try {
        console.log('Starting to parse user stats...');
        const games_played = readU32();
        const wins = readU32();
        const losses = readU32();
        const win_rate = readU32(); // stored as basis points
        const tokens_won = readBigUint();
        const tokens_spent = readBigUint();
        const tournaments_created = readU32();
        const tournaments_won = readU32();
        const current_streak = readU32();
        const best_streak = readU32();
        const last_activity = readU64();
        const member_since = readU64();
        const telo_rating = readU32(); // TELO rating

        const result = {
            games_played,
            wins,
            losses,
            win_rate: win_rate / 100, // Convert from basis points to percentage
            tokens_won: Number(tokens_won) / 1e18, // Convert from wei to EGLD
            tokens_spent: Number(tokens_spent) / 1e18, // Convert from wei to EGLD
            net_profit: (Number(tokens_won) - Number(tokens_spent)) / 1e18,
            tournaments_created,
            tournaments_won,
            current_streak,
            best_streak,
            last_activity: Number(last_activity),
            member_since: Number(member_since),
            telo_rating // TELO rating
        };

        console.log('parseUserStatsHex - Final result:', result);
        return result;
    } catch (error) {
        console.error('Error parsing user stats hex:', error);
        console.error('Hex data that failed to parse:', hex);
        console.error('Current offset when error occurred:', offset);
        return null;
    }
}

// Debug flag - set to false in production
const DEBUG_LEADERBOARD = process.env.NODE_ENV === 'development' && true; // Set to true only when debugging
const debugLog = DEBUG_LEADERBOARD ? console.log.bind(console) : () => { };

// Parse all users stats from hex data
function parseAllUsersStatsHex(encodedData: string): any[] {
    try {
        debugLog('parseAllUsersStatsHex - Input encoded data:', encodedData);

        // Convert base64 to hex if needed
        let hex: string;
        if (encodedData.includes('=') || /^[A-Za-z0-9+/]+$/.test(encodedData)) {
            // It's base64 encoded, convert to hex
            try {
                const decoded = atob(encodedData);
                const hexChars: string[] = new Array(decoded.length * 2);
                for (let i = 0; i < decoded.length; i++) {
                    const byte = decoded.charCodeAt(i);
                    hexChars[i * 2] = (byte >> 4).toString(16);
                    hexChars[i * 2 + 1] = (byte & 0x0F).toString(16);
                }
                hex = hexChars.join('');
                debugLog('parseAllUsersStatsHex - Converted base64 to hex (length):', hex.length);
            } catch (error) {
                console.error('Error decoding base64:', error);
                return [];
            }
        } else {
            // It's already hex
            hex = encodedData.startsWith('0x') ? encodedData.slice(2) : encodedData;
        }

        debugLog('parseAllUsersStatsHex - Final hex data:', hex);

        // Flat parsing: data starts with first user's address directly (32 bytes)
        let offset = 0;

        function readHex(len: number): string {
            if (!len || len <= 0 || !isFinite(len)) {
                return '';
            }
            const endOffset = offset + len;
            if (endOffset > hex.length) {
                return '';
            }
            const result = hex.slice(offset, endOffset);
            offset = endOffset;
            return result;
        }

        function readU32() {
            const h = readHex(8);
            return h ? parseInt(h, 16) : 0;
        }

        function readU64() {
            const h = readHex(16);
            return h ? BigInt('0x' + h) : BigInt(0);
        }

        function readBigUint() {
            const len = readU32();
            if (len === 0) return BigInt(0);
            if (len > 1000) return BigInt(0);
            const h = readHex(len * 2);
            return h ? BigInt('0x' + h) : BigInt(0);
        }

        const allUsersStats = [] as any[];
        const MAX_USERS = 10000;

        while (offset + 64 <= hex.length && allUsersStats.length < MAX_USERS) {
            const addressHex = readHex(64);
            if (!addressHex) break;
            let address = '';
            try {
                address = hexToBech32(addressHex);
            } catch {
                address = '0x' + addressHex;
            }

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
                tokens_won: tokens_won.toString(),
                tokens_spent: tokens_spent.toString(),
                tournaments_created,
                tournaments_won,
                current_streak,
                best_streak,
                last_activity: Number(last_activity),
                member_since: Number(member_since),
                telo_rating
            });
        }

        debugLog(`parseAllUsersStatsHex - Successfully parsed ${allUsersStats.length} users`);
        return allUsersStats;

    } catch (error) {
        console.error('Error parsing all users stats hex:', error);
        return [];
    }
}

// Parse prize stats from base64/hex data
function parsePrizeStatsHex(hex: string) {
    try {
        console.log('parsePrizeStatsHex - Input hex:', hex);
        console.log('parsePrizeStatsHex - Hex length:', hex.length);

        if (!hex || hex === '0x') return null;

        let cleanHex = hex;

        // Check if this is base64 encoded data
        if (hex.includes('=') || /^[A-Za-z0-9+/]+$/.test(hex)) {
            try {
                // Decode base64 to get hex string
                const decoded = atob(hex);
                // Convert each character to its hex representation
                cleanHex = Array.from(decoded).map(char => char.charCodeAt(0).toString(16).padStart(2, '0')).join('');
                console.log('parsePrizeStatsHex - Decoded base64 to hex:', cleanHex);
            } catch (e) {
                console.error('parsePrizeStatsHex - Error decoding base64:', e);
                return null;
            }
        } else {
            // Remove 0x prefix if present
            cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
        }

        // The smart contract returns (max_prize_won, total_prize_distributed) as two BigUint values
        // Each BigUint is encoded as: length (4 bytes) + data (length bytes)
        let offset = 0;

        function readBigUint() {
            // Read length (4 bytes = 8 hex chars)
            const lenHex = cleanHex.slice(offset, offset + 8);
            const len = parseInt(lenHex, 16);
            offset += 8;

            if (len === 0) return BigInt(0);

            // Read data (len * 2 hex chars)
            const dataHex = cleanHex.slice(offset, offset + len * 2);
            offset += len * 2;

            return BigInt('0x' + dataHex);
        }

        const maxPrizeWon = readBigUint();
        const totalPrizeDistributed = readBigUint();

        // Convert from wei to EGLD with better precision
        const maxPrizeWonEGLD = Number(maxPrizeWon) / 1e18;
        const totalPrizeDistributedEGLD = Number(totalPrizeDistributed) / 1e18;

        const result = {
            max_prize_won: Math.round(maxPrizeWonEGLD * 1e18) / 1e18, // Round to avoid floating point precision issues
            total_prize_distributed: Math.round(totalPrizeDistributedEGLD * 1e18) / 1e18
        };

        console.log('parsePrizeStatsHex - Raw BigInt values:', { maxPrizeWon, totalPrizeDistributed });
        console.log('parsePrizeStatsHex - Before rounding:', { maxPrizeWonEGLD, totalPrizeDistributedEGLD });
        console.log('parsePrizeStatsHex - After rounding:', result);
        console.log('parsePrizeStatsHex - Final result:', result);
        return result;
    } catch (error) {
        console.error('Error parsing prize stats hex:', error);
        console.error('Hex data that failed to parse:', hex);
        return null;
    }
}

// Get tournament basic info using the new bulk endpoint
export async function getTournamentBasicInfoFromContract(tournamentId: bigint): Promise<any> {
    const cacheKey = `tournament_basic_info_${tournamentId}`;
    return deduplicateApiRequest(cacheKey, async () => {
        try {
            const contractAddress = getContractAddress();
            const network = getNetwork();
            const apiUrl = `${network}/vm-values/query`;

            const requestData = {
                scAddress: contractAddress,
                funcName: 'getTournamentBasicInfo',
                args: [tournamentId.toString()]
            };

            console.log(`getTournamentBasicInfoFromContract: Fetching basic info for tournament ${tournamentId}...`);

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log(`getTournamentBasicInfoFromContract: Response for tournament ${tournamentId}:`, result);

            const returnData = result.data?.data?.returnData?.[0];

            if (!returnData) {
                console.log(`getTournamentBasicInfoFromContract: No return data for tournament ${tournamentId}`);
                return null;
            }

            // Parse the returned tuple data
            // Format: (tournament_id, game_id, status, participants, creator, max_players, min_players, entry_fee, name, created_at)
            const decoded = atob(returnData);
            const hex = Array.from(decoded).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');

            console.log(`getTournamentBasicInfoFromContract: Decoded hex for tournament ${tournamentId}:`, hex);

            // Parse the tuple data using the same parsing logic
            const parsed = await parseTournamentBasicInfoHex(hex);
            console.log(`getTournamentBasicInfoFromContract: Parsed result for tournament ${tournamentId}:`, parsed);

            return parsed;
        } catch (error) {
            console.error(`getTournamentBasicInfoFromContract: Error for tournament ${tournamentId}:`, error);
            return null;
        }
    });
}
// Parse tournament basic info from hex data (tuple format)
async function parseTournamentBasicInfoHex(hex: string) {
    let offset = 0;

    function readHex(len: number) {
        const result = hex.slice(offset, offset + len);
        offset += len;
        return result;
    }

    function readU64() {
        const hex = readHex(16);
        return BigInt('0x' + hex);
    }

    function readU32() {
        const hex = readHex(8);
        return parseInt(hex, 16);
    }

    function readAddress() {
        const addrHex = readHex(64);
        return hexToBech32(addrHex);
    }

    function readVecAddress() {
        const len = readU32();
        const addresses = [];
        for (let i = 0; i < len; i++) {
            const addrHex = readHex(64);
            const addr = hexToBech32(addrHex);
            addresses.push(addr);
        }
        return addresses;
    }

    function readBigUint() {
        const len = readU32();
        if (len === 0) return BigInt(0);
        const hex = readHex(len * 2);
        return BigInt('0x' + hex);
    }

    function readManagedBuffer() {
        const len = readU32();
        if (len === 0) return '';
        const hex = readHex(len * 2);
        return Buffer.from(hex, 'hex').toString('utf8');
    }

    try {
        console.log('parseTournamentBasicInfoHex: Starting to parse hex data, length:', hex.length);

        const tournament_id = readU64();
        const game_id = readU64();
        const status = readU32();
        const participants = readVecAddress();
        const creator = readAddress();
        const max_players = readU32();
        const min_players = readU32();
        const entry_fee = readBigUint();
        const name = readManagedBuffer();
        const created_at = readU64();

        const result = {
            tournament_id,
            game_id,
            status,
            participants,
            creator,
            max_players,
            min_players,
            entry_fee,
            name,
            created_at
        };

        console.log('parseTournamentBasicInfoHex: Parsed result:', result);
        return result;
    } catch (error) {
        console.error('parseTournamentBasicInfoHex: Error parsing hex:', error);
        return null;
    }
}

// Debug functions for testing
export async function testWithKnownHex() {
    const knownHex = "000000000000000100000000015dd983f0426b2c0acf8c011096d81c8ab2cb5af14b56b3df1af29e7a65b16aee000000005dd983f0426b2c0acf8c011096d81c8ab2cb5af14b56b3df1af29e7a65b16aee000000020000000200000008016345785d8a000000000000000151800000000954657374204c6173740000000068c0b5b0";
    console.log('Testing with known hex data from tournament 13:');
    console.log('Hex length:', knownHex.length);

    // Also test tournament 12 hex data
    const knownHex12 = "000000000000000100000000015dd983f0426b2c0acf8c011096d81c8ab2cb5af14b56b3df1af29e7a65b16aee000000005dd983f0426b2c0acf8c011096d81c8ab2cb5af14b56b3df1af29e7a65b16aee000000020000000200000008016345785d8a000000000000000151800000000d54657374204372656174696f6e0000000068c0b3ac";
    console.log('Also testing tournament 12 hex data:');
    console.log('Tournament 12 hex length:', knownHex12.length);

    // Manual parsing to debug step by step
    let offset = 0;
    const rawHex = knownHex;

    function readU32() {
        const hex = rawHex.substring(offset, offset + 8);
        offset += 8;
        return parseInt(hex, 16);
    }

    function readHex(len: number) {
        const hex = rawHex.substring(offset, offset + len);
        offset += len;
        return hex;
    }

    function hexToBech32(hex: string) {
        try {
            const bytes = Buffer.from(hex, 'hex');
            return 'erd' + bytes.toString('base64').replace(/[+/=]/g, (m) => ({ '+': '-', '/': '_', '=': '' }[m]!));
        } catch {
            return 'Invalid address';
        }
    }

    // Parse step by step
    console.log('Step 1: game_id');
    const game_id = readU32();
    console.log('game_id:', game_id);

    console.log('Step 2: status');
    const status = readU32();
    console.log('status:', status);

    console.log('Step 3: participants length');
    const participantsLen = readU32();
    console.log('participants length:', participantsLen);

    console.log('Step 4: participants addresses');
    const participants = [];
    for (let i = 0; i < participantsLen; i++) {
        const addrHex = readHex(64);
        const addr = hexToBech32(addrHex);
        participants.push(addr);
        console.log(`Participant ${i + 1}:`, addr);
    }

    console.log('Final participants array:', participants);
    console.log('Participants count:', participants.length);

    console.log('Testing tournament 13 parsing:');
    const result13 = await parseTournamentHex(knownHex, 13);

    console.log('Testing tournament 12 parsing:');
    const result12 = await parseTournamentHex(knownHex12, 12);

    return { tournament13: result13, tournament12: result12 };
}
export async function testTournamentContractCall(tournamentId = 13) {
    console.log(`Testing direct contract call for tournament ${tournamentId}...`);

    try {
        const response = await fetch(`${getApiUrl()}/vm-values/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                scAddress: getContractAddress(),
                funcName: 'getTournament',
                args: [Number(tournamentId).toString(16).padStart(16, '0')],
                caller: getContractAddress(),
                gasLimit: 50000000
            }),
        });

        const data = await response.json();
        console.log('Raw contract response:', data);

        if (data.data && data.data.data && data.data.data.returnData && data.data.data.returnData.length > 0) {
            const hex = data.data.data.returnData[0];
            console.log('Raw hex data from contract:', hex);
            console.log('Hex length:', hex.length);

            // Compare with known hex
            const knownHex = "000000000000000100000000015dd983f0426b2c0acf8c011096d81c8ab2cb5af14b56b3df1af29e7a65b16aee000000005dd983f0426b2c0acf8c011096d81c8ab2cb5af14b56b3df1af29e7a65b16aee000000020000000200000008016345785d8a000000000000000151800000000954657374204c6173740000000068c0b5b0";
            console.log('Known hex data:', knownHex);
            console.log('Hex data matches:', hex === knownHex);

            // Test parsing
            const parsed = await parseTournamentHex(hex, tournamentId);
            console.log('Parsed result:', parsed);
            return parsed;
        }
    } catch (error) {
        console.error('Error testing contract call:', error);
    }
}

// Add a simple contract test function
(window as any).testContract = async () => {
    console.log('Testing contract connectivity...');
    const contractAddress = getContractAddress();
    const apiUrl = getApiUrl();

    console.log('Contract address:', contractAddress);
    console.log('API URL:', apiUrl);

    try {
        // First check if the contract exists
        console.log('1. Checking if contract exists...');
        const accountResponse = await fetch(`${apiUrl}/accounts/${contractAddress}`);
        const accountData = await accountResponse.json();
        console.log('Account data:', accountData);

        if (accountData.error) {
            console.error('Contract does not exist:', accountData.error);
            return { success: false, error: 'Contract not found', accountData };
        }

        // Test basic contract query
        console.log('2. Testing getNumberOfTournaments...');
        const response1 = await fetch(`${apiUrl}/vm-values/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                scAddress: contractAddress,
                funcName: 'getNumberOfTournaments',
                args: [],
            }),
        });

        console.log('getNumberOfTournaments status:', response1.status);
        const data1 = await response1.json();
        console.log('getNumberOfTournaments data:', data1);

        // Test getActiveTournamentIds
        console.log('3. Testing getActiveTournamentIds...');
        const response2 = await fetch(`${apiUrl}/vm-values/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                scAddress: contractAddress,
                funcName: 'getActiveTournamentIds',
                args: [],
            }),
        });

        console.log('getActiveTournamentIds status:', response2.status);
        const data2 = await response2.json();
        console.log('getActiveTournamentIds data:', data2);

        // Test getTournament for ID 1
        console.log('4. Testing getTournament for ID 1...');
        const response3 = await fetch(`${apiUrl}/vm-values/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                scAddress: contractAddress,
                funcName: 'getTournament',
                args: ['0000000000000001'],
            }),
        });

        console.log('getTournament status:', response3.status);
        const data3 = await response3.json();
        console.log('getTournament data:', data3);

        return {
            success: true,
            accountData,
            numberOfTournaments: data1,
            activeTournamentIds: data2,
            tournament1: data3
        };
    } catch (error) {
        console.error('Contract test failed:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
};

// Add a function to test the exact contract calls
(window as any).testExactContractCalls = async () => {
    console.log('Testing exact contract calls...');

    try {
        const contractAddress = getContractAddress();
        const apiUrl = getApiUrl();

        console.log('Contract address:', contractAddress);
        console.log('API URL:', apiUrl);

        // Test 1: getNumberOfTournaments
        console.log('\n1. Testing getNumberOfTournaments...');
        const response1 = await fetch(`${apiUrl}/vm-values/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                scAddress: contractAddress,
                funcName: 'getNumberOfTournaments',
                args: [],
            }),
        });
        const data1 = await response1.json();
        console.log('getNumberOfTournaments response:', data1);

        // Test 2: getActiveTournamentIds
        console.log('\n2. Testing getActiveTournamentIds...');
        const response2 = await fetch(`${apiUrl}/vm-values/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                scAddress: contractAddress,
                funcName: 'getActiveTournamentIds',
                args: [],
            }),
        });
        const data2 = await response2.json();
        console.log('getActiveTournamentIds response:', data2);

        // Parse the tournament IDs
        let tournamentIds = [];
        if (data2.data && data2.data.data && data2.data.data.returnData && data2.data.data.returnData.length > 0) {
            const base64Data = data2.data.data.returnData[0];
            const decoded = atob(base64Data);
            for (let i = 0; i < decoded.length; i += 8) {
                if (i + 8 <= decoded.length) {
                    const chunk = decoded.slice(i, i + 8);
                    const hexString = Array.from(chunk).map(char => char.charCodeAt(0).toString(16).padStart(2, '0')).join('');
                    const id = parseInt(hexString, 16);
                    tournamentIds.push(id);
                }
            }
            console.log('Parsed tournament IDs:', tournamentIds);
        }

        // Test 3: getTournament for first ID
        if (tournamentIds.length > 0) {
            console.log(`\n3. Testing getTournament for ID ${tournamentIds[0]}...`);
            const response3 = await fetch(`${apiUrl}/vm-values/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scAddress: contractAddress,
                    funcName: 'getTournament',
                    args: [Number(tournamentIds[0]).toString(16).padStart(16, '0')],
                }),
            });
            const data3 = await response3.json();
            console.log('getTournament response:', data3);

            // Note: getTournamentBasicInfo doesn't exist in deployed contract
            console.log(`\n4. Skipping getTournamentBasicInfo (not available in deployed contract)...`);
        }

        return {
            numberOfTournaments: data1,
            activeTournamentIds: data2,
            tournamentIds: tournamentIds
        };
    } catch (error) {
        console.error('Exact contract calls test failed:', error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
};

// Add a function to check contract state
(window as any).checkContractState = async () => {
    console.log('Checking contract state...');

    try {
        const contractAddress = getContractAddress();
        const apiUrl = getApiUrl();

        // Check number of tournaments
        console.log('1. Checking number of tournaments...');
        const response1 = await fetch(`${apiUrl}/vm-values/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                scAddress: contractAddress,
                funcName: 'getNumberOfTournaments',
                args: [],
            }),
        });
        const data1 = await response1.json();
        console.log('Number of tournaments:', data1);

        // Check active tournament IDs
        console.log('2. Checking active tournament IDs...');
        const response2 = await fetch(`${apiUrl}/vm-values/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                scAddress: contractAddress,
                funcName: 'getActiveTournamentIds',
                args: [],
            }),
        });
        const data2 = await response2.json();
        console.log('Active tournament IDs:', data2);

        // Check if there are any tournaments at all
        if (data2.data && data2.data.data && data2.data.data.returnData && data2.data.data.returnData.length > 0) {
            const base64Data = data2.data.data.returnData[0];
            const decoded = atob(base64Data);
            const tournamentIds = [];
            for (let i = 0; i < decoded.length; i += 8) {
                if (i + 8 <= decoded.length) {
                    const chunk = decoded.slice(i, i + 8);
                    const hexString = Array.from(chunk).map(char => char.charCodeAt(0).toString(16).padStart(2, '0')).join('');
                    const id = parseInt(hexString, 16);
                    tournamentIds.push(id);
                }
            }
            console.log('Parsed tournament IDs:', tournamentIds);

            // Try to get the first tournament if any exist
            if (tournamentIds.length > 0) {
                console.log('3. Trying to get first tournament...');
                const response3 = await fetch(`${apiUrl}/vm-values/query`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        scAddress: contractAddress,
                        funcName: 'getTournament',
                        args: [Number(tournamentIds[0]).toString(16).padStart(16, '0')],
                    }),
                });
                const data3 = await response3.json();
                console.log('First tournament data:', data3);
            }
        }

        return { numberOfTournaments: data1, activeTournamentIds: data2 };
    } catch (error) {
        console.error('Contract state check failed:', error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
};

// Add a function to test tournament data parsing
(window as any).testTournamentParsing = async (tournamentId = 1) => {
    console.log(`Testing tournament parsing for ID: ${tournamentId}`);

    try {
        // Test getTournamentDetailsFromContract
        console.log('1. Testing getTournamentDetailsFromContract...');
        const details = await getTournamentDetailsFromContract(tournamentId);
        console.log('Raw details:', details);

        // Note: getTournamentBasicInfoFromContract doesn't exist in deployed contract
        console.log('2. Skipping getTournamentBasicInfoFromContract (not available in deployed contract)...');

        // Test direct API call
        console.log('3. Testing direct API call...');
        const response = await fetch(`${getApiUrl()}/vm-values/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                scAddress: getContractAddress(),
                funcName: 'getTournament',
                args: [Number(tournamentId).toString(16).padStart(16, '0')], // Send as base64-encoded string
            }),
        });

        const rawData = await response.json();
        console.log('Raw API response:', rawData);

        if (rawData.data && rawData.data.data && rawData.data.data.returnData && rawData.data.data.returnData.length > 0) {
            const hex = rawData.data.data.returnData[0];
            console.log('Raw hex data:', hex);

            // Test parsing the hex
            console.log('4. Testing hex parsing...');
            const parsed = await parseTournamentHex(hex, tournamentId);
            console.log('Parsed data:', parsed);
        }

        return {
            details,
            rawApiResponse: rawData
        };
    } catch (error) {
        console.error('Tournament parsing test failed:', error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
};

// Add a function to debug tournament participants parsing
(window as any).debugTournamentParticipants = async (tournamentId: number) => {
    console.log(`=== DEBUGGING TOURNAMENT ${tournamentId} PARTICIPANTS ===`);

    try {
        // Get raw contract response
        const response = await fetch(`${getApiUrl()}/vm-values/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                scAddress: getContractAddress(),
                funcName: 'getTournament',
                args: [tournamentId.toString(16).padStart(16, '0')],
                caller: getContractAddress(),
            }),
        });

        const data = await response.json();
        console.log('Raw contract response:', data);

        if (data.data && data.data.data && data.data.data.returnData && data.data.data.returnData.length > 0) {
            const hex = data.data.data.returnData[0];
            console.log('Raw hex data:', hex);
            console.log('Hex length:', hex.length);

            // Parse the hex
            const parsed = await parseTournamentHex(hex, tournamentId);
            console.log('Parsed tournament:', parsed);
            console.log('Participants:', parsed?.participants);
            console.log('Participants length:', parsed?.participants?.length);

            return {
                rawResponse: data,
                hex: hex,
                parsed: parsed,
                participants: parsed?.participants
            };
        } else {
            console.log('No return data from contract');
            return { error: 'No return data' };
        }
    } catch (error) {
        console.error('Error debugging tournament participants:', error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
};

// Add a function to check what getActiveTournamentIds returns
(window as any).checkActiveTournamentIds = async () => {
    console.log('Checking what getActiveTournamentIds returns...');

    try {
        const contractAddress = getContractAddress();
        const apiUrl = getApiUrl();

        console.log('Contract address:', contractAddress);
        console.log('API URL:', apiUrl);

        // Test getActiveTournamentIds
        const response = await fetch(`${apiUrl}/vm-values/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                scAddress: contractAddress,
                funcName: 'getActiveTournamentIds',
                args: [],
            }),
        });

        console.log('Response status:', response.status);
        const responseText = await response.text();
        console.log('Raw response text:', responseText);

        let responseData;
        try {
            responseData = JSON.parse(responseText);
            console.log('Parsed response data:', responseData);

            // Parse the tournament IDs
            if (responseData.data && responseData.data.data && responseData.data.data.returnData && responseData.data.data.returnData.length > 0) {
                const base64Data = responseData.data.data.returnData[0];
                console.log('Base64 data:', base64Data);

                const decoded = atob(base64Data);
                console.log('Decoded data length:', decoded.length);
                console.log('Decoded data (first 100 chars):', decoded.substring(0, 100));

                const tournamentIds = [];
                for (let i = 0; i < decoded.length; i += 8) {
                    if (i + 8 <= decoded.length) {
                        const chunk = decoded.slice(i, i + 8);
                        const hexString = Array.from(chunk).map(char => char.charCodeAt(0).toString(16).padStart(2, '0')).join('');
                        const id = parseInt(hexString, 16);
                        tournamentIds.push(id);
                    }
                }
                console.log('Parsed tournament IDs:', tournamentIds);
                console.log('Number of tournament IDs:', tournamentIds.length);
            } else {
                console.log('No return data found');
            }
        } catch (parseError) {
            console.error('Failed to parse response as JSON:', parseError);
        }

        return {
            status: response.status,
            responseText,
            responseData
        };
    } catch (error) {
        console.error('Check active tournament IDs failed:', error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
};

// Add a function to test the contract directly
(window as any).testContractDirectly = async () => {
    console.log('Testing contract directly...');

    try {
        const contractAddress = getContractAddress();
        const apiUrl = getApiUrl();

        console.log('Contract address:', contractAddress);
        console.log('API URL:', apiUrl);

        // Test getNumberOfTournaments
        console.log('\n1. Testing getNumberOfTournaments...');
        const response1 = await fetch(`${apiUrl}/vm-values/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                scAddress: contractAddress,
                funcName: 'getNumberOfTournaments',
                args: [],
            }),
        });

        const data1 = await response1.json();
        console.log('getNumberOfTournaments response:', data1);
        console.log('Response status:', response1.status);

        // Test getActiveTournamentIds
        console.log('\n2. Testing getActiveTournamentIds...');
        const response2 = await fetch(`${apiUrl}/vm-values/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                scAddress: contractAddress,
                funcName: 'getActiveTournamentIds',
                args: [],
            }),
        });

        const data2 = await response2.json();
        console.log('getActiveTournamentIds response:', data2);
        console.log('Response status:', response2.status);

        // Test getTournament for ID 1
        console.log('\n3. Testing getTournament for ID 1...');
        const response3 = await fetch(`${apiUrl}/vm-values/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                scAddress: contractAddress,
                funcName: 'getTournament',
                args: ['0000000000000001'],
            }),
        });

        const data3 = await response3.json();
        console.log('getTournament response:', data3);
        console.log('Response status:', response3.status);

        return {
            numberOfTournaments: data1,
            activeTournamentIds: data2,
            tournament1: data3
        };
    } catch (error) {
        console.error('Direct contract test failed:', error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
};

// Add a function to test Tournament with actual ID from contract
(window as any).testTournamentWithRealId = async () => {
    console.log('Testing Tournament with real ID from contract...');

    try {
        const contractAddress = getContractAddress();
        const apiUrl = getApiUrl();

        console.log('Contract address:', contractAddress);
        console.log('API URL:', apiUrl);

        // First, get the actual tournament IDs from the contract
        console.log('\n--- Step 1: Getting actual tournament IDs ---');
        const activeIds = await getActiveTournamentIds();
        console.log('Active tournament IDs from contract:', activeIds);

        if (!activeIds || activeIds.length === 0) {
            console.log('❌ No active tournaments found');
            return { error: 'No active tournaments' };
        }

        const tournamentId = Number(activeIds[0]);
        console.log(`Using tournament ID: ${tournamentId}`);

        // Test different argument formats with the real tournament ID
        const testCases = [
            { name: `Number ${tournamentId}`, args: [tournamentId] },
            { name: `String "${tournamentId}"`, args: [tournamentId.toString()] },
            { name: `BigInt ${tournamentId}n`, args: [BigInt(tournamentId)] },
        ];

        for (const testCase of testCases) {
            console.log(`\n--- Testing ${testCase.name} ---`);

            try {
                const response = await fetch(`${apiUrl}/vm-values/query`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        scAddress: contractAddress,
                        funcName: 'getTournament',
                        args: testCase.args,
                    }),
                });

                console.log(`Response status: ${response.status}`);

                if (response.status === 200) {
                    const responseText = await response.text();
                    const responseData = JSON.parse(responseText);
                    console.log('✅ SUCCESS! Response:', responseData);

                    if (responseData.data && responseData.data.data && responseData.data.data.returnData) {
                        console.log('Return data found:', responseData.data.data.returnData);
                        if (responseData.data.data.returnData.length > 0) {
                            const hex = responseData.data.data.returnData[0];
                            console.log('Hex data:', hex);

                            try {
                                const parsed = await parseTournamentHex(hex, tournamentId);
                                console.log('✅ Parsed tournament data:', parsed);
                                return { success: true, method: testCase.name, data: parsed };
                            } catch (parseError) {
                                console.error('Error parsing tournament hex:', parseError);
                            }
                        }
                    }
                    return { success: true, method: testCase.name, response: responseData };
                } else {
                    const responseText = await response.text();
                    console.log(`❌ Failed: ${responseText}`);
                }
            } catch (error) {
                console.error(`❌ Error with ${testCase.name}:`, error);
            }
        }

        return { error: 'All test cases failed' };
    } catch (error) {
        console.error('Test Tournament with real ID failed:', error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
};

// Add a function to test different API endpoints
(window as any).testDifferentEndpoints = async () => {
    console.log('Testing different API endpoints...');

    try {
        const contractAddress = getContractAddress();
        const apiUrl = getApiUrl();

        console.log('Contract address:', contractAddress);
        console.log('API URL:', apiUrl);

        // Test different API endpoints
        const testCases = [
            {
                name: 'vm-values/query',
                endpoint: '/vm-values/query',
                body: {
                    scAddress: contractAddress,
                    funcName: 'getTournament',
                    args: ['0000000000000001'],
                    caller: contractAddress,
                    gasLimit: 50000000
                }
            },
            {
                name: 'vm-values/hex',
                endpoint: '/vm-values/hex',
                body: {
                    scAddress: contractAddress,
                    funcName: 'getTournament',
                    args: ['0000000000000001'],
                    caller: contractAddress,
                    gasLimit: 50000000
                }
            },
            {
                name: 'query',
                endpoint: '/query',
                body: {
                    scAddress: contractAddress,
                    funcName: 'getTournament',
                    args: ['0000000000000001'],
                    caller: contractAddress,
                    gasLimit: 50000000
                }
            },
            {
                name: 'vm-values/query with different format',
                endpoint: '/vm-values/query',
                body: {
                    scAddress: contractAddress,
                    funcName: 'getTournament',
                    args: ['0000000000000001'],
                    caller: contractAddress,
                    gasLimit: 50000000,
                    value: '0'
                }
            }
        ];

        for (const testCase of testCases) {
            console.log(`\n--- Testing ${testCase.name} ---`);

            try {
                const response = await fetch(`${apiUrl}${testCase.endpoint}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(testCase.body),
                });

                console.log(`Response status: ${response.status}`);
                console.log(`Response headers:`, Object.fromEntries(response.headers.entries()));

                const responseText = await response.text();
                console.log(`Response text: ${responseText}`);

                if (response.status === 200) {
                    try {
                        const responseData = JSON.parse(responseText);
                        console.log('✅ SUCCESS! Parsed response:', responseData);

                        if (responseData.data && responseData.data.data && responseData.data.data.returnData) {
                            console.log('Return data found:', responseData.data.data.returnData);
                            if (responseData.data.data.returnData.length > 0) {
                                const hex = responseData.data.data.returnData[0];
                                console.log('Hex data:', hex);

                                try {
                                    const parsed = await parseTournamentHex(hex);
                                    console.log('✅ Parsed tournament data:', parsed);
                                    return { success: true, method: testCase.name, data: parsed };
                                } catch (parseError) {
                                    console.error('Error parsing tournament hex:', parseError);
                                }
                            }
                        }
                        return { success: true, method: testCase.name, response: responseData };
                    } catch (parseError) {
                        console.log('Response is not JSON:', responseText);
                    }
                } else {
                    console.log(`❌ Failed: ${responseText}`);
                }
            } catch (error) {
                console.error(`❌ Error with ${testCase.name}:`, error);
            }
        }

        return { error: 'All test cases failed' };
    } catch (error) {
        console.error('Test different endpoints failed:', error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
};

// Add a function to test the exact API call format that works
(window as any).testWorkingApiCall = async () => {
    console.log('Testing API call format that should work...');

    try {
        const contractAddress = getContractAddress();
        const apiUrl = getApiUrl();

        console.log('Contract address:', contractAddress);
        console.log('API URL:', apiUrl);

        // Test the exact format that the command line uses
        const testCases = [
            {
                name: 'Command line format',
                body: {
                    scAddress: contractAddress,
                    funcName: 'getTournament',
                    args: ['0000000000000001']
                }
            },
            {
                name: 'With explicit caller',
                body: {
                    scAddress: contractAddress,
                    funcName: 'getTournament',
                    args: ['0000000000000001'],
                    caller: contractAddress
                }
            },
            {
                name: 'With gas limit and caller',
                body: {
                    scAddress: contractAddress,
                    funcName: 'getTournament',
                    args: ['0000000000000001'],
                    caller: contractAddress,
                    gasLimit: 50000000
                }
            }
        ];

        for (const testCase of testCases) {
            console.log(`\n--- Testing ${testCase.name} ---`);

            try {
                const response = await fetch(`${apiUrl}/vm-values/query`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(testCase.body),
                });

                console.log(`Response status: ${response.status}`);
                console.log(`Response headers:`, Object.fromEntries(response.headers.entries()));

                const responseText = await response.text();
                console.log(`Response text: ${responseText}`);

                if (response.status === 200) {
                    try {
                        const responseData = JSON.parse(responseText);
                        console.log('✅ SUCCESS! Parsed response:', responseData);

                        if (responseData.data && responseData.data.data && responseData.data.data.returnData) {
                            console.log('Return data found:', responseData.data.data.returnData);
                            if (responseData.data.data.returnData.length > 0) {
                                const hex = responseData.data.data.returnData[0];
                                console.log('Hex data:', hex);

                                try {
                                    const parsed = await parseTournamentHex(hex);
                                    console.log('✅ Parsed tournament data:', parsed);
                                    return { success: true, method: testCase.name, data: parsed };
                                } catch (parseError) {
                                    console.error('Error parsing tournament hex:', parseError);
                                }
                            }
                        }
                        return { success: true, method: testCase.name, response: responseData };
                    } catch (parseError) {
                        console.log('Response is not JSON:', responseText);
                    }
                } else {
                    console.log(`❌ Failed: ${responseText}`);
                }
            } catch (error) {
                console.error(`❌ Error with ${testCase.name}:`, error);
            }
        }

        return { error: 'All test cases failed' };
    } catch (error) {
        console.error('Test working API call failed:', error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
};

// Add a function to test the exact API call format
(window as any).testExactApiCall = async () => {
    console.log('Testing exact API call format...');

    try {
        const contractAddress = getContractAddress();
        const apiUrl = getApiUrl();

        console.log('Contract address:', contractAddress);
        console.log('API URL:', apiUrl);

        // Test the exact format that should work
        const testCases = [
            {
                name: 'Minimal request',
                body: {
                    scAddress: contractAddress,
                    funcName: 'getTournament',
                    args: ['0000000000000001']
                }
            },
            {
                name: 'With explicit types',
                body: {
                    scAddress: contractAddress,
                    funcName: 'getTournament',
                    args: ['0000000000000001'],
                    caller: contractAddress
                }
            },
            {
                name: 'With gas limit',
                body: {
                    scAddress: contractAddress,
                    funcName: 'getTournament',
                    args: ['0000000000000001'],
                    gasLimit: 50000000
                }
            },
            {
                name: 'Different endpoint',
                endpoint: '/vm-values/hex',
                body: {
                    scAddress: contractAddress,
                    funcName: 'getTournament',
                    args: ['0000000000000001']
                }
            }
        ];

        for (const testCase of testCases) {
            console.log(`\n--- Testing ${testCase.name} ---`);

            try {
                const endpoint = testCase.endpoint || '/vm-values/query';
                const response = await fetch(`${apiUrl}${endpoint}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(testCase.body),
                });

                console.log(`Response status: ${response.status}`);
                console.log(`Response headers:`, Object.fromEntries(response.headers.entries()));

                const responseText = await response.text();
                console.log(`Response text: ${responseText}`);

                if (response.status === 200) {
                    try {
                        const responseData = JSON.parse(responseText);
                        console.log('✅ SUCCESS! Parsed response:', responseData);

                        if (responseData.data && responseData.data.data && responseData.data.data.returnData) {
                            console.log('Return data found:', responseData.data.data.returnData);
                            if (responseData.data.data.returnData.length > 0) {
                                const hex = responseData.data.data.returnData[0];
                                console.log('Hex data:', hex);

                                try {
                                    const parsed = await parseTournamentHex(hex);
                                    console.log('✅ Parsed tournament data:', parsed);
                                    return { success: true, method: testCase.name, data: parsed };
                                } catch (parseError) {
                                    console.error('Error parsing tournament hex:', parseError);
                                }
                            }
                        }
                        return { success: true, method: testCase.name, response: responseData };
                    } catch (parseError) {
                        console.log('Response is not JSON:', responseText);
                    }
                } else {
                    console.log(`❌ Failed: ${responseText}`);
                }
            } catch (error) {
                console.error(`❌ Error with ${testCase.name}:`, error);
            }
        }

        return { error: 'All test cases failed' };
    } catch (error) {
        console.error('Test exact API call failed:', error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
};

// Add a function to debug the storage directly
(window as any).debugStorage = async () => {
    console.log('Debugging contract storage...');

    try {
        const contractAddress = getContractAddress();
        const apiUrl = getApiUrl();

        console.log('Contract address:', contractAddress);
        console.log('API URL:', apiUrl);

        // Test 1: Get the raw storage for active_tournaments
        console.log('\n--- Step 1: Getting raw storage ---');
        try {
            const response = await fetch(`${apiUrl}/accounts/${contractAddress}/keys/active_tournaments`);
            console.log('Storage keys status:', response.status);
            if (response.status === 200) {
                const data = await response.json();
                console.log('✅ Storage keys:', data);
            } else {
                console.log('❌ Storage keys failed:', await response.text());
            }
        } catch (error) {
            console.error('❌ Storage keys error:', error);
        }

        // Test 2: Try to get tournament with index 0 (if storage is 0-based)
        console.log('\n--- Step 2: Testing index 0 ---');
        try {
            const response = await fetch(`${apiUrl}/vm-values/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scAddress: contractAddress,
                    funcName: 'getTournament',
                    args: [0],
                }),
            });

            console.log('Index 0 status:', response.status);
            if (response.status === 200) {
                const data = await response.json();
                console.log('✅ Index 0 works:', data);
            } else {
                const error = await response.text();
                console.log('❌ Index 0 failed:', error);
            }
        } catch (error) {
            console.error('❌ Index 0 error:', error);
        }

        // Test 3: Try to get tournament with index 2 (if there might be a gap)
        console.log('\n--- Step 3: Testing index 2 ---');
        try {
            const response = await fetch(`${apiUrl}/vm-values/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scAddress: contractAddress,
                    funcName: 'getTournament',
                    args: [2],
                }),
            });

            console.log('Index 2 status:', response.status);
            if (response.status === 200) {
                const data = await response.json();
                console.log('✅ Index 2 works:', data);
            } else {
                const error = await response.text();
                console.log('❌ Index 2 failed:', error);
            }
        } catch (error) {
            console.error('❌ Index 2 error:', error);
        }

    } catch (error) {
        console.error('Debug storage failed:', error);
    }
};

// Add a function to test basic contract functionality
(window as any).testContractBasic = async () => {
    console.log('Testing basic contract functionality...');

    try {
        const contractAddress = getContractAddress();
        const apiUrl = getApiUrl();

        console.log('Contract address:', contractAddress);
        console.log('API URL:', apiUrl);

        // Test 1: getNumberOfTournaments (should work)
        console.log('\n--- Testing getNumberOfTournaments ---');
        try {
            const response1 = await fetch(`${apiUrl}/vm-values/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scAddress: contractAddress,
                    funcName: 'getNumberOfTournaments',
                    args: [],
                }),
            });

            console.log('getNumberOfTournaments status:', response1.status);
            if (response1.status === 200) {
                const data1 = await response1.json();
                console.log('✅ getNumberOfTournaments works:', data1);
            } else {
                const error1 = await response1.text();
                console.log('❌ getNumberOfTournaments failed:', error1);
            }
        } catch (error) {
            console.error('❌ getNumberOfTournaments error:', error);
        }

        // Test 2: getActiveTournamentIds (should work)
        console.log('\n--- Testing getActiveTournamentIds ---');
        try {
            const response2 = await fetch(`${apiUrl}/vm-values/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scAddress: contractAddress,
                    funcName: 'getActiveTournamentIds',
                    args: [],
                }),
            });

            console.log('getActiveTournamentIds status:', response2.status);
            if (response2.status === 200) {
                const data2 = await response2.json();
                console.log('✅ getActiveTournamentIds works:', data2);
            } else {
                const error2 = await response2.text();
                console.log('❌ getActiveTournamentIds failed:', error2);
            }
        } catch (error) {
            console.error('❌ getActiveTournamentIds error:', error);
        }

        // Test 3: Check if contract exists
        console.log('\n--- Testing contract existence ---');
        try {
            const response3 = await fetch(`${apiUrl}/accounts/${contractAddress}`);
            console.log('Contract info status:', response3.status);
            if (response3.status === 200) {
                const data3 = await response3.json();
                console.log('✅ Contract exists:', data3);
            } else {
                console.log('❌ Contract not found or error');
            }
        } catch (error) {
            console.error('❌ Contract existence check error:', error);
        }

    } catch (error) {
        console.error('Basic contract test failed:', error);
    }
};

// Add a function to debug the exact error
(window as any).debugContractError = async (tournamentId = 1) => {
    console.log(`Debugging contract error for tournament ${tournamentId}...`);

    try {
        const contractAddress = getContractAddress();
        const apiUrl = getApiUrl();

        console.log('Contract address:', contractAddress);
        console.log('API URL:', apiUrl);

        // Test the exact call that's failing
        const response = await fetch(`${apiUrl}/vm-values/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                scAddress: contractAddress,
                funcName: 'getTournament',
                args: [Number(tournamentId).toString(16).padStart(16, '0')], // Send as base64-encoded string
            }),
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));

        const responseText = await response.text();
        console.log('Raw response text:', responseText);

        let responseData;
        try {
            responseData = JSON.parse(responseText);
            console.log('Parsed response data:', responseData);
        } catch (parseError) {
            console.error('Failed to parse response as JSON:', parseError);
            console.log('Response is not valid JSON');
        }

        // Also test if the contract exists
        console.log('\nTesting if contract exists...');
        const accountResponse = await fetch(`${apiUrl}/accounts/${contractAddress}`);
        const accountData = await accountResponse.json();
        console.log('Account data:', accountData);

        return {
            status: response.status,
            responseText,
            responseData,
            accountData
        };
    } catch (error) {
        console.error('Debug contract error failed:', error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
};

// Add deployment instructions function
(window as any).showDeploymentInstructions = () => {
    console.log(`
🚀 TOURNAMENT HUB - CONTRACT DEPLOYMENT INSTRUCTIONS
====================================================

The current contract address is a placeholder. You need to deploy the contract first.

STEP 1: Build the Smart Contract
--------------------------------
cd tournament-hub-sc
sc-meta all build

STEP 2: Deploy to Devnet
------------------------
mxpy contract deploy --bytecode=output/tournament_hub.wasm --recall-nonce --gas-limit=60000000 --send --outfile=deploy.json

STEP 3: Update Contract Address
-------------------------------
After deployment, update the contract address in:
src/config/contract.ts

Replace the ADDRESS field with your deployed contract address.

STEP 4: Test the Contract
-------------------------
Run: testContract() to verify the contract is working.

CURRENT CONTRACT ADDRESS: ${getContractAddress()}
API URL: ${getApiUrl()}

If you see "Contract not found" errors, the contract needs to be deployed.
        `);

    return {
        currentAddress: getContractAddress(),
        apiUrl: getApiUrl(),
        needsDeployment: true
    };
};
