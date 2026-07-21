export class ClientNotFoundError extends Error {
  constructor(ownerId: string) {
    super(`No online agent found for account "${ownerId}"`);
    this.name = 'ClientNotFoundError';
  }
}

export class McpNotFoundError extends Error {
  constructor(mcpId: string) {
    super(`No active MCP found for id "${mcpId}"`);
    this.name = 'McpNotFoundError';
  }
}

export class RequestTimeoutError extends Error {
  constructor(requestId: string) {
    super(`Request "${requestId}" timed out waiting for an agent response`);
    this.name = 'RequestTimeoutError';
  }
}

export class TooManyPendingRequestsError extends Error {
  constructor(limit: number) {
    super(`Maximum number of pending requests (${limit}) has been reached`);
    this.name = 'TooManyPendingRequestsError';
  }
}
