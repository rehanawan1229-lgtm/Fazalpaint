// fix-admin-direct.js
// Yeh script sirf "fazalpainthardware1@gmail.com" (ID 1) ka password
// directly set karti hai — koi .env dependency nahi, koi confusion nahi.
//
// Chalane ka tareeqa (server folder ke andar se, jahan database.sqlite hai):
//   node fix-admin-direct.js

import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';

const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

const TARGET_EMAIL = 'fazalpainthardware1@gmail.com';
const NEW_PASSWORD = '@Yfuf6555ryg';

async function run() {
  const user = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(TARGET_EMAIL);

  if (!user) {
    console.log(`❌ "${TARGET_EMAIL}" naam ka user database mein nahi mila.`);
    db.close();
    return;
  }

  console.log('Pehle:', { id: user.id, email: user.email, role: user.role, password: user.password });

  const hashed = await bcrypt.hash(NEW_PASSWORD, 10);
  db.prepare('UPDATE users SET password = ?, role = ? WHERE id = ?').run(hashed, 'admin', user.id);

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  console.log('Ab:', { id: updated.id, email: updated.email, role: updated.role, password: updated.password });

  console.log(`\n✅ Ho gaya. Ab is se login karein:`);
  console.log(`Email: ${TARGET_EMAIL}`);
  console.log(`Password: ${NEW_PASSWORD}`);

  db.close();
}

run();
