// delete-all-groups.js
// Yeh script "Group Collections" section ke SAARE groups delete karti hai
// (catalog_groups table — wahi jo Admin panel mein "Add Group" button se
// bante hain, jaise screenshot wala "hn" group).
//
// SAFE: sirf group ka NAAM/collection delete hota hai. Asal products
// (jo group mein add kiye the) database se BILKUL delete NAHI hote —
// wo Products page/catalog mein waise hi maujood rahenge, sirf unki
// "collection" grouping hat jayegi.
//
// NOTE: Yeh "Product Grouping" (Auto-Group Paint Products) wale alag
// feature ko touch nahi karti — sirf manual "Add Group" wale
// Group Collections delete hote hain.
//
// Chalane ka tareeqa (server folder ke andar se, jahan database.sqlite hai):
//   node delete-all-groups.js

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'database.sqlite');
console.log('DB file:', dbPath);

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

console.log('\nDelete se PEHLE groups:', db.prepare('SELECT id, name, brand FROM catalog_groups').all());

// foreign_keys = ON hone ki wajah se catalog_group_products (group ↔
// product links) automatically cascade-delete ho jayenge — products
// khud table se nahi hatenge.
const result = db.prepare('DELETE FROM catalog_groups').run();

// ID counter reset, taake agla naya group id=1 se shuru ho.
db.prepare(`DELETE FROM sqlite_sequence WHERE name = 'catalog_groups'`).run();

console.log(`\n✅ Total ${result.changes} group(s) delete ho gaye.`);
console.log('Delete ke BAAD groups:', db.prepare('SELECT id, name, brand FROM catalog_groups').all());
console.log('\nProducts table untouched hai — koi product delete nahi hua, sirf groupings.');

db.close();
