import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

export async function seed() {
  const supabaseUrl = process.env.CYPRESS_SUPABASE_URL;
  const serviceKey = process.env.CYPRESS_SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('Supabase test credentials are not set in .env file.');
    throw new Error('Supabase test credentials not found.');
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  try {
    const schemaPath = path.join(__dirname, '../fixtures/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Resetting test database...');
    const { error } = await supabaseAdmin.rpc('run_sql', { sql: schemaSql });
    
    if (error) {
        console.error('Error during database reset:', error);
        throw error;
    }
    
    console.log('Test database reset successfully.');
    return null;

  } catch (err) {
    console.error('An unexpected error occurred during seeding:', err);
    throw err;
  }
}