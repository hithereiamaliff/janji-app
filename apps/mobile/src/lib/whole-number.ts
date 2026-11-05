/** The number typed, if it's a whole number of zero or more; decimals, signs and words aren't. */
export function wholeNumber(text: string): number | null {
  const trimmed = text.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}
