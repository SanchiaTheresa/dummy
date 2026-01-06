import 'dotenv/config';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import sql from './db';
import bcrypt from 'bcrypt';
import { z } from 'zod';

type User = {
  id: number;
  name: string;
  email: string;
  created_at: string;
};

const app = new Hono();

// ================= VALIDATION HELPERS (ALL ERRORS + PATTERNS) =================
async function validateUserCreate(body: any) {
  const schema = z.object({
    name: z.string().min(2, 'Name: min 2 chars').max(100, 'Name: max 100 chars'),
    email: z.string().email({
      message: 'Email: use format john@example.com'
    }),
    password: z.string().min(8, 'Password: min 8 chars').regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 
      'Password: 1 uppercase + 1 lowercase + 1 number (Abcdefg1)'
    )
  });
  
  const result = schema.safeParse(body);
  if (!result.success) {
    const errors = result.error.issues.map((e: any) => 
      `${e.path.join('.')} → ${e.message}`
    );
    throw { status: 400, message: errors.join(', ') };
  }
  return result.data;
}

async function validateUserUpdate(body: any) {
  const schema = z.object({
    name: z.string().min(2, 'Name: min 2 chars').max(100, 'Name: max 100 chars').optional(),
    email: z.string().email({
      message: 'Email: use format john@example.com'
    }).optional(),
    password: z.string().min(8, 'Password: min 8 chars').regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 
      'Password: 1 uppercase + 1 lowercase + 1 number (Abcdefg1)'
    ).optional()
  });
  
  const result = schema.safeParse(body);
  if (!result.success) {
    const errors = result.error.issues.map((e: any) => 
      `${e.path.join('.')} → ${e.message}`
    );
    throw { status: 400, message: errors.join(', ') };
  }
  return result.data;
}

async function validateLogin(body: any) {
  const schema = z.object({
    email: z.string().email('Email: john@example.com'),
    password: z.string().min(1, 'Password required')
  });
  
  const result = schema.safeParse(body);
  if (!result.success) {
    const errors = result.error.issues.map((e: any) => 
      `${e.path.join('.')} → ${e.message}`
    );
    throw { status: 400, message: errors.join(', ') };
  }
  return result.data;
}

// ================= ROUTES =================
app.get('/', (c) => c.json({ message: 'Hono + Neon API ready' }));

// 1. POST /users - CREATE
app.post('/users', async (c) => {
  try {
    const body = await validateUserCreate(await c.req.json());
    
    const passwordHash = await bcrypt.hash(body.password, 12);
    
    const rows = await sql`
      INSERT INTO users (name, email, password_hash)
      VALUES (${body.name}, ${body.email}, ${passwordHash})
      RETURNING id, name, email, created_at
    `;
    return c.json(rows[0], 201);
  } catch (err: any) {
    if (err.code === '23505') return c.json({ error: 'Email already exists' }, 409);
    if (err.status) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'Failed to create user' }, 500);
  }
});

// 2. GET /users - READ ALL
app.get('/users', async (c) => {
  const users = await sql`
    SELECT id, name, email, created_at FROM users ORDER BY id DESC
  `;
  return c.json(users);
});

// 3. GET /users/:id - READ ONE
app.get('/users/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (isNaN(id) || id <= 0) {
    return c.json({ error: 'Invalid user ID' }, 400);
  }
  
  const rows = await sql`
    SELECT id, name, email, created_at FROM users WHERE id = ${id}
  `;
  if (rows.length === 0) return c.json({ error: 'User not found' }, 404);
  return c.json(rows[0]);
});

// 4. PUT /users/:id - UPDATE
app.put('/users/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (isNaN(id) || id <= 0) {
    return c.json({ error: 'Invalid user ID' }, 400);
  }
  
  try {
    const body = await validateUserUpdate(await c.req.json());
    
    let passwordHash = body.password;
    if (body.password) {
      passwordHash = await bcrypt.hash(body.password, 12);
    }
    
    const rows = await sql`
      UPDATE users 
      SET 
        name = COALESCE(${body.name ?? null}, name),
        email = COALESCE(${body.email ?? null}, email),
        password_hash = COALESCE(${passwordHash ?? null}, password_hash)
      WHERE id = ${id}
      RETURNING id, name, email, created_at
    `;
    if (rows.length === 0) return c.json({ error: 'User not found' }, 404);
    return c.json(rows[0]);
  } catch (err: any) {
    if (err.code === '23505') return c.json({ error: 'Email already exists' }, 409);
    if (err.status) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'Failed to update user' }, 500);
  }
});

// 5. DELETE /users/:id - DELETE
app.delete('/users/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (isNaN(id) || id <= 0) {
    return c.json({ error: 'Invalid user ID' }, 400);
  }
  
  const rows = await sql`
    DELETE FROM users WHERE id = ${id} RETURNING id, name, email, created_at
  `;
  if (rows.length === 0) return c.json({ error: 'User not found' }, 404);
  return c.json({ message: 'User deleted successfully' });
});

// 6. POST /login
app.post('/login', async (c) => {
  try {
    const body = await validateLogin(await c.req.json());
    
    const rows = await sql`
      SELECT id, name, email, password_hash FROM users WHERE email = ${body.email}
    `;
    
    if (rows.length === 0) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }
    
    const user = rows[0];
    const valid = await bcrypt.compare(body.password, user.password_hash);
    
    if (!valid) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }
    
    return c.json({ 
      id: user.id, 
      name: user.name, 
      email: user.email,
      message: 'Login successful'
    });
  } catch (err: any) {
    if (err.status) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'Login failed' }, 500);
  }
});

// ================= START SERVER =================
const port = Number(process.env.PORT) || 3000;
serve({ fetch: app.fetch, port });
console.log(`🚀 Server running on http://localhost:${port}`);
