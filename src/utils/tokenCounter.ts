import { encode } from 'gpt-tokenizer';

/**
 * Approximate token count for a string.
 * Uses the o200k_base encoding (gpt-4o family).
 * Slightly underestimates (ignores ~4 tokens/message overhead) but
 * that's acceptable given our 3000-token budget has sufficient headroom.
 */
export function countTokens(text: string): number {
  return encode(text).length;
}
