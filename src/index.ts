import 'dotenv/config';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import sql from './db';
import bcrypt from 'bcrypt';
import { z } from 'zod';

const app = new Hono();

// ================= TYPES =================
type User = { id: number; name: string; email: string; created_at: string };
type Address = { id: number; user_id: number; address_line: string | null; city: string | null; state: string | null; postal_code: string | null; country: string | null; created_at: string };

// ================= VALIDATION =================
const schemas = {
  userCreate: z.object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  }),
  addressCreate: z.object({
    address_line: z.string().min(5).max(200),
    city: z.string().min(2).max(50),
    state: z.string().min(2).max(50),
    postal_code: z.string().min(4).max(10),
    country: z.string().min(2).max(50)
  }),
  addressUpdate: z.object({
    address_line: z.string().min(5).max(200).optional(),
    city: z.string().min(2).max(50).optional(),
    state: z.string().min(2).max(50).optional(),
    postal_code: z.string().min(4).max(10).optional(),
    country: z.string().min(2).max(50).optional()
  }).passthrough()
};

// ================= 1️⃣ ADD ADDRESS =================
app.post('/users/:userId/addresses', async (c) => {
  const userId = Number(c.req.param('userId'));
  if (isNaN(userId) || userId <= 0) return c.json({ error: 'Invalid user ID' }, 400);
  
  const [user] = await sql`SELECT id FROM users WHERE id = ${userId}`;
  if (!user) return c.json({ error: 'User not found' }, 404);
  
  try {
    const body = schemas.addressCreate.parse(await c.req.json());
    const [address] = await sql`
      INSERT INTO addresses (user_id, address_line, city, state, postal_code, country)
      VALUES (${userId}, ${body.address_line}, ${body.city}, ${body.state}, ${body.postal_code}, ${body.country})
      RETURNING *
    `;
    return c.json(address, 201);
  } catch (e) {
    return c.json({ error: 'Invalid address data' }, 400);
  }
});

// ================= 2️⃣ GET ADDRESSES =================
app.get('/users/:userId/addresses', async (c) => {
  const userId = Number(c.req.param('userId'));
  if (isNaN(userId) || userId <= 0) return c.json({ error: 'Invalid user ID' }, 400);
  
  const [user] = await sql`SELECT id FROM users WHERE id = ${userId}`;
  if (!user) return c.json({ error: 'User not found' }, 404);
  
  const addresses = await sql`SELECT * FROM addresses WHERE user_id = ${userId} ORDER BY created_at DESC`;
  return c.json(addresses); // Empty array if none
});

// ================= 3️⃣ UPDATE ADDRESS =================
app.put('/users/:userId/addresses/:addressId', async (c) => {
  const userId = Number(c.req.param('userId'));
  const addressId = Number(c.req.param('addressId'));
  if (isNaN(userId) || isNaN(addressId)) return c.json({ error: 'Invalid ID' }, 400);
  
  // Verify ownership
  const [addr] = await sql`SELECT id FROM addresses WHERE id = ${addressId} AND user_id = ${userId}`;
  if (!addr) return c.json({ error: 'Address not found or does not belong to user' }, 404);
  
  try {
    const body = schemas.addressUpdate.parse(await c.req.json());
    const [updated] = await sql`
      UPDATE addresses SET
        address_line = COALESCE(NULLIF(${body.address_line}, ''), address_line),
        city = COALESCE(NULLIF(${body.city}, ''), city),
        state = COALESCE(NULLIF(${body.state}, ''), state),
        postal_code = COALESCE(NULLIF(${body.postal_code}, ''), postal_code),
        country = COALESCE(NULLIF(${body.country}, ''), country)
      WHERE id = ${addressId} AND user_id = ${userId}
      RETURNING *
    `;
    return c.json(updated);
  } catch (e) {
    return c.json({ error: 'Invalid update data' }, 400);
  }
});

// ================= 4️⃣ DELETE ADDRESS =================
app.delete('/users/:userId/addresses/:addressId', async (c) => {
  const userId = Number(c.req.param('userId'));
  const addressId = Number(c.req.param('addressId'));
  if (isNaN(userId) || isNaN(addressId)) return c.json({ error: 'Invalid ID' }, 400);
  
  const [deleted] = await sql`
    DELETE FROM addresses 
    WHERE id = ${addressId} AND user_id = ${userId} 
    RETURNING id
  `;
  if (!deleted) return c.json({ error: 'Address not found or does not belong to user' }, 404);
  return c.json({ message: 'Address deleted successfully' });
});

// ================= 5️⃣ COUNT ADDRESSES =================
app.get('/users/addresses/count', async (c) => {
  const counts = await sql`
    SELECT u.name, COUNT(a.id)::int as address_count
    FROM users u LEFT JOIN addresses a ON u.id = a.user_id
    GROUP BY u.id, u.name ORDER BY address_count DESC
  `;
  return c.json(counts);
});

// ================= 6️⃣ USERS WITHOUT ADDRESSES =================
app.get('/users/without-addresses', async (c) => {
  const users = await sql`
    SELECT u.name, 0::int as address_count
    FROM users u
    WHERE NOT EXISTS (SELECT 1 FROM addresses a WHERE a.user_id = u.id)
    ORDER BY u.created_at DESC
  `;
  return c.json(users);
});

// ================= BASIC USER ROUTES =================
app.post('/users', async (c) => {
  try {
    const body = schemas.userCreate.parse(await c.req.json());
    const passwordHash = await bcrypt.hash(body.password, 12);
    const [user] = await sql`
      INSERT INTO users (name, email, password_hash)
      VALUES (${body.name}, ${body.email}, ${passwordHash})
      RETURNING id, name, email, created_at
    `;
    return c.json(user, 201);
  } catch (e) {
    return c.json({ error: 'Invalid user data' }, 400);
  }
});

app.get('/users', async (c) => c.json(await sql`SELECT id, name, email, created_at FROM users ORDER BY id DESC`));

const port = Number(process.env.PORT) || 4000;
serve({ fetch: app.fetch, port });
console.log(`🚀 COMPLETE API on http://localhost:${port}`);
