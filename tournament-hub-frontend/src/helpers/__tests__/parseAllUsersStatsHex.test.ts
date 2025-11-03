const { parseAllUsersStatsHexOptimized } = require('../optimized-parser');

function stringifyWithBigInt(obj: any) {
  return JSON.stringify(obj, (key, value) => (typeof value === 'bigint' ? value.toString() : value), 2);
}

function b64ToHex(b64: string): string {
  const bin = Buffer.from(b64, 'base64').toString('binary');
  return Array.from(bin, c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
}

describe('parseAllUsersStatsHexOptimized -- base64 extraction', () => {
  it('should decode every user and show their fields', () => {
    const base64 = 'LMLf0aXVf67yCd+/4/5UkND4WO7f9L9CUKD/6/wyAGUAAAACAAAAAQAAAAAAABOIAAAACAK/b/NxhwAAAAAAAAAAAAEAAAABAAAAAQAAAAEAAAAAaPjyFAAAAABo+PHwAAAF6RGXSQueyx2Og62FYlZZMs5CdMfhBVFoZcX1XiW6VAUfAAAAAgAAAAAAAAABAAAAAAAAAAAAAAAIAWNFeF2KAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGj48hQAAAAAaPjyAgAABc8=';
    const hex = b64ToHex(base64);
    console.log('hex.len=', hex.length);
    console.log('hex[0..64]=', hex.slice(0, 64));
    console.log('hex[64..96]=', hex.slice(64, 96));
    console.log('hex[96..128]=', hex.slice(96, 128));

    const users = parseAllUsersStatsHexOptimized(base64);
    console.log(stringifyWithBigInt(users));
  });
});
