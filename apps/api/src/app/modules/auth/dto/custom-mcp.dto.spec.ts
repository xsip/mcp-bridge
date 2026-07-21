import { normalizeSubPath } from './custom-mcp.dto';

describe('normalizeSubPath', () => {
  it('adds a leading slash when missing', () => {
    expect(normalizeSubPath('api/mcp')).toBe('/api/mcp');
  });

  it('keeps an already-correct value as-is', () => {
    expect(normalizeSubPath('/api/mcp')).toBe('/api/mcp');
  });

  it('strips a trailing slash', () => {
    expect(normalizeSubPath('/api/mcp/')).toBe('/api/mcp');
  });

  it('treats blank/whitespace-only input as "none"', () => {
    expect(normalizeSubPath('')).toBeUndefined();
    expect(normalizeSubPath('   ')).toBeUndefined();
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeSubPath('  /api  ')).toBe('/api');
  });

  it('returns undefined for non-string input', () => {
    expect(normalizeSubPath(undefined)).toBeUndefined();
    expect(normalizeSubPath(null)).toBeUndefined();
  });
});
