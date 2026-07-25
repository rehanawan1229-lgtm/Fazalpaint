import Database from "better-sqlite3";
import path from "path";
const db = new Database(path.join(process.cwd(), "server", "database.sqlite"));
console.log(JSON.stringify(db.prepare('SELECT name FROM sqlite_master WHERE type="table" AND name="users"').get()));
console.log(JSON.stringify(db.prepare('SELECT name FROM sqlite_master WHERE type="table" AND name="social_links"').get()));
console.log(JSON.stringify(db.prepare('SELECT * FROM users LIMIT 5').all(), null, 2));
console.log(JSON.stringify(db.prepare('SELECT * FROM social_links').all(), null, 2));
