import axios from 'axios';

describe('GET /health', () => {
  it('returns service status and metadata', async () => {
    const res = await axios.get('/health');

    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({
      status: 'ok',
      connectedClients: expect.any(Number),
      uptime: expect.any(Number),
      version: expect.any(String),
      timestamp: expect.any(String),
    });
  });
});
