const postgres = require('postgres');
require('dotenv').config();

const connectionString = "postgresql://postgres.hoqfpdphunaskywximth:%3FXDZQ_%2Bwf53S%23iH@aws-1-us-east-2.pooler.supabase.com:5432/postgres";
const sql = postgres(connectionString, { ssl: 'require', prepare: false });

async function check() {
  try {
    const columns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users';
    `;
    console.log("COLUMNS IN 'users' TABLE:");
    console.log(columns);
    process.exit(0);
  } catch (err) {
    console.error("Error fetching columns:", err);
    process.exit(1);
  }
}

check();
