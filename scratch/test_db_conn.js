const postgres = require('postgres');
require('dotenv').config();

// Use Supabase Session Pooler connection string
const connectionString = "postgresql://postgres.hoqfpdphunaskywximth:%3FXDZQ_%2Bwf53S%23iH@aws-1-us-east-2.pooler.supabase.com:5432/postgres";
console.log("Connecting to:", connectionString.replace(/:[^@]+@/, ":****@"));

const sql = postgres(connectionString, { ssl: 'require', prepare: false });

async function test() {
  try {
    const result = await sql`SELECT 1 as connected`;
    console.log("SUCCESS:", result);
    process.exit(0);
  } catch (err) {
    console.error("FAILED TO CONNECT:", err);
    process.exit(1);
  }
}

test();
