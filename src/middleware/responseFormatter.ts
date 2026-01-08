import type { Context, Next } from 'hono';

export const responseFormatter = async (c: Context, next: Next) => {
  await next();
  const data = c.get('responseData');
  if (data === undefined) return;
  
  const message = c.get('responseMessage') || 'Operation successful';
  return c.json({ success: true, data, message });
};
