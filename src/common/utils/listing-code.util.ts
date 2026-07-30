import { randomInt } from 'crypto';

/** Alphabet tránh nhầm 0/O, 1/I/L */
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Sinh mã tin công khai dạng BDS-XXXXXX (6 ký tự).
 * Dùng để search / URL thay ObjectId.
 */
export function generateListingPublicCode(): string {
  let body = '';
  for (let i = 0; i < 6; i += 1) {
    body += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return `BDS-${body}`;
}

export function isListingPublicCode(value?: string | null): boolean {
  return Boolean(value && /^BDS-[2-9A-HJ-NP-Z]{6}$/i.test(value.trim()));
}

export function normalizeListingPublicCode(value: string): string {
  return value.trim().toUpperCase();
}
