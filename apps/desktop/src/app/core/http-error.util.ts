/** Pulls a human-readable message out of a NestJS-shaped HttpErrorResponse, falling back to a generic one. */
export function extractErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'error' in error) {
    const body = (error as { error?: unknown }).error;
    if (body && typeof body === 'object' && 'message' in body) {
      const message = (body as { message?: unknown }).message;
      if (typeof message === 'string') return message;
      if (Array.isArray(message)) return message.join(', ');
    }
  }
  return 'Something went wrong. Please try again.';
}
