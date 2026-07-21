/**
 * The public id for a user's MCP is `<username>-<mcpName>` (e.g. `alice-notes`),
 * used directly in the proxy URL `/mcp/:mcpId/*`. Usernames are restricted to
 * `[a-z0-9_]+` at registration time (no hyphens), so splitting on the first
 * hyphen unambiguously separates the username from the (possibly hyphenated)
 * MCP name.
 */
export interface ParsedMcpId {
  username: string;
  mcpName: string;
}

export function buildMcpId(username: string, mcpName: string): string {
  return `${username}-${mcpName}`;
}

export function parseMcpId(mcpId: string): ParsedMcpId | undefined {
  const separatorIndex = mcpId.indexOf('-');
  if (separatorIndex <= 0 || separatorIndex === mcpId.length - 1) {
    return undefined;
  }

  return {
    username: mcpId.slice(0, separatorIndex),
    mcpName: mcpId.slice(separatorIndex + 1),
  };
}
