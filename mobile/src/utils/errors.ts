export function readError(error: unknown, fallback: string) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'data' in error.response
  ) {
    const data = error.response.data as { message?: string | string[] };
    if (Array.isArray(data.message)) return data.message.join(', ');
    if (data.message) return data.message;
  }

  return fallback;
}
