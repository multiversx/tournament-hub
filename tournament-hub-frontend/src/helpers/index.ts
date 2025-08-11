export * from './pingPong';
export * from './signAndSendTransactions';

import { getContractAddress, getNetwork } from '../config/contract';
import { Address } from '@multiversx/sdk-core';

// Cache for API responses
const apiCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
const API_CACHE_TTL = 30 * 1000; // 30 seconds

// Request deduplication
const pendingApiRequests = new Map<string, Promise<any>>();

// Expose a safe way to clear API-level caches from the UI
export function clearApiCaches(): void {
    apiCache.clear();
    pendingApiRequests.clear();
}

// Lightweight fetch wrapper with timeout to avoid hanging requests
async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs = 15000): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(input, { ...(init || {}), signal: controller.signal });
    } finally {
        clearTimeout(timeout);
    }
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

function deduplicateApiRequest<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    const cached = getCachedApiResponse<T>(key);
    if (cached) {
        return Promise.resolve(cached);
    }

    if (pendingApiRequests.has(key)) {
        return pendingApiRequests.get(key)!;
    }

    const promise = requestFn().then(result => {
        setCachedApiResponse(key, result);
        return result;
    }).finally(() => {
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
            const url = `https://devnet-api.multiversx.com/events?address=${contractAddress}&event=createTournament&from=0&size=50&order=desc`;

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

function hexToBech32(hex: string): string {
    try {
        return Address.fromHex(hex).bech32();
    } catch {
        return 'Invalid address';
    }
}

export async function parseTournamentHex(hex: string) {
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
        // Check if this is a new tournament structure (with min_players, entry_fee, duration, name, created_at)
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
            const duration = readU64('duration');
            const name = readManagedBuffer('name');
            const created_at = readU64('created_at');

            const result = {
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
                duration: BigInt(86400), // 1 day default
                name: `Tournament #${game_id}`, // Default name
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
            const response = await fetch(`https://devnet-api.multiversx.com/vm-values/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    scAddress: getContractAddress(),
                    funcName: 'getTournament',
                    args: [tournamentId.toString(16).padStart(16, '0')],
                }),
            });

            const data = await response.json();
            // Reduce log verbosity for performance

            if (data.data && data.data.data && data.data.data.returnData && data.data.data.returnData.length > 0) {
                const hex = data.data.data.returnData[0];
                const result = await parseTournamentHex(hex);
                return result;
            }
            return null;
        } catch (error) {
            console.error(`getTournamentDetailsFromContract: Error for tournament ${tournamentId}:`, error);
            return null;
        }
    });
}

export async function getActiveTournamentIds() {
    const cacheKey = 'active_tournament_ids';
    return deduplicateApiRequest(cacheKey, async () => {
        try {
            const response = await fetchWithTimeout(`https://devnet-api.multiversx.com/vm-values/query`, {
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

            const data = await response.json();
            console.log('getNumberOfTournaments response:', data);

            if (data?.data?.value) {
                const count = parseInt(data.data.value, 16);
                const safe = Math.max(0, Math.min(count, 1000));
                return Array.from({ length: safe }, (_, i) => BigInt(i + 1));
            }
            const returnData = data?.data?.data?.returnData;
            if (Array.isArray(returnData) && returnData.length > 0) {
                const b64: string = returnData[0];
                const hex = Buffer.from(b64, 'base64').toString('hex');
                const count = parseInt(hex || '0', 16);
                const safe = Math.max(0, Math.min(count, 1000));
                return Array.from({ length: safe }, (_, i) => BigInt(i + 1));
            }

            // If the count isn't available, return empty to let the UI fall back to event discovery
            console.log('No tournaments count found; falling back to events');
            return [];
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
            const response = await fetch(`https://devnet-api.multiversx.com/vm-values/query`, {
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
            const response = await fetchWithTimeout(`https://devnet-api.multiversx.com/vm-values/query`, {
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
            const response = await fetch(`https://devnet-api.multiversx.com/vm-values/query`, {
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
            const response = await fetch(`https://devnet-api.multiversx.com/events?address=${getContractAddress()}&event=submitResults`);
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

        const contractInfoResponse = await fetch(`https://devnet-api.multiversx.com/accounts/${contractAddress}`);
        const contractInfo = await contractInfoResponse.json();

        if (contractInfo.error) {
            return { error: 'Contract not found or not accessible', contractInfo };
        }

        // Get all events from the contract to see what's available
        const allEventsResponse = await fetch(`https://devnet-api.multiversx.com/events?address=${contractAddress}&from=0&size=10&order=desc`);
        const allEventsData = await allEventsResponse.json();

        // Check registered games count
        const gamesResponse = await fetch(`https://devnet-api.multiversx.com/vm-values/query`, {
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
        const gameConfigResponse = await fetch(`https://devnet-api.multiversx.com/vm-values/query`, {
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
        const response = await fetch(`https://devnet-api.multiversx.com/vm-values/query`, {
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
