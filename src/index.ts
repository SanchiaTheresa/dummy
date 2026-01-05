import 'dotenv/config';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import sql from './db';

type User = {
  id: number;
  name: string;
  email: string;
  created_at: string;
};

const app = new Hono();

app.get('/', (c) => c.json({ message: 'Hono + Neon API ready' }));


// 1. POST /users - CREATE
app.post('/users', async (c) => {
  const body = await c.req.json<{ name: string; email: string; password: string }>();
  
  try {
    const rows = await sql`
      INSERT INTO users (name, email, password)
      VALUES (${body.name}, ${body.email}, ${body.password})
      RETURNING id, name, email, created_at
    `;
    return c.json(rows[0], 201);
  } catch (err: any) {
    if (err.code === '23505') return c.json({ error: 'Email already exists' }, 409);
    return c.json({ error: 'Failed to create user' }, 500);
  }
});

// 2. GET /users - READ ALL
app.get('/users', async (c) => {
  const users = await sql`
    SELECT id, name, email, created_at FROM users ORDER BY id
  `;
  return c.json(users);
});

// 3. GET /users/:id - READ ONE
app.get('/users/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const rows = await sql`
    SELECT id, name, email, created_at FROM users WHERE id = ${id}
  `;
  if (rows.length === 0) return c.json({ error: 'User not found' }, 404);
  return c.json(rows[0]);
});

// 4. PUT /users/:id - UPDATE
app.put('/users/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json<{ name?: string; email?: string; password?: string }>();
  
  try {
    const rows = await sql`
      UPDATE users 
      SET 
        name = COALESCE(${body.name}, name),
        email = COALESCE(${body.email}, email),
        password = COALESCE(${body.password}, password)
      WHERE id = ${id}
      RETURNING id, name, email, created_at
    `;
    if (rows.length === 0) return c.json({ error: 'User not found' }, 404);
    return c.json(rows[0]);
  } catch (err: any) {
    if (err.code === '23505') return c.json({ error: 'Email already exists' }, 409);
    return c.json({ error: 'Failed to update user' }, 500);
  }
});

// 5. DELETE /users/:id - DELETE
app.delete('/users/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const rows = await sql`
    DELETE FROM users WHERE id = ${id} RETURNING id, name, email, created_at
  `;
  if (rows.length === 0) return c.json({ error: 'User not found' }, 404);
  return c.json({ message: 'User deleted successfully' });
});

const port = Number(process.env.PORT) || 3000;
serve({ fetch: app.fetch, port });
console.log(`🚀 Server running on http://localhost:${port}`);
