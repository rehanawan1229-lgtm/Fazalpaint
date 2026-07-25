// delete-all-users.js
// Yeh script "users" table ke SAARE rows delete karti hai — customers aur
// admin, dono. Chalane ke baad koi bhi login nahi kar sakega (admin ke
// bhi nahi) jab tak fix-admin.js ya fix-admin-direct.js dobara na chalao.
//
// Chalane ka tareeqa (server folder ke andar se, jahan database.sqlite hai):
//   node delete-all-users.js

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'database.sqlite');
console.log('DB file:', dbPath);

const db = new Database(dbPath);

console.log('Delete se PEHLE users:', db.prepare('SELECT id, email, role FROM users').all());

const result = db.prepare('DELETE FROM users').run();

// ID counter bhi reset kar dete hain, taake agla naya user id=1 se shuru ho
// (warna purana counter yaad rehta hai aur agla user id=17, 18... se shuru hoga)
db.prepare(`DELETE FROM sqlite_sequence WHERE name = 'users'`).run();

console.log(`\n✅ Total ${result.changes} users delete ho gaye.`);
console.log('Delete ke BAAD users:', db.prepare('SELECT id, email, role FROM users').all());

db.close();