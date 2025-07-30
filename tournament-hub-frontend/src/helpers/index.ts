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
        // Debug logging removed
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
    return {
        game_id,
        status,
        participants,
        final_podium,
        creator
    };
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
            return [];
        }
        const hex = Buffer.from(base64Result, 'base64').toString('hex');
        const ids = [];
        for (let i = 0; i < hex.length; i += 16) {
            ids.push(BigInt('0x' + hex.slice(i, i + 16)));
        }
        return ids;
    } catch (err) {
        console.error('getActiveTournamentIds: Error:', err);
        return [];
    }
}

// Try to find tournaments by testing common IDs
export async function findTournamentsByTesting() {
    const foundTournaments = [];

    // Test IDs 1-20 to see if any tournaments exist
    for (let i = 1; i <= 20; i++) {
        try {
            const details = await getTournamentDetailsFromContract(i);
            if (details) {
                foundTournaments.push(BigInt(i));
            }
        } catch (err) {
            // Ignore errors
        }
    }

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
        return BigInt('0x' + hex);
    } catch (err) {
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
