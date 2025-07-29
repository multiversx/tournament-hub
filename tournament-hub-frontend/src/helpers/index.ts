export * from './pingPong';
export * from './signAndSendTransactions';

import { contractAddress } from 'config';
import { Address } from '@multiversx/sdk-core';

export async function getTournamentsFromBlockchain() {
    // Fetch tournamentCreated events from the MultiversX API
    const url = `https://devnet-api.multiversx.com/events?address=${contractAddress}&event=tournamentCreated&order=desc`;
    const response = await fetch(url);
    const data = await response.json();
    // Parse events into tournament objects (basic parsing, adjust as needed)
    return data.map((event: any) => {
        // Example: event.topics = ["tournamentCreated", "<tournamentId>", ...]
        return {
            id: parseInt(event.topics[1], 16),
            creator: event.address,
            txHash: event.identifier,
            // Add more fields as needed by parsing event.data or topics
        };
    });
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
        console.log(`[${name}] offset=${offset - raw.length} raw=0x${raw} value=`, value);
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
        // Debug: print as number if safe
        if (val < BigInt(Number.MAX_SAFE_INTEGER)) {
            console.log(`[${name}] as number:`, Number(val));
        }
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
        // Print the offset and next 16 hex chars before reading the length
        console.log(`[readVecAddress] Before reading length for ${name}, offset=${offset}, next16=${hex.slice(offset, offset + 16)}`);
        const lenRaw = readHex(8); // 4 bytes, 8 hex chars
        const len = parseInt(lenRaw, 16);
        console.log(`[readVecAddress] ${name} length raw=0x${lenRaw}, parsed=${len}`);
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
    console.log(`After game_id, offset=${offset}, next16=${hex.slice(offset, offset + 16)}`);
    const status = readU8('status');
    console.log(`After status, offset=${offset}, next16=${hex.slice(offset, offset + 16)}`);
    // participants: 4 bytes (8 hex chars) length, then 64 hex chars per address
    function readVecAddressU32Len(name?: string) {
        const lenRaw = readHex(8); // 4 bytes, 8 hex chars
        const len = parseInt(lenRaw, 16);
        console.log(`[readVecAddressU32Len] ${name} length raw=0x${lenRaw}, parsed=${len}`);
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
    console.log(`After participants, offset=${offset}, next16=${hex.slice(offset, offset + 16)}`);
    const join_deadline = readU64('join_deadline');
    console.log(`After join_deadline, offset=${offset}, next16=${hex.slice(offset, offset + 16)}`);
    const play_deadline = readU64('play_deadline');
    console.log(`After play_deadline, offset=${offset}, next16=${hex.slice(offset, offset + 16)}`);
    const final_podium = readVecAddressU32Len('final_podium');
    console.log(`After final_podium, offset=${offset}, next16=${hex.slice(offset, offset + 16)}`);
    const creator = readAddress('creator');
    console.log(`After creator, offset=${offset}, next16=${hex.slice(offset, offset + 16)}`);
    return {
        game_id,
        status,
        participants,
        join_deadline,
        play_deadline,
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
                scAddress: contractAddress,
                funcName: 'getTournament',
                args: [argHex]
            })
        });
        const data = await response.json();
        const returnData = data.data?.data?.returnData || data.data?.returnData;
        const [base64Result] = returnData || [];
        if (!base64Result) return null;
        const hex = Buffer.from(base64Result, 'base64').toString('hex');
        return parseTournamentHex(hex);
    } catch (err) {
        return null;
    }
}

export async function getActiveTournamentIds() {
    try {
        const response = await fetch('https://devnet-api.multiversx.com/vm-values/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                scAddress: contractAddress,
                funcName: 'getActiveTournamentIds',
                args: []
            })
        });
        const data = await response.json();
        const returnData = data.data?.data?.returnData || data.data?.returnData;
        const [base64Result] = returnData || [];
        if (!base64Result) return [];
        const hex = Buffer.from(base64Result, 'base64').toString('hex');
        const ids = [];
        for (let i = 0; i < hex.length; i += 16) {
            ids.push(BigInt('0x' + hex.slice(i, i + 16)));
        }
        return ids;
    } catch (err) {
        return [];
    }
}

export async function getGameConfig(gameId: number | bigint) {
    const argHex = BigInt(gameId).toString(16).padStart(16, '0');
    try {
        const response = await fetch('https://devnet-api.multiversx.com/vm-values/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                scAddress: contractAddress,
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
                scAddress: contractAddress,
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

function parseGameConfigHex(hex: string) {
    let offset = 0;
    function logField(name: string, raw: string, value: any) {
        console.log(`[GameConfig:${name}] offset=${offset - raw.length} raw=0x${raw} value=`, value);
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
