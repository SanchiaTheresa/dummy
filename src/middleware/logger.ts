import type { Context, Next } from 'hono';

export const logger = async (c: Context, next: Next) => {
  // 1. ARRIVAL: Record when the request hits the server
  const startTime = Date.now();
  const timeLabel = new Date().toTimeString().slice(0, 8); // e.g., "14:20:01"
  
  const { method, url } = c.req;
  const { pathname, searchParams } = new URL(url);

  // 2. PRIVACY: Clean the URL query parameters
  let cleanQuery = '';
  if (searchParams.toString()) {
    const pieces: string[] = [];
    
    // Check every item in the URL (?name=John&password=123)
    searchParams.forEach((value, key) => {
      const isSensitive = key.toLowerCase().includes('password');
      const safeValue = isSensitive ? '[REDACTED]' : value;
      pieces.push(`${key}=${safeValue}`);
    });
    
    cleanQuery = `?${pieces.join('&')}`;
  }

  // 3. THE HANDOFF: Let the rest of the app do its work
  await next();

  // 4. SUMMARY: Calculate time and print the result
  const duration = Date.now() - startTime;
  const statusCode = c.res.status || 200;

  // Final Log: [Time] METHOD PATH STATUS DURATION
  console.log(`[${timeLabel}] ${method} ${pathname}${cleanQuery} ${statusCode} ${duration}ms`);
};