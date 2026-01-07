import { z } from 'zod';

export const user = 
 z.object({
  name: z.string().min(2, "Name too short").max(100),
  email: z.string().pipe(z.email("Invalid email")),
  password: z.string().min(8, "Password too short").regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Weak password")
});

  
export const address= z.object({
  address_line: z.string().min(5, "Address too short").max(200),
  city: z.string().min(2).max(50),
  state: z.string().min(2).max(50),
  postal_code: z.string().min(4).max(10),  
  country: z.string().min(2).max(50)
});

export const addressUpdate= z.object({
  address_line: z.string().min(5).max(200).optional(),
  city: z.string().min(2).max(50).optional(),
  state: z.string().min(2).max(50).optional(),
  postal_code: z.string().min(4).max(10).optional(),
  country: z.string().min(2).max(50).optional()
}) 


