import 'dotenv/config';
import { Context, Hono } from 'hono';
import { serve } from '@hono/node-server';
import sql from './db';
import bcrypt from 'bcrypt';
import { user, address, addressUpdate } from './schemas';
import { responseFormatter } from './middleware/responseFormatter';
import type { ApiResponse } from './types';
import { logger } from './middleware/logger'; 
import{createUserWithAddresses} from './schemas';

const app = new Hono(); //why it is used

app.use('/*', logger); //why use,/* 
app.use('/*', responseFormatter);

const setResponse = (c:any, data: any, message?: string, status = 200) => { // js arrow function
  c.set('responseData', data);
  c.status(status);
  c.set('responseMessage', message || 'Operation successful');
  // Return formatted Response immediately
  if (status >= 400) {
    return c.json({ success: false, data: null, message }, status);
  }
  return c.json({ success: true, data, message }, status);
};

const greet = () => ``

app.post('/users', async (c) => {//what c,async
  try {
    const body = user.parse(await c.req.json()); //why using parse
    const passwordHash = await bcrypt.hash(body.password, 12); // why used
    
    const [newUser] = await sql`  
      INSERT INTO users (name, email, password_hash)
      VALUES (${body.name}, ${body.email}, ${passwordHash}) 
      RETURNING id, name, email, created_at
    `;//why $ {} ` is used
    
    setResponse(c, newUser, 'User created successfully', 201);  //why 201 and 200 what the difference 
  } catch (error: any) {
    c.set('responseMessage', error.message || 'Invalid user data');// why c.set and 
    c.status(400);
  }
});

app.get('/users', async (c) => {//learn about req and res
  try {
    const users = await sql`SELECT id, name, email, created_at FROM users ORDER BY id DESC`;
    setResponse(c, users);
  } catch {
    c.set('responseMessage', 'Failed to fetch users');
    c.status(500);  
  }
});

app.post('/users/:userId/addresses', async (c) => {//:userId and ?= used
  const userId = Number(c.req.param('userId'));
  if (isNaN(userId) || userId <= 0) {
  return setResponse(c, null, 'Invalid user ID', 400);//wht null used
  }
  
  const [userExists] = await sql`SELECT id FROM users WHERE id = ${userId}`;  //
if (!userExists) {
    return setResponse(c, null, 'User not found', 404);
  }
  
  try {
    const body = address.parse(await c.req.json());
    const [newAddress] = await sql`
      INSERT INTO addresses (user_id, address_line, city, state, postal_code, country)
      VALUES (${userId}, ${body.address_line}, ${body.city}, ${body.state}, ${body.postal_code}, ${body.country})
      RETURNING *
    `;
    
    setResponse(c, newAddress, 'Address created successfully', 201);
  } catch (error: any) {
    c.set('responseMessage', error.message || 'Invalid address data');  
    c.status(400);
  }
});

app.get('/users/:userId/addresses', async (c) => {
  const userId = Number(c.req.param('userId'));
  if (isNaN(userId) || userId <= 0) {
    c.set('responseMessage', 'Invalid user ID');
   c.status(400);
    return ;
  }
  
  const [userExists] = await sql`SELECT id FROM users WHERE id = ${userId}`;
  if (!userExists) {
    return setResponse(c, null, 'User not found', 404);
  }
  
  const addresses = await sql`SELECT * FROM addresses WHERE user_id = ${userId} ORDER BY created_at DESC`;
  setResponse(c, addresses);
});

app.put('/users/:userId/addresses/:addressId', async (c) => {
  const userId = Number(c.req.param('userId'));
  const addressId = Number(c.req.param('addressId'));
if (isNaN(userId) || userId <= 0) {
  return setResponse(c, null, 'Invalid user ID', 400);
  }
  
  const [addr] = await sql`SELECT id FROM addresses WHERE id = ${addressId} AND user_id = ${userId}`;
  if (!addr) {
    return setResponse(c, null, 'Address not found or does not belong to user', 404);
  }
  
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
    `;//SET ,COALESCE NULLIF, RETURNING *
    
    setResponse(c, updated);
  } catch (error: any) {
    c.set('responseMessage', error.message || 'Invalid update data');
    c.status(400);
  }
});

app.delete('/users/:userId/addresses/:addressId', async (c) => {
  const userId = Number(c.req.param('userId'));
  const addressId = Number(c.req.param('addressId'));
  if (isNaN(userId) || isNaN(addressId)) {
    return setResponse(c, null, 'Invalid ID', 400);  // Now returns properly
  }
  
  const [deleted] = await sql`
    DELETE FROM addresses 
    WHERE id = ${addressId} AND user_id = ${userId} 
    RETURNING id
  `;
  
  if (!deleted) {
    return setResponse(c, null, 'Address not found or does not belong to user', 404);
  }
  
 return setResponse(c, { message: 'Address deleted successfully' }, undefined, 200);
});

app.get('/users/addresses/count', async (c) => {
  const counts = await sql`
    SELECT u.name, COUNT(a.id)::int as address_count
    FROM users u LEFT JOIN addresses a ON u.id = a.user_id
    GROUP BY u.id, u.name ORDER BY address_count DESC
  `;//LEFT JOIN
  setResponse(c, counts);
});

app.get('/users/without-addresses', async (c) => {
  const users = await sql`
    SELECT u.name, 0::int as address_count
    FROM users u
    WHERE NOT EXISTS (SELECT 1 FROM addresses a WHERE a.user_id = u.id)
    ORDER BY u.created_at DESC
  `;
  setResponse(c, users);
});

app.post('/users/with-addresses', async (c) => {
  try {
    const body = createUserWithAddresses.parse(await c.req.json());
    const parsed = createUserWithAddresses.safeParse(body);
    if (!parsed.success) {
      return setResponse(c, null, parsed.error.message, 400);
    }
    
    const passwordHash = await bcrypt.hash(body.password, 12);
    
    await sql`BEGIN`; // why bwgin and why commit
    
    try {
      const [newUser] = await sql`
        INSERT INTO users (name, email, password_hash)
        VALUES (${body.name}, ${body.email}, ${passwordHash})
        RETURNING id, name, email, created_at
      `;
      
     const addresses = parsed.data.addresses || [];//what is this
      const createdAddresses = []; //const ,let ,var,[]
   
      
      for (const addr of addresses) { //what is this
        const [newAddr] = await sql`
          INSERT INTO addresses (user_id, address_line, city, state, postal_code, country)
          VALUES (${newUser.id}, ${addr.address_line}, ${addr.city}, ${addr.state}, ${addr.postal_code}, ${addr.country})
          RETURNING *
        `;
        createdAddresses.push(newAddr); 
      }
      
      await sql`COMMIT`; 
      
      return setResponse(c, {
        user: newUser,
        addresses: createdAddresses
      }, 'User and addresses created successfully', 201);
      
   } catch (dbError) {
      await sql`ROLLBACK`;//why rollback
      console.error('DB Error:', dbError);
      return setResponse(c, null, 'Database transaction failed', 500);
    }
    
  } catch (error) {
    console.error('Transaction Error:', error);
    return setResponse(c, null, 'Invalid request data', 400);
  }
});

const port = Number(process.env.PORT) || 4000;
serve({ fetch: app.fetch, port });
console.log(`Server running on http://localhost:${port}`); //
