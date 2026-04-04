import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('profiles').select('*').limit(1);
  if (error) {
    console.error(error);
    return;
  }
  console.log(data);
  if (data.length > 0) {
    console.log('Balance type:', typeof data[0].balance);
    console.log('Is it an array?', Array.isArray(data[0].balance));
  }
}
run();
