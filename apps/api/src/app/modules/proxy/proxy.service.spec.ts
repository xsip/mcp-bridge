import type { Request, Response } from 'express';
import type { RequestRouter } from '@mcp-bridge/contracts';
import { McpNotFoundError } from '@mcp-bridge/common';
import { AppLogger } from '@mcp-bridge/logging';
import type { McpLookupService } from '../mcp/mcp-lookup.service';
import type { McpLogService } from '../mcp/mcp-log.service';
import { ProxyService } from './proxy.service';

function createResponse(): Response {
  const res: Partial<Response> = {
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
  };
  return res as Response;
}

function createMcpLookup(): McpLookupService {
  return {
    resolve: jest.fn().mockResolvedValue({ ownerId: 'alice', mcp: { id: 'mcp-1', name: 'notes', port: 3333, active: true } }),
  } as unknown as McpLookupService;
}

function createMcpLog(): McpLogService {
  return { record: jest.fn().mockResolvedValue(undefined) } as unknown as McpLogService;
}

describe('ProxyService', () => {
  it('resolves the mcp id, forwards through the router, and writes the response', async () => {
    const router: RequestRouter = {
      forward: jest.fn().mockResolvedValue({ status: 200, headers: { 'x-test': '1' }, body: { hello: 'world' } }),
    };
    const mcpLookup = createMcpLookup();
    const mcpLog = createMcpLog();
    const service = new ProxyService(router, mcpLookup, mcpLog, new AppLogger());
    const res = createResponse();
    const req = { method: 'GET', headers: {}, query: {}, body: undefined } as unknown as Request;

    await service.handle('alice-notes', '/tools/list', req, res);

    expect(mcpLookup.resolve).toHaveBeenCalledWith('alice-notes');
    expect(router.forward).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: 'alice', mcpName: 'notes', method: 'GET', path: '/tools/list' }),
    );
    expect(res.setHeader).toHaveBeenCalledWith('x-test', '1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ hello: 'world' });
    expect(mcpLog.record).toHaveBeenCalledWith(
      'alice',
      'mcp-1',
      'notes',
      expect.objectContaining({ method: 'GET', path: '/tools/list', status: 200, ok: true }),
    );
  });

  it('strips hop-by-hop/length headers from the agent response instead of passing them through', async () => {
    const router: RequestRouter = {
      forward: jest.fn().mockResolvedValue({
        status: 200,
        headers: { 'content-length': '12', 'transfer-encoding': 'chunked', connection: 'keep-alive', 'x-test': '1' },
        body: { hello: 'world' },
      }),
    };
    const mcpLookup = createMcpLookup();
    const mcpLog = createMcpLog();
    const service = new ProxyService(router, mcpLookup, mcpLog, new AppLogger());
    const res = createResponse();
    const req = { method: 'GET', headers: {}, query: {}, body: undefined } as unknown as Request;

    await service.handle('alice-notes', '/tools/list', req, res);

    expect(res.setHeader).toHaveBeenCalledWith('x-test', '1');
    expect(res.setHeader).not.toHaveBeenCalledWith('content-length', expect.anything());
    expect(res.setHeader).not.toHaveBeenCalledWith('transfer-encoding', expect.anything());
    expect(res.setHeader).not.toHaveBeenCalledWith('connection', expect.anything());
  });

  it('ends the response without a body when the agent returns none', async () => {
    const router: RequestRouter = {
      forward: jest.fn().mockResolvedValue({ status: 204, headers: {} }),
    };
    const mcpLookup = createMcpLookup();
    const mcpLog = createMcpLog();
    const service = new ProxyService(router, mcpLookup, mcpLog, new AppLogger());
    const res = createResponse();
    const req = { method: 'DELETE', headers: {}, query: {}, body: undefined } as unknown as Request;

    await service.handle('alice-notes', '/items/1', req, res);

    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('propagates McpNotFoundError when the mcp id does not resolve', async () => {
    const router: RequestRouter = { forward: jest.fn() };
    const mcpLookup = {
      resolve: jest.fn().mockRejectedValue(new McpNotFoundError('unknown-mcp')),
    } as unknown as McpLookupService;
    const mcpLog = createMcpLog();
    const service = new ProxyService(router, mcpLookup, mcpLog, new AppLogger());
    const req = { method: 'GET', headers: {}, query: {}, body: undefined } as unknown as Request;

    await expect(service.handle('unknown-mcp', '/', req, createResponse())).rejects.toBeInstanceOf(McpNotFoundError);
    expect(router.forward).not.toHaveBeenCalled();
  });

  it('records a failed log entry and rethrows when forwarding fails', async () => {
    const router: RequestRouter = { forward: jest.fn().mockRejectedValue(new Error('agent offline')) };
    const mcpLookup = createMcpLookup();
    const mcpLog = createMcpLog();
    const service = new ProxyService(router, mcpLookup, mcpLog, new AppLogger());
    const req = { method: 'GET', headers: {}, query: {}, body: undefined } as unknown as Request;

    await expect(service.handle('alice-notes', '/tools/list', req, createResponse())).rejects.toThrow('agent offline');

    expect(mcpLog.record).toHaveBeenCalledWith(
      'alice',
      'mcp-1',
      'notes',
      expect.objectContaining({ ok: false, errorMessage: 'agent offline' }),
    );
  });
});
