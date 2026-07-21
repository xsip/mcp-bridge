import axios from 'axios';
import WebSocket from 'ws';

/**
 * Full round trip: register + activate a real user, connect a WebSocket as
 * that user's desktop agent, register an MCP over HTTP, then act as the
 * agent to answer one proxied request — exercising the same path a real
 * desktop agent and `ProxyController` would.
 *
 * Requires `REGISTER_SECRET` and `RETURN_REGISTER_HASH=true` in the running
 * server's environment (see README "Running locally").
 */
describe('Desktop agent registration and proxying', () => {
  const registerSecret = process.env.REGISTER_SECRET;
  const maybeIt = registerSecret ? it : it.skip;

  function connect(): WebSocket {
    const host = process.env.HOST ?? 'localhost';
    const port = process.env.PORT ?? '3000';
    return new WebSocket(`ws://${host}:${port}/agents`);
  }

  maybeIt('registers an agent by JWT and proxies a request to it', async () => {
    const username = `e2e_${Date.now()}`;

    const registerRes = await axios.post('/auth/register', {
      username,
      password: 'hunter2hunter2',
      registerSecret,
    });
    const activateRes = await axios.get('/auth/activate', {
      params: { hash: registerRes.data.activationHash },
    });
    const token: string = activateRes.data;

    const socket = connect();
    await new Promise<void>((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });
    socket.send(JSON.stringify({ version: 1, type: 'hello', token }));

    // Act as the desktop agent: answer the next forwarded request with a canned response.
    socket.on('message', (raw: Buffer) => {
      const message = JSON.parse(raw.toString('utf-8'));
      if (message.type === 'ping') {
        socket.send(JSON.stringify({ version: 1, type: 'pong' }));
      }
      if (message.type === 'request') {
        socket.send(
          JSON.stringify({
            version: 1,
            type: 'response',
            requestId: message.requestId,
            status: 200,
            headers: { 'content-type': 'application/json' },
            body: { echoedPath: message.path, mcpName: message.mcpName },
          }),
        );
      }
    });

    await axios.post(
      '/mcps',
      { name: 'notes', port: 4444 },
      { headers: { Authorization: `Bearer ${token}` } },
    );

    // Give the gateway a moment to finish processing the `hello`.
    await new Promise((resolve) => setTimeout(resolve, 250));

    const proxyRes = await axios.get(`/mcp/${username}-notes/tools/list`);

    expect(proxyRes.status).toBe(200);
    expect(proxyRes.data).toEqual({ echoedPath: '/tools/list', mcpName: 'notes' });

    socket.close();
  }, 15000);
});
