import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'database.sqlite');
console.log('DB file:', dbPath);

const db = new Database(dbPath);

console.log('Pehle se users:', db.prepare('SELECT id, email, role, password FROM users').all());

const email = 'fazalpainthardware@gmail.com'; // apna login email yahan daalo
const password = '@Yfuf6555ryg';              // apna naya password yahan daalo

const hashed = bcrypt.hashSync(password, 10);

const result = db.prepare(`
  INSERT INTO users (email, password, role) VALUES (?, ?, 'admin')
  ON CONFLICT(email) DO UPDATE SET password = excluded.password, role = 'admin'
`).run(email.toLowerCase(), hashed);

console.log('Rows changed:', result.changes);
console.log('Ab users:', db.prepare('SELECT id, email, role, password FROM users').all());

db.close();