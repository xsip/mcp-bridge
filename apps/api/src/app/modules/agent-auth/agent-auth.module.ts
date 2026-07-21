import { Global, Module } from '@nestjs/common';
import { AGENT_AUTHENTICATOR } from '@mcp-bridge/contracts';
import { AuthModule } from '../auth/auth.module';
import { JwtAgentAuthenticatorService } from './jwt-agent-authenticator.service';

/**
 * Global so `AgentGateway` (declared in `libs/api/websocket`, wired up far from
 * here) can resolve `AGENT_AUTHENTICATOR` without `libs/api/websocket` importing
 * anything from `apps/api` — keeping the dependency direction pointing
 * inward, from app to lib, never the reverse.
 */
@Global()
@Module({
  imports: [AuthModule],
  providers: [{ provide: AGENT_AUTHENTICATOR, useClass: JwtAgentAuthenticatorService }],
  exports: [AGENT_AUTHENTICATOR],
})
export class AgentAuthModule {}
