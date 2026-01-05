// import 'dotenv/config';
// import { neon } from '@neondatabase/serverless';

// if (!process.env.DATABASE_URL) {
//   throw new Error('DATABASE_URL missing! Check .env file');
// }

// const sql = neon(process.env.DATABASE_URL);
// export default sql;
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

console.log('DATABASE_URL loaded:', !!process.env.DATABASE_URL); // Debug line
const sql = neon(process.env.DATABASE_URL!);
export default sql;

