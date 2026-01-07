import 'dotenv/config';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import sql from './db';
import bcrypt from 'bcrypt';
import {user, address, addressUpdate} from './schemas.js';  

const app = new Hono();

//  ADD ADDRESS 
app.post('/users/:userId/addresses', async (c) => {
  const userId = Number(c.req.param('userId'));
  if (isNaN(userId) || userId <= 0) return c.json({ error: 'Invalid user ID' }, 400);
  
  const [userExists] = await sql`SELECT id FROM users WHERE id = ${userId}`;
  if (!userExists) return c.json({ error: 'User not found' }, 404);
  
  try {
    const body = address.parse(await c.req.json());  
    const [newAddress] = await sql`
      INSERT INTO addresses (user_id, address_line, city, state, postal_code, country)
      VALUES (${userId}, ${body.address_line}, ${body.city}, ${body.state}, ${body.postal_code}, ${body.country})
      RETURNING *
    `;
    return c.json(newAddress, 201);
  } catch (e) {
    return c.json({ error: 'Invalid address data' }, 400);
  }
});

// GET ADDRESSES
app.get('/users/:userId/addresses', async (c) => {
  const userId = Number(c.req.param('userId'));
  if (isNaN(userId) || userId <= 0) return c.json({ error: 'Invalid user ID' }, 400);
  
  const [userExists] = await sql`SELECT id FROM users WHERE id = ${userId}`;
  if (!userExists) return c.json({ error: 'User not found' }, 404);
  
  const addresses = await sql`SELECT * FROM addresses WHERE user_id = ${userId} ORDER BY created_at DESC`;
  return c.json(addresses);
});

//  UPDATE ADDRESS 
app.put('/users/:userId/addresses/:addressId', async (c) => {
  const userId = Number(c.req.param('userId'));
  const addressId = Number(c.req.param('addressId'));
  if (isNaN(userId) || isNaN(addressId)) return c.json({ error: 'Invalid ID' }, 400);
  
  const [addr] = await sql`SELECT id FROM addresses WHERE id = ${addressId} AND user_id = ${userId}`;
  if (!addr) return c.json({ error: 'Address not found or does not belong to user' }, 404);
  
  try {
    const body = addressUpdate.parse(await c.req.json());  
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

//  DELETE ADDRESS 
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

//  COUNT ADDRESSES 
app.get('/users/addresses/count', async (c) => {
  const counts = await sql`
    SELECT u.name, COUNT(a.id)::int as address_count
    FROM users u LEFT JOIN addresses a ON u.id = a.user_id
    GROUP BY u.id, u.name ORDER BY address_count DESC
  `;
  return c.json(counts);
});

// USERS WITHOUT ADDRESSES 
app.get('/users/without-addresses', async (c) => {
  const users = await sql`
    SELECT u.name, 0::int as address_count
    FROM users u
    WHERE NOT EXISTS (SELECT 1 FROM addresses a WHERE a.user_id = u.id)
    ORDER BY u.created_at DESC
  `;
  return c.json(users);
});

//  USER ROUTES 
app.post('/users', async (c) => {
  try {
    const body = user.parse(await c.req.json());  
    const passwordHash = await bcrypt.hash(body.password, 12);
    const [newUser] = await sql`
      INSERT INTO users (name, email, password_hash)
      VALUES (${body.name}, ${body.email}, ${passwordHash})
      RETURNING id, name, email, created_at
    `;
    return c.json(newUser, 201);
  } catch (e) {
    return c.json({ error: 'Invalid user data' }, 400);
  }
});

app.get('/users', async (c) => c.json(await sql`SELECT id, name, email, created_at FROM users ORDER BY id DESC`));

const port = Number(process.env.PORT) || 4000;
serve({ fetch: app.fetch, port });
console.log(`🚀 COMPLETE API on http://localhost:${port}`);
