import type { Context, Next } from 'hono';

export const logger = async (c: Context, next: Next) => {
  const start = Date.now();
  const timestamp = new Date().toTimeString().slice(0, 8);
  const method = c.req.method;
  const url = new URL(c.req.url);
  const path = url.pathname;
  
  // Sanitize query params
  let queryParams = '';
  const params = url.searchParams;
  if (params.toString()) {
    const sanitized: string[] = [];
    for (const [key, value] of params) {
      sanitized.push(key + '=' + (key.includes('password') ? '[REDACTED]' : value));
    }
    queryParams = `?${sanitized.join('&')}`;
  }
  
  await next();
  
  const execTime = Date.now() - start;
  const status = c.res.status || 200;
  
  console.log(`[${timestamp}] ${method} ${path}${queryParams} ${status} ${execTime}ms`);
};
