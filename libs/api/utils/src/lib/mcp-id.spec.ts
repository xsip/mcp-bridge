import { buildMcpId, parseMcpId } from './mcp-id';

describe('mcp id helpers', () => {
  it('builds an id from username and mcp name', () => {
    expect(buildMcpId('alice', 'notes')).toBe('alice-notes');
  });

  it('parses a simple id', () => {
    expect(parseMcpId('alice-notes')).toEqual({ username: 'alice', mcpName: 'notes' });
  });

  it('splits on the first hyphen, keeping hyphens in the mcp name', () => {
    expect(parseMcpId('alice-my-notes-app')).toEqual({ username: 'alice', mcpName: 'my-notes-app' });
  });

  it('returns undefined when there is no hyphen', () => {
    expect(parseMcpId('alice')).toBeUndefined();
  });

  it('returns undefined when the mcp name is empty', () => {
    expect(parseMcpId('alice-')).toBeUndefined();
  });

  it('returns undefined when the username is empty', () => {
    expect(parseMcpId('-notes')).toBeUndefined();
  });
});
