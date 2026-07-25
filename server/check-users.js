// check-users.js
// Yeh script sirf CHECK karti hai — kuch change nahi karti.
// Isay apne "server" folder ke andar rakh kar chalayein:
//   node check-users.js

import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'database.sqlite');
// Agar aap root folder se chala rahe hain (server folder ke bahar se),
// to upar wali line ko is se replace karein:
// const dbPath = path.join(process.cwd(), 'server', 'database.sqlite');

const db = new Database(dbPath);

const users = db.prepare('SELECT id, email, role, password FROM users').all();

if (users.length === 0) {
  console.log('❌ Database mein KOI user nahi hai. Users table khali hai.');
} else {
  console.log(`✅ Total ${users.length} user(s) mile:\n`);
  users.forEach((u) => {
    const passwordType = String(u.password || '').startsWith('$2') ? 'bcrypt hash (hashed)' : 'PLAIN TEXT';
    console.log(`ID: ${u.id}`);
    console.log(`Email: ${u.email}`);
    console.log(`Role: ${u.role}`);
    console.log(`Password type: ${passwordType}`);
    console.log(`Password value: ${u.password}`);
    console.log('---');
  });
}

db.close();
