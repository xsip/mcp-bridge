import { validateEnvironment } from './env.validation';

describe('validateEnvironment', () => {
  it('applies defaults when no variables are set', () => {
    const config = validateEnvironment({});
    expect(config).toMatchObject({
      BACKEND_PORT: 3000,
      REQUEST_TIMEOUT: 30_000,
      WS_HEARTBEAT_INTERVAL: 15_000,
      MAX_PENDING_REQUESTS: 1000,
      LOG_LEVEL: 'log',
    });
  });

  it('coerces numeric string env vars', () => {
    const config = validateEnvironment({ BACKEND_PORT: '4000', REQUEST_TIMEOUT: '5000' });
    expect(config.BACKEND_PORT).toBe(4000);
    expect(config.REQUEST_TIMEOUT).toBe(5000);
  });

  it('throws when a value fails validation', () => {
    expect(() => validateEnvironment({ BACKEND_PORT: 'not-a-number' })).toThrow(/Invalid environment configuration/);
  });

  it('throws for an unsupported LOG_LEVEL', () => {
    expect(() => validateEnvironment({ LOG_LEVEL: 'trace' })).toThrow(/Invalid environment configuration/);
  });
});
