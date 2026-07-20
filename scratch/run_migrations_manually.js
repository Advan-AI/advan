const fs = require('fs');
const path = require('path');
const postgres = require('postgres');
require('dotenv').config();

const connectionString = "postgresql://postgres.hoqfpdphunaskywximth:%3FXDZQ_%2Bwf53S%23iH@aws-1-us-east-2.pooler.supabase.com:5432/postgres";
const sql = postgres(connectionString, { ssl: 'require', prepare: false });

const migrationsDir = path.join(__dirname, '../lib/db/migrations');

async function run() {
  try {
    // 0. Enable pgvector extension
    console.log("⚙️ Enabling pgvector extension...");
    try {
      await sql`CREATE EXTENSION IF NOT EXISTS vector;`;
      console.log("✅ pgvector extension is enabled!");
    } catch (err) {
      console.error("❌ Failed to enable pgvector extension:", err.message);
      process.exit(1);
    }

    // 1. Get all SQL files sorted alphabetically
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`Found ${files.length} migration files.`);

    // 2. Execute each file one by one
    for (const file of files) {
      console.log(`\n=========================================`);
      console.log(`⏳ Applying migration: ${file}`);
      console.log(`=========================================`);
      
      const filePath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(filePath, 'utf8');

      try {
        await sql.unsafe(sqlContent);
        console.log(`✅ Successfully applied: ${file}`);
      } catch (err) {
        console.error(`❌ FAILED applying: ${file}`);
        console.error("SQL Error Code:", err.code);
        console.error("SQL Error Message:", err.message);
        console.error("SQL Error Detail:", err.detail);
        process.exit(1);
      }
    }

    console.log("\n🎉 ALL MIGRATIONS COMPLETED SUCCESSFULLY!");
    process.exit(0);
  } catch (err) {
    console.error("General Migration Error:", err);
    process.exit(1);
  }
}

run();
