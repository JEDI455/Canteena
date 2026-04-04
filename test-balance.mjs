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
  console.log('first profile:', data[0]);
  console.log('typeof balance:', typeof data[0].balance);
  console.log('typeof Number(balance):', typeof Number(data[0].balance));
  
  const currentBalance = data[0].balance;
  const amountStr = "50";
  const amount = Number(amountStr);
  
  console.log('Result of addition:', Number(currentBalance) + amount);
}
run();
