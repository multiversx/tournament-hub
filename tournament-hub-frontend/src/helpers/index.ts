export * from './pingPong';
export * from './signAndSendTransactions';

import { getContractAddress, getNetwork } from '../config/contract';
import { Address } from '@multiversx/sdk-core';

export async function getTournamentsFromBlockchain() {
    try {
        const url = `https://devnet-api.multiversx.com/events?address=${getContractAddress()}&event=tournamentCreated&order=desc`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data || !Array.isArray(data)) {
            return [];
        }

        // Parse events into tournament objects
        const tournaments = data.map((event: any) => {
            // Look for tournamentCreated events by checking the topics
            const tournamentCreatedSignature = '0139472eff6886771a982f3083da5d421f24c29181e63888228dc81ca60d69e1';

            // Check if any topic contains the tournamentCreated signature
            const hasTournamentCreatedSignature = event.topics && event.topics.some((topic: string) => topic === tournamentCreatedSignature);

            if (!hasTournamentCreatedSignature) {
                return null;
            }

            // Extract tournament ID from topics
            let tournamentId = null;
            let gameId = null;
            let creator = null;

            if (event.topics && event.topics.length >= 3) {
                try {
                    // Find the index of the tournamentCreated signature
                    const signatureIndex = event.topics.findIndex((topic: string) => topic === tournamentCreatedSignature);

                    if (signatureIndex >= 0 && signatureIndex + 2 < event.topics.length) {
                        // topics[signatureIndex + 1] should be the tournament_id (u64 = 8 bytes = 16 hex chars)
                        const tournamentIdHex = event.topics[signatureIndex + 1];

                        if (tournamentIdHex.length === 16) {
                            tournamentId = parseInt(tournamentIdHex, 16);
                        }

                        // topics[signatureIndex + 2] should be the game_id (u64 = 8 bytes = 16 hex chars)
                        const gameIdHex = event.topics[signatureIndex + 2];

                        if (gameIdHex.length === 16) {
                            gameId = parseInt(gameIdHex, 16);
                        }
                    }
                } catch (e) {
                    // Ignore parsing errors
                }
            }

            // Extract creator from data
            if (event.data) {
                try {
                    const dataHex = Buffer.from(event.data, 'base64').toString('hex');

                    // The creator address should be in the data field
                    if (dataHex.length >= 64) {
                        creator = '0x' + dataHex.slice(0, 64);
                    }
                } catch (e) {
                    // Ignore parsing errors
                }
            }

            const tournament = {
                id: tournamentId,
                gameId: gameId,
                creator: creator || event.address,
                txHash: event.identifier,
            };

            return tournament;
        }).filter(t => t !== null && t.id !== null && t.id > 0 && t.id < 1000000); // Filter out unreasonable IDs

        return tournaments;
    } catch (err) {
        console.error('getTournamentsFromBlockchain: Error:', err);
        return [];
    }
}

function hexToBech32(hex: string): string {
    try {
        return Address.fromHex(hex).bech32();
    } catch {
        return 'Invalid address';
    }
}

export function parseTournamentHex(hex: string) {
    let offset = 0;
    function logField(name: string, raw: string, value: any) {
        // Only log in development mode or when explicitly debugging
        if (process.env.NODE_ENV === 'development' && false) { // Disabled for now
            console.log(`parseTournamentHex: ${name}: ${value} (raw: ${raw})`);
        }
    }
    function readHex(len: number) {
        const out = hex.slice(offset, offset + len);
        offset += len;
        return out;
    }
    function readU64(name?: string) {
        const raw = readHex(16);
        const val = BigInt('0x' + raw);
        if (name) logField(name, raw, val);
        return val;
    }
    function readU32(name?: string) {
        const raw = readHex(8);
        const val = parseInt(raw, 16);
        if (name) logField(name, raw, val);
        return val;
    }
    function readEnum(name?: string) {
        return readU32(name);
    }
    function readVecAddress(name?: string) {
        const lenRaw = readHex(8); // 4 bytes, 8 hex chars
        const len = parseInt(lenRaw, 16);
        const addresses = [];
        for (let i = 0; i < len; i++) {
            const hexAddr = readHex(64);
            const bech32 = hexToBech32(hexAddr);
            addresses.push(bech32);
        }
        if (name) logField(name, lenRaw + addresses.map(a => a).join(''), `[${addresses.length} addresses]`);
        return addresses;
    }
    function readAddress(name?: string) {
        const hexAddr = readHex(64);
        const bech32 = hexToBech32(hexAddr);
        if (name) logField(name, hexAddr, bech32);
        return bech32;
    }
    // WORKAROUND: status is encoded as u8 (1 byte, 2 hex chars)
    function readU8(name?: string) {
        const raw = readHex(2);
        const val = parseInt(raw, 16);
        if (name) logField(name, raw, val);
        return val;
    }
    function readBigUint(name?: string) {
        const lenRaw = readHex(8); // 4 bytes, 8 hex chars
        const len = parseInt(lenRaw, 16);
        const valueHex = readHex(len * 2);
        const val = BigInt('0x' + valueHex);
        if (name) logField(name, lenRaw + valueHex, val);
        return val;
    }
    function readManagedBuffer(name?: string) {
        const lenRaw = readHex(8); // 4 bytes, 8 hex chars
        const len = parseInt(lenRaw, 16);
        const valueHex = readHex(len * 2);
        const val = Buffer.from(valueHex, 'hex').toString('utf8');
        if (name) logField(name, lenRaw + valueHex, val);
        return val;
    }

    try {
        const game_id = readU64('game_id');
        const status = readU8('status');
        // participants: 4 bytes (8 hex chars) length, then 64 hex chars per address
        function readVecAddressU32Len(name?: string) {
            const lenRaw = readHex(8); // 4 bytes, 8 hex chars
            const len = parseInt(lenRaw, 16);
            const addresses = [];
            for (let i = 0; i < len; i++) {
                const hexAddr = readHex(64);
                const bech32 = hexToBech32(hexAddr);
                addresses.push(bech32);
            }
            if (name) logField(name, lenRaw + addresses.map(a => a).join(''), `[${addresses.length} addresses]`);
            return addresses;
        }
        const participants = readVecAddressU32Len('participants');
        const final_podium = readVecAddressU32Len('final_podium');
        const creator = readAddress('creator');

        // Check if we have enough data for new tournament structure
        const remainingHex = hex.length - offset;
        console.log(`parseTournamentHex: Remaining hex length: ${remainingHex}, offset: ${offset}, total: ${hex.length}`);

        // If we have enough data, try to parse new fields
        if (remainingHex >= 40) { // Minimum for new fields (8+8+16+8 = 40 hex chars)
            try {
                const max_players = readU32('max_players');
                const entry_fee = readBigUint('entry_fee');
                const duration = readU64('duration');
                const name = readManagedBuffer('name');
                const created_at = readU64('created_at');

                console.log(`parseTournamentHex: Successfully parsed new tournament structure for game_id: ${game_id}`);
                return {
                    game_id,
                    status,
                    participants,
                    final_podium,
                    creator,
                    max_players,
                    entry_fee,
                    duration,
                    name,
                    created_at
                };
            } catch (err) {
                console.log(`parseTournamentHex: Failed to parse new structure for game_id: ${game_id}, falling back to old structure`);
                // Fall back to old structure
            }
        }

        // Old tournament structure (without new fields)
        console.log(`parseTournamentHex: Using old tournament structure for game_id: ${game_id}`);
        return {
            game_id,
            status,
            participants,
            final_podium,
            creator,
            // Default values for new fields
            max_players: 8,
            entry_fee: BigInt(0),
            duration: BigInt(86400), // 24 hours default
            name: `Tournament #${game_id}`,
            created_at: BigInt(0)
        };
    } catch (err) {
        console.error('parseTournamentHex: Error parsing tournament data:', err);
        console.error('parseTournamentHex: Hex data:', hex);
        console.error('parseTournamentHex: Offset at error:', offset);
        return null;
    }
}

// Update getTournamentDetailsFromContract to use the parser
export async function getTournamentDetailsFromContract(tournamentId: number | bigint) {
    const argHex = BigInt(tournamentId).toString(16).padStart(16, '0');
    try {
        const response = await fetch('https://devnet-api.multiversx.com/vm-values/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                scAddress: getContractAddress(),
                funcName: 'getTournament',
                args: [argHex]
            })
        });
        const data = await response.json();

        // Check if there's an error
        if (data.error) {
            console.error(`getTournamentDetailsFromContract: API error for tournament ${tournamentId}:`, data.error);
            return null;
        }

        const returnData = data.data?.data?.returnData || data.data?.returnData;
        const [base64Result] = returnData || [];
        if (!base64Result) {
            return null;
        }

        const hex = Buffer.from(base64Result, 'base64').toString('hex');
        const result = parseTournamentHex(hex);
        return result;
    } catch (err) {
        console.error(`getTournamentDetailsFromContract: Error for tournament ${tournamentId}:`, err);
        return null;
    }
}

export async function getActiveTournamentIds() {
    try {
        const response = await fetch('https://devnet-api.multiversx.com/vm-values/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                scAddress: getContractAddress(),
                funcName: 'getActiveTournamentIds',
                args: []
            })
        });
        const data = await response.json();

        // Check if there's an error
        if (data.error) {
            console.error('getActiveTournamentIds: API error:', data.error);
            return [];
        }

        const returnData = data.data?.data?.returnData || data.data?.returnData;
        const [base64Result] = returnData || [];
        if (!base64Result) {
            console.log('getActiveTournamentIds: No return data found');
            return [];
        }

        const hex = Buffer.from(base64Result, 'base64').toString('hex');
        console.log(`getActiveTournamentIds: Raw hex data: ${hex}`);
        console.log(`getActiveTournamentIds: Raw hex data length: ${hex.length}`);

        const ids = [];
        for (let i = 0; i < hex.length; i += 16) {
            const idHex = hex.slice(i, i + 16);
            if (idHex.length === 16) {
                const id = BigInt('0x' + idHex);
                ids.push(id);
                console.log(`getActiveTournamentIds: Parsed ID ${id} from hex ${idHex}`);
            }
        }

        console.log(`getActiveTournamentIds: Found ${ids.length} tournament IDs:`, ids);
        return ids;
    } catch (err) {
        console.error('getActiveTournamentIds: Error:', err);
        return [];
    }
}

// Try to find tournaments by testing common IDs
export async function findTournamentsByTesting() {
    const foundTournaments = [];

    // Test IDs 1-100 to see if any tournaments exist (increased from 20 to 100)
    for (let i = 1; i <= 100; i++) {
        try {
            const details = await getTournamentDetailsFromContract(i);
            if (details) {
                foundTournaments.push(BigInt(i));
            }
        } catch (err) {
            // Ignore errors
        }
    }

    console.log(`findTournamentsByTesting: Found ${foundTournaments.length} tournaments`);
    return foundTournaments;
}



export async function getGameConfig(gameId: number | bigint) {
    const argHex = BigInt(gameId).toString(16).padStart(16, '0');
    try {
        const response = await fetch('https://devnet-api.multiversx.com/vm-values/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                scAddress: getContractAddress(),
                funcName: 'getGameConfig',
                args: [argHex]
            })
        });
        const data = await response.json();
        const returnData = data.data?.data?.returnData || data.data?.returnData;
        const [base64Result] = returnData || [];
        if (!base64Result) return null;
        const hex = Buffer.from(base64Result, 'base64').toString('hex');
        return parseGameConfigHex(hex);
    } catch (err) {
        return null;
    }
}

export async function getPrizePoolFromContract(tournamentId: number | bigint) {
    const argHex = BigInt(tournamentId).toString(16).padStart(16, '0');
    try {
        const response = await fetch('https://devnet-api.multiversx.com/vm-values/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                scAddress: getContractAddress(),
                funcName: 'getPrizePool',
                args: [argHex]
            })
        });
        const data = await response.json();
        const returnData = data.data?.data?.returnData || data.data?.returnData;
        const [base64Result] = returnData || [];
        if (!base64Result) return BigInt(0);
        const hex = Buffer.from(base64Result, 'base64').toString('hex');
        const prizePool = BigInt('0x' + hex);

        return prizePool;
    } catch (err) {
        console.error(`getPrizePoolFromContract: Error for tournament ${tournamentId}:`, err);
        return BigInt(0);
    }
}

export async function getTournamentFeeFromContract() {
    try {
        const response = await fetch('https://devnet-api.multiversx.com/vm-values/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                scAddress: getContractAddress(),
                funcName: 'getTournamentFee',
                args: []
            })
        });
        const data = await response.json();

        // Check if there's an error
        if (data.error) {
            console.error('getTournamentFeeFromContract: API error:', data.error);
            return '0';
        }

        const returnData = data.data?.data?.returnData || data.data?.returnData;
        const [base64Result] = returnData || [];
        if (!base64Result) {
            return '0';
        }
        const hex = Buffer.from(base64Result, 'base64').toString('hex');
        return BigInt('0x' + hex).toString();
    } catch (err) {
        console.error('getTournamentFeeFromContract: Error:', err);
        return '0';
    }
}

export async function getSubmitResultsTransactionHash(tournamentId: number | bigint) {
    try {
        console.log(`Searching for result TX for tournament ${tournamentId}...`);

        // Query all events for the contract to find resultsSubmitted events
        const contractAddress = getContractAddress();

        // Try with larger size first, then paginate if needed
        let url = `https://devnet-api.multiversx.com/events?address=${contractAddress}&order=desc&size=500`;
        console.log(`Contract address: ${contractAddress}`);
        console.log(`Fetching events from: ${url}`);

        const response = await fetch(url);
        const data = await response.json();

        if (!data || !Array.isArray(data)) {
            console.log(`No events found for tournament ${tournamentId}`);
            return null;
        }

        console.log(`Found ${data.length} events, searching for resultsSubmitted...`);

        // Debug: Show all event types found
        const eventTypes = new Set();
        data.forEach((event: any) => {
            if (event.topics && event.topics.length > 0) {
                eventTypes.add(event.topics[0]);
            }
        });
        console.log('Found event types:', Array.from(eventTypes));

        // The resultsSubmitted event signature hash (keccak256 of "resultsSubmitted(u64,address)")
        const resultsSubmittedSignature = '0139472eff6886771a982f3083da5d421f24c29181e63888228dc81ca60d69e1';
        console.log('Looking for resultsSubmitted signature:', resultsSubmittedSignature);
        console.log('Is resultsSubmitted signature in event types?', eventTypes.has(resultsSubmittedSignature));

        // Also try looking for the event name directly in the first topic
        const resultsSubmittedName = Buffer.from('resultsSubmitted', 'utf8').toString('hex');
        console.log('Looking for resultsSubmitted name:', resultsSubmittedName);
        console.log('Is resultsSubmitted name in event types?', eventTypes.has(resultsSubmittedName));

        // Look for the resultsSubmitted event for this specific tournament
        let resultsSubmittedCount = 0;
        for (const event of data) {
            if (event.topics && event.topics.length >= 3) { // resultsSubmitted should have at least 3 topics
                // Check if this is a resultsSubmitted event by signature or name
                const firstTopic = event.topics[0];
                const isResultsSubmitted = firstTopic === resultsSubmittedSignature ||
                    firstTopic === resultsSubmittedName;

                if (isResultsSubmitted) {
                    resultsSubmittedCount++;
                    console.log(`Found resultsSubmitted event #${resultsSubmittedCount}, checking topics:`, event.topics);

                    // The tournament_id should be in the second topic (index 1)
                    if (event.topics.length >= 2) {
                        const tournamentIdTopic = event.topics[1];

                        // Validate that the tournament ID topic looks like a reasonable tournament ID
                        // Tournament IDs should be relatively small numbers, not extremely long hex strings
                        if (tournamentIdTopic.length <= 16) { // Max 8 bytes for u64
                            // Use BigInt for parsing to handle large numbers correctly
                            const tournamentIdFromEvent = BigInt('0x' + tournamentIdTopic);
                            console.log(`Event tournament ID: ${tournamentIdFromEvent}, Looking for: ${tournamentId}`);

                            if (tournamentIdFromEvent === BigInt(tournamentId)) {
                                // Extract only the transaction hash part (remove shard and order metadata)
                                const fullTxHash = event.txHash;
                                const cleanTxHash = fullTxHash.split('-')[0]; // Remove everything after the first dash
                                console.log(`Found result TX for tournament ${tournamentId}: ${cleanTxHash}`);
                                return cleanTxHash;
                            } else {
                                console.log(`Tournament ID mismatch: event has ${tournamentIdFromEvent}, looking for ${tournamentId}`);
                            }
                        } else {
                            console.log(`Skipping event with invalid tournament ID topic length: ${tournamentIdTopic.length} (topic: ${tournamentIdTopic})`);
                        }
                    }
                }
            }
        }

        console.log(`No result TX found for tournament ${tournamentId}. Found ${resultsSubmittedCount} resultsSubmitted events total.`);

        // If we didn't find it in the first 500 events, try with even more events
        if (resultsSubmittedCount > 0) {
            console.log(`Trying with more events (1000) to find tournament ${tournamentId}...`);
            url = `https://devnet-api.multiversx.com/events?address=${contractAddress}&order=desc&size=1000`;
            const response2 = await fetch(url);
            const data2 = await response2.json();

            if (data2 && Array.isArray(data2)) {
                console.log(`Found ${data2.length} events in second search...`);

                for (const event of data2) {
                    if (event.topics && event.topics.length >= 3) {
                        const firstTopic = event.topics[0];
                        const isResultsSubmitted = firstTopic === resultsSubmittedSignature ||
                            firstTopic === resultsSubmittedName;

                        if (isResultsSubmitted) {
                            if (event.topics.length >= 2) {
                                const tournamentIdTopic = event.topics[1];
                                if (tournamentIdTopic.length <= 16) {
                                    const tournamentIdFromEvent = BigInt('0x' + tournamentIdTopic);
                                    if (tournamentIdFromEvent === BigInt(tournamentId)) {
                                        const fullTxHash = event.txHash;
                                        const cleanTxHash = fullTxHash.split('-')[0];
                                        console.log(`Found result TX for tournament ${tournamentId} in extended search: ${cleanTxHash}`);
                                        return cleanTxHash;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        return null;
    } catch (err) {
        console.error('getSubmitResultsTransactionHash: Error:', err);
        return null;
    }
}

function parseGameConfigHex(hex: string) {
    let offset = 0;
    function logField(name: string, raw: string, value: any) {
        // Debug logging removed
    }
    function readHex(len: number) {
        const out = hex.slice(offset, offset + len);
        offset += len;
        return out;
    }
    function readAddress(name?: string) {
        const hexAddr = readHex(64);
        const bech32 = hexToBech32(hexAddr);
        if (name) logField(name, hexAddr, bech32);
        return bech32;
    }
    function readU32(name?: string) {
        const raw = readHex(8);
        const val = parseInt(raw, 16);
        if (name) logField(name, raw, val);
        return val;
    }
    function readVecU32(name?: string) {
        const lenRaw = readHex(8);
        const len = parseInt(lenRaw, 16);
        const values = [];
        for (let i = 0; i < len; i++) {
            const raw = readHex(8);
            const val = parseInt(raw, 16);
            values.push(val);
        }
        if (name) logField(name, lenRaw + values.map(v => v.toString(16).padStart(8, '0')).join(''), `[${values.length} u32s]`);
        return values;
    }
    function readBool(name?: string) {
        const raw = readHex(2); // 1 byte = 2 hex chars
        const val = raw === '01';
        if (name) logField(name, raw, val);
        return val;
    }
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
}

// Debug function to test tournament discovery - can be called from browser console
export async function debugTournamentDiscovery() {
    console.log('=== Tournament Discovery Debug ===');

    try {
        // Test getNumberOfTournaments
        const response = await fetch('https://devnet-api.multiversx.com/vm-values/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                scAddress: getContractAddress(),
                funcName: 'getNumberOfTournaments',
                args: []
            })
        });
        const data = await response.json();
        console.log('getNumberOfTournaments response:', data);

        // Test getActiveTournamentIds
        const ids = await getActiveTournamentIds();
        console.log('getActiveTournamentIds result:', ids);

        // Test findTournamentsByTesting
        const testIds = await findTournamentsByTesting();
        console.log('findTournamentsByTesting result:', testIds);

        console.log('=== End Debug ===');
        return { totalCount: data, activeIds: ids, testIds: testIds };
    } catch (err) {
        console.error('Debug error:', err);
        return null;
    }
}

// Debug function to test a specific tournament - can be called from browser console
export async function debugSpecificTournament(tournamentId: number) {
    console.log(`=== Debug Tournament ${tournamentId} ===`);

    try {
        const details = await getTournamentDetailsFromContract(tournamentId);
        console.log(`Tournament ${tournamentId} details:`, details);
        return details;
    } catch (err) {
        console.error(`Debug tournament ${tournamentId} error:`, err);
        return null;
    }
}

// Debug function to test the actual number of tournaments in the smart contract
export async function debugTournamentCount() {
    console.log('=== Debug Tournament Count ===');

    try {
        const response = await fetch('https://devnet-api.multiversx.com/vm-values/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                scAddress: getContractAddress(),
                funcName: 'getNumberOfTournaments',
                args: []
            })
        });
        const data = await response.json();
        console.log('getNumberOfTournaments raw response:', data);

        if (data.data?.data?.returnData && data.data.data.returnData.length > 0) {
            const hex = Buffer.from(data.data.data.returnData[0], 'base64').toString('hex');
            console.log('getNumberOfTournaments hex:', hex);
            const count = parseInt(hex, 16);
            console.log('getNumberOfTournaments parsed count:', count);
            return count;
        }

        return null;
    } catch (err) {
        console.error('Debug tournament count error:', err);
        return null;
    }
}

// Debug function to test getActiveTournamentIds directly
export async function debugActiveTournamentIds() {
    console.log('=== Debug Active Tournament IDs ===');

    try {
        const response = await fetch('https://devnet-api.multiversx.com/vm-values/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                scAddress: getContractAddress(),
                funcName: 'getActiveTournamentIds',
                args: []
            })
        });
        const data = await response.json();
        console.log('getActiveTournamentIds raw response:', data);

        if (data.data?.data?.returnData && data.data.data.returnData.length > 0) {
            const base64Result = data.data.data.returnData[0];
            console.log('getActiveTournamentIds base64:', base64Result);

            const hex = Buffer.from(base64Result, 'base64').toString('hex');
            console.log('getActiveTournamentIds hex:', hex);
            console.log('getActiveTournamentIds hex length:', hex.length);

            // Parse the hex data
            const ids = [];
            for (let i = 0; i < hex.length; i += 16) {
                const idHex = hex.slice(i, i + 16);
                if (idHex.length === 16) {
                    const id = BigInt('0x' + idHex);
                    ids.push(id);
                    console.log(`Parsed ID ${id} from hex ${idHex}`);
                }
            }

            console.log('Final parsed IDs:', ids);
            return ids;
        }

        console.log('No return data found');
        return [];
    } catch (err) {
        console.error('Debug active tournament IDs error:', err);
        return [];
    }
}

// Debug function to test if the smart contract is responding
export async function debugContractResponse() {
    console.log('=== Debug Contract Response ===');

    try {
        // Test a simple query that should always work
        const response = await fetch('https://devnet-api.multiversx.com/vm-values/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                scAddress: getContractAddress(),
                funcName: 'getNumberOfTournaments',
                args: []
            })
        });

        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);

        if (!response.ok) {
            console.error('HTTP Error:', response.status, response.statusText);
            return null;
        }

        const data = await response.json();
        console.log('Response data:', data);

        if (data.error) {
            console.error('Contract error:', data.error);
            return null;
        }

        return data;
    } catch (err) {
        console.error('Network error:', err);
        return null;
    }
}

// Debug function to test prize pool calculation for a specific tournament
export async function debugPrizePool(tournamentId: number) {
    console.log(`=== Debug Prize Pool for Tournament ${tournamentId} ===`);

    try {
        // Get tournament details
        const tournament = await getTournamentDetailsFromContract(tournamentId);
        console.log('Tournament details:', tournament);

        if (tournament) {
            console.log('Entry fee (wei):', tournament.entry_fee);
            console.log('Entry fee (EGLD):', Number(tournament.entry_fee) / 1e18);
            console.log('Participants count:', tournament.participants.length);
            console.log('Expected prize pool (entry_fee * participants):', Number(tournament.entry_fee) * tournament.participants.length);
        }

        // Get actual prize pool from contract
        const actualPrizePool = await getPrizePoolFromContract(tournamentId);
        console.log('Actual prize pool from contract (wei):', actualPrizePool);
        console.log('Actual prize pool from contract (EGLD):', Number(actualPrizePool) / 1e18);

        return {
            tournament,
            actualPrizePool,
            expectedPrizePool: tournament ? Number(tournament.entry_fee) * tournament.participants.length : null
        };
    } catch (err) {
        console.error('Error debugging prize pool:', err);
        return null;
    }
}

// Debug function to check entry fees for tournaments
export async function debugEntryFees() {
    console.log('=== Debug Entry Fees ===');

    try {
        // Get all active tournament IDs
        const activeIds = await getActiveTournamentIds();
        console.log('Active tournament IDs:', activeIds);

        for (const id of activeIds) {
            const tournament = await getTournamentDetailsFromContract(Number(id));
            if (tournament) {
                console.log(`Tournament ${id}:`);
                console.log(`  Entry fee (wei): ${tournament.entry_fee}`);
                console.log(`  Entry fee (EGLD): ${Number(tournament.entry_fee) / 1e18}`);
                console.log(`  Participants: ${tournament.participants.length}`);
                console.log(`  Name: ${tournament.name}`);
                console.log('---');
            }
        }
    } catch (err) {
        console.error('Error debugging entry fees:', err);
    }
}

// Debug function to test EGLD to wei conversion
export function debugEgldToWei(egldAmount: string) {
    console.log(`=== Debug EGLD to Wei Conversion ===`);
    console.log(`Input EGLD: ${egldAmount}`);

    // Test the current conversion
    const wei = (parseFloat(egldAmount) * Math.pow(10, 18)).toString();
    console.log(`Current conversion result (wei): ${wei}`);
    console.log(`Current conversion result (hex): ${BigInt(wei).toString(16)}`);

    // Test with BigInt for better precision
    const egldParts = egldAmount.split('.');
    const wholePart = egldParts[0] || '0';
    const decimalPart = egldParts[1] || '0';

    // Pad decimal part to 18 digits
    const paddedDecimal = decimalPart.padEnd(18, '0').slice(0, 18);
    const weiBigInt = BigInt(wholePart + paddedDecimal);

    console.log(`BigInt conversion result (wei): ${weiBigInt.toString()}`);
    console.log(`BigInt conversion result (hex): ${weiBigInt.toString(16)}`);

    return {
        parseFloat: wei,
        bigInt: weiBigInt.toString()
    };
}

// Make it available globally for browser console access
if (typeof window !== 'undefined') {
    (window as any).debugTournamentDiscovery = debugTournamentDiscovery;
    (window as any).debugSpecificTournament = debugSpecificTournament;
    (window as any).debugTournamentCount = debugTournamentCount;
    (window as any).debugActiveTournamentIds = debugActiveTournamentIds;
    (window as any).debugContractResponse = debugContractResponse;
    (window as any).debugPrizePool = debugPrizePool;
    (window as any).debugEntryFees = debugEntryFees;
    (window as any).debugEgldToWei = debugEgldToWei;
}
