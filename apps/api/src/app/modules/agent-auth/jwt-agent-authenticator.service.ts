import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import type { AgentAuthenticator, AuthenticatedAgent } from '@mcp-loop/contracts';
import { AppLogger } from '@mcp-loop/logging';
import { User, UserDocument } from '../auth/user.schema';

/**
 * Authenticates a desktop agent's `hello` message using the same JWT the
 * user received from `POST /auth/login` — the agent is just another client
 * of that account, so it reuses the HTTP auth stack rather than a separate
 * credential type.
 */
@Injectable()
export class JwtAgentAuthenticatorService implements AgentAuthenticator {
  constructor(
    private readonly jwtService: JwtService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(JwtAgentAuthenticatorService.name);
  }

  async authenticate(token: string): Promise<AuthenticatedAgent | null> {
    let payload: { user: string };
    try {
      payload = await this.jwtService.verifyAsync(token, { secret: process.env.JWT_SECRET });
    } catch {
      return null;
    }

    const user = await this.userModel.findOne({ username: payload.user }).select('username isActivated').lean().exec();
    if (!user || !user.isActivated) {
      return null;
    }

    return { ownerId: user.username };
  }
}
