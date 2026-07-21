import axios from 'axios';

describe('ANY /mcp/:mcpId/*', () => {
  it('returns 404 when the mcp id does not resolve to an active MCP', async () => {
    await expect(axios.get('/mcp/nouser-nomcp/tools/list')).rejects.toMatchObject({
      response: { status: 404 },
    });
  });
});
