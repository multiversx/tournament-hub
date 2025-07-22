export * from './pingPong';
export * from './signAndSendTransactions';

import { contractAddress } from 'config';

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

export function parseTournamentHex(hex: string) {
    let offset = 0;
    function readHex(len: number) {
        const out = hex.slice(offset, offset + len);
        offset += len;
        return out;
    }
    function readU64() {
        return parseInt(readHex(16), 16);
    }
    function readU8() {
        return parseInt(readHex(2), 16);
    }
    function readBigUint() {
        const len = parseInt(readHex(2), 16) * 2; // length in bytes, 2 hex chars per byte
        return BigInt('0x' + readHex(len));
    }
    function readVecAddress() {
        const len = parseInt(readHex(2), 16); // number of addresses
        const addrs = [];
        for (let i = 0; i < len; i++) {
            addrs.push('erd1' + readHex(62)); // MultiversX addresses are 62 hex chars after 'erd1'
        }
        return addrs;
    }
    function readAddress() {
        return 'erd1' + readHex(62);
    }

    const game_id = readU64();
    const status = readU8();
    const entry_fee = readBigUint();
    const participants = readVecAddress();
    // skip prize_pool, join_deadline, play_deadline, final_podium for now
    // prize_pool (BigUint)
    const prize_pool_len = parseInt(readHex(2), 16) * 2;
    offset += prize_pool_len;
    // join_deadline (u64)
    offset += 16;
    // play_deadline (u64)
    offset += 16;
    // final_podium (Vec<ManagedAddress>)
    const podium_len = parseInt(readHex(2), 16);
    offset += podium_len * 62;
    const creator = readAddress();

    return { game_id, status, entry_fee, participants, creator };
}

// Update getTournamentDetailsFromContract to use the parser
export async function getTournamentDetailsFromContract(tournamentId: number) {
    const argHex = tournamentId.toString(16).padStart(16, '0');
    const argBase64 = Buffer.from(argHex, 'hex').toString('base64');

    console.log('[getTournamentDetailsFromContract] tournamentId:', tournamentId);
    console.log('  argHex:', argHex);
    console.log('  argBase64:', argBase64);

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
        console.log('  response.status:', response.status);
        const data = await response.json();
        console.log('  response.data:', data);
        const [base64Result] = data.data.returnData || [];
        if (!base64Result) return null;
        const hex = Buffer.from(base64Result, 'base64').toString('hex');
        return parseTournamentHex(hex);
    } catch (err) {
        console.error('[getTournamentDetailsFromContract] Error for tournamentId', tournamentId, err);
        return null;
    }
}

export async function getActiveTournamentIds() {
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
    const [base64Result] = data.data.returnData || [];
    if (!base64Result) return [];
    const hex = Buffer.from(base64Result, 'base64').toString('hex');
    // Each u64 is 16 hex chars
    const ids = [];
    for (let i = 0; i < hex.length; i += 16) {
        ids.push(parseInt(hex.slice(i, i + 16), 16));
    }
    return ids;
}
