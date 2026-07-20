const postgres = require('postgres');
require('dotenv').config();

const connectionString = "postgresql://postgres.hoqfpdphunaskywximth:%3FXDZQ_%2Bwf53S%23iH@aws-1-us-east-2.pooler.supabase.com:5432/postgres";
const sql = postgres(connectionString, { ssl: 'require', prepare: false });

async function run() {
  try {
    console.log("Adding 'image' column to 'users' table...");
    await sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "image" text;`;
    console.log("✅ Successfully added 'image' column to 'users' table!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Failed to add 'image' column:", err.message);
    process.exit(1);
  }
}

run();
