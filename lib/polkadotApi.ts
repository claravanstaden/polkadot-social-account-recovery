const CONNECTION_TIMEOUT = 10000; // 10 seconds

/**
 * Validate WSS URL format
 */
export function isValidWssUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === "ws:" || urlObj.protocol === "wss:";
  } catch {
    return false;
  }
}

/**
 * Test if a WSS URL is reachable by attempting a WebSocket connection
 */
export async function testConnection(wssUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(wssUrl);

      const timeout = setTimeout(() => {
        ws.close();
        resolve(false);
      }, CONNECTION_TIMEOUT);

      ws.onopen = () => {
        clearTimeout(timeout);
        ws.close();
        resolve(true);
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        ws.close();
        resolve(false);
      };
    } catch {
      resolve(false);
    }
  });
}
