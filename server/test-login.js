// test-login.js
// Yeh script EXACTLY wahi check karti hai jo /api/auth/login route karta hai —
// direct database se, bina frontend/browser/network ke beech mein aaye.
// Is se pakka pata chal jayega ke password sahi match hota hai ya nahi.
//
// Chalane ka tareeqa (isi server folder ke andar se):
//   node test-login.js

import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';

const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

const TEST_EMAIL = 'fazalpainthardware1@gmail.com';
const TEST_PASSWORD = '@Yfuf6555ryg';

async function test() {
  const normalizedEmail = TEST_EMAIL.trim().toLowerCase();
  const normalizedPassword = TEST_PASSWORD.trim();

  console.log('Testing with:');
  console.log('  Email:', JSON.stringify(normalizedEmail));
  console.log('  Password:', JSON.stringify(normalizedPassword));
  console.log('');

  const user = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(normalizedEmail);

  if (!user) {
    console.log('❌ RESULT: User is email se database mein NAHI mila.');
    db.close();
    return;
  }

  console.log('✅ User mil gaya:');
  console.log('  ID:', user.id);
  console.log('  Email in DB:', JSON.stringify(user.email));
  console.log('  Role:', user.role);
  console.log('  Stored hash:', user.password);
  console.log('');

  const matches = await bcrypt.compare(normalizedPassword, user.password);

  if (matches) {
    console.log('✅✅✅ RESULT: Password MATCH ho gaya! Login honi chahiye.');
    console.log('Agar phir bhi website par "Invalid" aa raha hai, to masla FRONTEND/NETWORK mein hai, database mein nahi.');
  } else {
    console.log('❌❌❌ RESULT: Password MATCH NAHI hua.');
    console.log('Iska matlab stored hash is exact password se nahi bana — dobara fix-admin-direct.js chalana hoga.');
  }

  db.close();
}

test();
