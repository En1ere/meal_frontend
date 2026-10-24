import { createHmac } from 'node:crypto';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function decodeBase32(value: string) {
    let bits = '';
    for (const character of value.replace(/=+$/u, '').toUpperCase()) {
        const index = alphabet.indexOf(character);
        if (index < 0) throw new Error('Invalid base32 secret');
        bits += index.toString(2).padStart(5, '0');
    }
    const bytes = [];
    for (let offset = 0; offset + 8 <= bits.length; offset += 8)
        bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
    return Buffer.from(bytes);
}

export function totp(secret: string, now = Date.now()) {
    const counter = BigInt(Math.floor(now / 30_000));
    const message = Buffer.alloc(8);
    message.writeBigUInt64BE(counter);
    const digest = createHmac('sha1', decodeBase32(secret)).update(message).digest();
    const offset = digest.at(-1)! & 0x0f;
    const code = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
    return String(code).padStart(6, '0');
}

export async function freshTotp(secret: string) {
    const now = Date.now();
    const remaining = 30_000 - (now % 30_000);
    if (remaining < 10_000) await new Promise((resolve) => setTimeout(resolve, remaining + 500));
    return totp(secret);
}
