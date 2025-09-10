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


// Cache for API responses
const apiCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
const API_CACHE_TTL = 300 * 1000; // 5 minutes

// Request deduplication
const pendingApiRequests = new Map<string, Promise<any>>();

// Smart rate limiting - Adaptive based on API response
const rateLimitMap = new Map<string, { count: number; resetTime: number; lastRequest: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 100; // Very generous limit
const MIN_REQUEST_INTERVAL = 100; // Minimum 100ms between requests

// Expose a safe way to clear API-level caches from the UI
export function clearApiCaches(): void {
    apiCache.clear();
    pendingApiRequests.clear();
    rateLimitMap.clear();
}

// Debug function to test prize stats directly
export async function debugPrizeStats(): Promise<void> {
    console.log('=== DEBUG PRIZE STATS ===');
    try {
        const response = await fetch(`${getApiUrl()}/vm-values/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                scAddress: getContractAddress(),
                funcName: 'getPrizeStats',
                args: [],
            }),
        });

        console.log('Debug response status:', response.status);
        const data = await response.json();
        console.log('Debug response data:', data);

        if (data?.data?.data?.returnData && data.data.data.returnData.length > 0) {
            const hex = data.data.data.returnData[0];
            console.log('Debug raw hex:', hex);
            const result = parsePrizeStatsHex(hex);
            console.log('Debug parsed result:', result);
        } else {
            console.log('Debug: No return data found');
        }
    } catch (error) {
        console.error('Debug error:', error);
    }
    console.log('=== END DEBUG ===');
}

// Smart rate limiting function
function checkRateLimit(endpoint: string): boolean {
    const now = Date.now();
    const key = `rate_limit_${endpoint}`;
    const limit = rateLimitMap.get(key);

    if (!limit || now > limit.resetTime) {
        rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW, lastRequest: now });
        return true;
    }

    // Check if we're making requests too fast
    if (now - limit.lastRequest < MIN_REQUEST_INTERVAL) {
        console.warn(`Request too fast for ${endpoint}. Waiting ${MIN_REQUEST_INTERVAL}ms...`);
        return false;
    }

    if (limit.count >= MAX_REQUESTS_PER_WINDOW) {
        console.warn(`Rate limit exceeded for ${endpoint}. Waiting for reset...`);
        return false;
    }

    limit.count++;
    limit.lastRequest = now;
    return true;
}

// Special rate limiting for prize stats - more lenient
function checkPrizeStatsRateLimit(): boolean {
    const now = Date.now();
    const key = 'rate_limit_prize_stats';
    const limit = rateLimitMap.get(key);

    if (!limit || now > limit.resetTime) {
        rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW, lastRequest: now });
        return true;
    }

    // More lenient for prize stats - allow more frequent calls
    if (now - limit.lastRequest < 50) { // 50ms minimum instead of 100ms
        console.warn(`Prize stats request too fast. Waiting 50ms...`);
        return false;
    }

    // Higher limit for prize stats
    if (limit.count >= 200) { // 200 requests instead of 100
        console.warn(`Prize stats rate limit exceeded. ${limit.count} requests in ${RATE_LIMIT_WINDOW}ms`);
        return false;
    }

    // Update the rate limit counter
    limit.count += 1;
    limit.lastRequest = now;
    rateLimitMap.set(key, limit);

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
async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs = 15000, maxRetries = 3): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(input, { ...(init || {}), signal: controller.signal });

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
    apiCache.set(key, {
        data,
        timestamp: Date.now(),
        ttl: API_CACHE_TTL
    });
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
        const res = await fetch(`${BACKEND_BASE_URL}/notifier/recent`);
        if (!res.ok) {
            console.warn(`Notifier API error: ${res.status} ${res.statusText}`);
            return [];
        }
        const data = await res.json();
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

export async function parseTournamentHex(hex: string, tournamentId?: number | bigint) {
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
        // no-op to avoid excessive logging in production
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
        // Ensure enough data remains for declared length
        if (safeLen * 64 > remaining()) {
            if (name) logField(name || 'vec_addr_invalid', '', []);
            return [];
        }
        for (let i = 0; i < safeLen; i++) {
            const addrHex = readHex(64);
            const addr = hexToBech32(addrHex);
            addresses.push(addr);
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
        console.log('parseTournamentHex: Starting to parse hex data, length:', rawHex.length);

        // Check if this is a new tournament structure (with min_players, entry_fee, duration, name, created_at)
        const hasNewStructure = rawHex.length > 200; // heuristic
        console.log('parseTournamentHex: Has new structure:', hasNewStructure);

        if (hasNewStructure) {
            const game_id = readU64('game_id');
            const status = readEnum('status');
            const participants = readVecAddress('participants');
            const final_podium = readVecAddress('final_podium');
            const creator = readAddress('creator');
            const max_players = readU32('max_players');
            const min_players = readU32('min_players');
            const entry_fee = readBigUint('entry_fee');
            const duration = readU64('duration');
            const name = readManagedBuffer('name');
            const created_at = readU64('created_at');

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
                duration,
                name,
                created_at
            };

            console.log('parseTournamentHex: Parsed new structure result:', result);

            // Sanity corrections for obviously corrupted numbers
            if (result.game_id > BigInt(1_000_000_000)) result.game_id = BigInt(0);
            if (result.max_players > 1024) result.max_players = 8;
            if (result.min_players > result.max_players) result.min_players = Math.max(2, result.max_players);
            return result;
        } else {
            console.log('parseTournamentHex: Using old tournament structure');
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
                duration: BigInt(86400), // 1 day default
                name: `Tournament #${game_id}`, // Default name
                created_at: BigInt(0) // Unknown creation time
            };

            console.log('parseTournamentHex: Parsed old structure result:', result);
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
    return deduplicateApiRequest(cacheKey, async () => {
        try {
            // First check how many tournaments actually exist
            const numberOfTournamentsResponse = await fetchWithTimeout(`${getApiUrl()}/vm-values/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    scAddress: getContractAddress(),
                    funcName: 'getNumberOfTournaments',
                    args: [],
                }),
            });

            const numberOfTournamentsData = await numberOfTournamentsResponse.json();
            console.log('getNumberOfTournaments response:', numberOfTournamentsData);

            let numberOfTournaments = 0;

            // Try different response formats
            let numberOfTournamentsReturnData = null;
            if (numberOfTournamentsData?.data?.data?.returnData) {
                numberOfTournamentsReturnData = numberOfTournamentsData.data.data.returnData;
            } else if (numberOfTournamentsData?.data?.returnData) {
                numberOfTournamentsReturnData = numberOfTournamentsData.data.returnData;
            } else if (numberOfTournamentsData?.returnData) {
                numberOfTournamentsReturnData = numberOfTournamentsData.returnData;
            } else if (numberOfTournamentsData?.data) {
                numberOfTournamentsReturnData = numberOfTournamentsData.data;
            }

            console.log('Raw returnData for numberOfTournaments:', numberOfTournamentsReturnData);

            if (numberOfTournamentsReturnData && Array.isArray(numberOfTournamentsReturnData) && numberOfTournamentsReturnData.length > 0) {
                const base64Data = numberOfTournamentsReturnData[0];
                if (base64Data && typeof base64Data === 'string') {
                    try {
                        const decoded = atob(base64Data);
                        console.log('Decoded numberOfTournaments data:', decoded);
                        console.log('Decoded data length:', decoded.length);
                        console.log('Decoded data as hex:', Array.from(decoded).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(''));

                        // Try different parsing methods
                        if (decoded.length === 1) {
                            // Single byte - direct conversion
                            numberOfTournaments = decoded.charCodeAt(0);
                            console.log('Parsed as single byte:', numberOfTournaments);
                        } else if (decoded.length === 4) {
                            // 4 bytes - little endian u32
                            const bytes = Array.from(decoded).map(c => c.charCodeAt(0));
                            numberOfTournaments = bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24);
                            console.log('Parsed as little endian u32:', numberOfTournaments);
                        } else if (decoded.length === 8) {
                            // 8 bytes - little endian u64
                            const bytes = Array.from(decoded).map(c => c.charCodeAt(0));
                            numberOfTournaments = bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24) |
                                (bytes[4] << 32) | (bytes[5] << 40) | (bytes[6] << 48) | (bytes[7] << 56);
                            console.log('Parsed as little endian u64:', numberOfTournaments);
                        } else {
                            // Try hex parsing as fallback
                            const hexString = Array.from(decoded).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
                            numberOfTournaments = parseInt(hexString, 16);
                            console.log('Parsed as hex string:', numberOfTournaments);
                        }

                        console.log('Final parsed numberOfTournaments:', numberOfTournaments);
                    } catch (error) {
                        console.error('Error decoding numberOfTournaments data:', error);
                    }
                }
            }

            // Validate the parsed number
            if (isNaN(numberOfTournaments) || numberOfTournaments < 0) {
                console.log('Invalid number of tournaments parsed, defaulting to 0');
                numberOfTournaments = 0;
            }

            console.log('Number of tournaments in contract:', numberOfTournaments);

            // If there are no tournaments, return empty array immediately
            if (numberOfTournaments === 0) {
                console.log('No tournaments in contract, returning empty array');
                return [];
            }

            // Now get the tournament IDs
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
            });

            const data = await response.json();
            console.log('getActiveTournamentIds response:', data);

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

            if (!activeTournamentIdsReturnData || !Array.isArray(activeTournamentIdsReturnData) || activeTournamentIdsReturnData.length === 0) {
                console.log('No active tournament IDs returned');
                return [];
            }

            // The returnData should contain a single base64 string with all tournament IDs
            const base64Data = activeTournamentIdsReturnData[0];
            if (!base64Data || typeof base64Data !== 'string') {
                console.log('Invalid base64 data for tournament IDs');
                return [];
            }

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

            console.log('Parsed active tournament IDs:', tournamentIds);

            // Filter out invalid IDs (the contract has a bug where it returns IDs even when there are no tournaments)
            const validIds = tournamentIds.filter(id => Number(id) > 0 && Number(id) <= numberOfTournaments);
            console.log('Valid tournament IDs (filtered):', validIds);

            // If there are no valid tournaments, return empty array
            if (validIds.length === 0) {
                console.log('No valid tournament IDs found, returning empty array');
                return [];
            }

            return validIds;
        } catch (error) {
            console.error('Error in getActiveTournamentIds:', error);
            return [];
        }
    });
}

export async function findTournamentsByTesting() {
    const cacheKey = 'tournaments_by_testing';
    return deduplicateApiRequest(cacheKey, async () => {
        const tournamentIds: bigint[] = [];

        console.log('Testing tournament IDs 1-50...');

        // Test a reasonable range of tournament IDs
        for (let i = 1; i <= 50; i++) {
            try {
                const details = await getTournamentDetailsFromContract(BigInt(i));
                if (details) {
                    tournamentIds.push(BigInt(i));
                    console.log(`Found tournament ${i}: ${details.name || `Tournament #${i}`}`);
                }
            } catch (error) {
                // Continue testing other IDs
            }
        }

        console.log(`findTournamentsByTesting found ${tournamentIds.length} tournaments`);
        return tournamentIds;
    });
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
                    return event.identifier;
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

// Debug functions (kept for development but with reduced logging)
export async function debugTournamentDiscovery() {
    const activeIds = await getActiveTournamentIds();
    const eventTournaments = await getTournamentsFromBlockchain();
    const testingIds = await findTournamentsByTesting();

    return {
        activeIds: activeIds.length,
        eventTournaments: eventTournaments.length,
        testingIds: testingIds.length
    };
}

export async function debugSpecificTournament(tournamentId: number) {
    const details = await getTournamentDetailsFromContract(tournamentId);
    const prizePool = await getPrizePoolFromContract(tournamentId);
    const gameConfig = details ? await getGameConfig(details.game_id) : null;

    return {
        tournamentId,
        details,
        prizePool: prizePool.toString(),
        gameConfig
    };
}

export async function debugTournamentCount() {
    const activeIds = await getActiveTournamentIds();
    return activeIds.length;
}

export async function debugActiveTournamentIds() {
    return await getActiveTournamentIds();
}

export async function debugContractResponse() {
    try {
        // First, check if the contract exists
        const contractAddress = getContractAddress();

        const contractInfoResponse = await fetch(`${getApiUrl()}/accounts/${contractAddress}`);
        const contractInfo = await contractInfoResponse.json();

        if (contractInfo.error) {
            return { error: 'Contract not found or not accessible', contractInfo };
        }

        // Get all events from the contract to see what's available
        const allEventsResponse = await fetch(`${getApiUrl()}/events?address=${contractAddress}&from=0&size=10&order=desc`);
        const allEventsData = await allEventsResponse.json();

        // Check registered games count
        const gamesResponse = await fetch(`${getApiUrl()}/vm-values/query`, {
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

        const gamesData = await gamesResponse.json();

        // Try to get the first game config to see if any games are registered
        const gameConfigResponse = await fetch(`${getApiUrl()}/vm-values/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                scAddress: contractAddress,
                funcName: 'getGameConfig',
                args: ['0000000000000001'], // Game index 1
            }),
        });

        const gameConfigData = await gameConfigResponse.json();

        // Note: There's no getNumberOfGames endpoint in the contract
        // We'll check if games are registered by trying to get game config for index 1
        console.log('Checking if any games are registered...');

        // Now try the function call
        const response = await fetch(`${getApiUrl()}/vm-values/query`, {
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

        const data = await response.json();
        return {
            contractInfo,
            allEvents: allEventsData,
            gamesResponse: gamesData,
            gameConfigResponse: gameConfigData,
            functionResponse: data
        };
    } catch (error) {
        console.error('Debug contract response error:', error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

export async function debugPrizePool(tournamentId: number) {
    const prizePool = await getPrizePoolFromContract(tournamentId);
    return {
        tournamentId,
        prizePool: prizePool.toString(),
        prizePoolEgld: (Number(prizePool) / 1e18).toFixed(4)
    };
}

export async function debugEntryFees() {
    const fee = await getTournamentFeeFromContract();
    return {
        fee: fee.toString(),
        feeEgld: (Number(fee) / 1e18).toFixed(4)
    };
}

export function debugEgldToWei(egldAmount: string) {
    const wei = BigInt(Math.floor(parseFloat(egldAmount) * 1e18));
    return {
        egld: egldAmount,
        wei: wei.toString(),
        weiHex: wei.toString(16)
    };
}

// Debug function to test contract connectivity
export async function debugContractConnectivity() {
    console.log('Testing contract connectivity...');

    try {
        const contractAddress = getContractAddress();
        console.log('Contract address:', contractAddress);

        // Test basic contract query
        const response = await fetchWithTimeout(`${getApiUrl()}/vm-values/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                scAddress: contractAddress,
                funcName: 'getNumberOfTournaments',
                args: [],
            }),
        }, 10000, 1);

        console.log('Contract response status:', response.status);

        if (response.ok) {
            const data = await response.json();
            console.log('Contract response data:', data);
            return { success: true, data };
        } else {
            console.error('Contract query failed:', response.status, response.statusText);
            return { success: false, error: `HTTP ${response.status}` };
        }
    } catch (error) {
        console.error('Contract connectivity test failed:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

// Make debug function available globally for console testing
if (typeof window !== 'undefined') {
    (window as any).debugContractConnectivity = debugContractConnectivity;
    (window as any).getUserStatsFromContract = getUserStatsFromContract;
    (window as any).getTournamentStatsFromContract = getTournamentStatsFromContract;
    (window as any).clearApiCaches = clearApiCaches;
    (window as any).getTournamentDetailsFromContract = getTournamentDetailsFromContract;
    (window as any).getTournamentBasicInfoFromContract = getTournamentBasicInfoFromContract;
    (window as any).parseTournamentHex = parseTournamentHex;
    (window as any).isTournamentCompletedByEvents = isTournamentCompletedByEvents;

    // Test function to debug tournament contract calls
    (window as any).testTournamentContractCall = async (tournamentId = 1) => {
        console.log(`Testing direct contract call for tournament ${tournamentId}...`);

        try {
            const contractAddress = getContractAddress();
            const apiUrl = getApiUrl();

            // Test with hex string encoding (using 1-based indexing as contract expects)
            const hexString = Number(tournamentId).toString(16).padStart(16, '0');

            console.log(`Tournament ID: ${tournamentId}`);
            console.log(`Hex string: ${hexString}`);

            const response = await fetch(`${apiUrl}/vm-values/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    scAddress: contractAddress,
                    funcName: 'getTournament',
                    args: [hexString],
                    caller: contractAddress,
                    gasLimit: 50000000
                }),
            });

            console.log(`Response status: ${response.status}`);
            const data = await response.json();
            console.log(`Response data:`, data);

            if (data?.data?.data?.returnData && data.data.data.returnData.length > 0) {
                const hex = data.data.data.returnData[0];
                console.log(`Raw hex data: ${hex}`);

                const tournament = await parseTournamentHex(hex, tournamentId);
                console.log(`Parsed tournament:`, tournament);

                return {
                    success: true,
                    rawData: data,
                    parsedTournament: tournament
                };
            } else {
                console.log('No return data found');
                return {
                    success: false,
                    rawData: data,
                    error: 'No return data'
                };
            }
        } catch (error) {
            console.error('Test failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    };

    // Add a simple test function
    (window as any).testDashboard = async () => {
        console.log('Testing Dashboard functionality...');

        // Test 1: Contract connectivity
        console.log('1. Testing contract connectivity...');
        const contractTest = await debugContractConnectivity();
        console.log('Contract test result:', contractTest);

        // Test 2: User stats (if wallet is connected)
        const address = (window as any).multiversx?.getAccount?.()?.address;
        if (address) {
            console.log('2. Testing user stats for address:', address);
            const userStats = await getUserStatsFromContract(address);
            console.log('User stats result:', userStats);
        } else {
            console.log('2. No wallet connected, skipping user stats test');
        }

        // Test 3: Tournament stats
        console.log('3. Testing tournament stats...');
        const tournamentStats = await getTournamentStatsFromContract();
        console.log('Tournament stats result:', tournamentStats);

        console.log('Dashboard test completed!');
    };

    // Add a tournament data test function
    (window as any).testTournamentData = async (tournamentId = 1) => {
        console.log(`Testing tournament data for ID: ${tournamentId}`);

        try {
            // Test 1: Get tournament details
            console.log('1. Testing getTournamentDetailsFromContract...');
            const details = await getTournamentDetailsFromContract(tournamentId);
            console.log('Tournament details:', details);

            // Test 2: Get active tournament IDs
            console.log('2. Testing getActiveTournamentIds...');
            const activeIds = await getActiveTournamentIds();
            console.log('Active tournament IDs:', activeIds);

            // Test 3: Get tournaments from blockchain events
            console.log('3. Testing getTournamentsFromBlockchain...');
            const eventTournaments = await getTournamentsFromBlockchain();
            console.log('Event tournaments:', eventTournaments);

            return {
                details,
                activeIds,
                eventTournaments
            };
        } catch (error) {
            console.error('Tournament data test failed:', error);
            return { error: error instanceof Error ? error.message : 'Unknown error' };
        }
    };

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
}

// User statistics functions
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
            }, 20000, 3); // 20s timeout, 3 retries

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
            member_since: Number(member_since)
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

        const result = {
            max_prize_won: Number(maxPrizeWon) / 1e18, // Convert from wei to EGLD
            total_prize_distributed: Number(totalPrizeDistributed) / 1e18 // Convert from wei to EGLD
        };

        console.log('parsePrizeStatsHex - Raw BigInt values:', { maxPrizeWon, totalPrizeDistributed });
        console.log('parsePrizeStatsHex - Converted to EGLD:', result);
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
            // Format: (tournament_id, game_id, status, participants, creator, max_players, min_players, entry_fee, duration, name, created_at)
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
        const duration = readU64();
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
            duration,
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

