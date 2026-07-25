import express from 'express';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// FIX: previously this was just dotenv.config(), which only looks for a
// ".env" file in the CURRENT WORKING DIRECTORY (wherever "node ..." was
// run from). Rehan runs this file from inside the "server" folder, but the
// real .env lives one level up in the project root — so dotenv silently
// found nothing ("injected env (0) from .env"), and every SMTP/email
// variable came back empty. This now looks in both the script's own folder
// AND the parent folder, and loads whichever one actually has the file, so
// it works the same no matter which directory you run "node" from.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envCandidates = [
  path.join(__dirname, '.env'),
  path.join(__dirname, '..', '.env')
];
const envPath = envCandidates.find((candidate) => fs.existsSync(candidate));
if (envPath) {
  const result = dotenv.config({ path: envPath });
  const loadedCount = result.parsed ? Object.keys(result.parsed).length : 0;
  console.log(`Loaded .env from: ${envPath} (${loadedCount} variables)`);
} else {
  dotenv.config();
  console.warn('No .env file found next to send-order-server.js or in its parent folder. SMTP/email features will not work until one is added.');
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Handle invalid JSON bodies gracefully
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    // express.json parse error
    console.error('Invalid JSON received:', err.message);
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  return next(err);
});

const ordersFile = path.join(process.cwd(), 'orders.json');
const dbPath = path.join(process.cwd(), 'database.sqlite');
const publicDir = path.join(process.cwd(), 'public');
const uploadsDir = path.join(publicDir, 'uploads');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });

const smtpHost = (process.env.SMTP_HOST || '').trim();
const smtpUser = (process.env.SMTP_USER || '').trim();
const smtpPass = (process.env.SMTP_PASS || '').trim();
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpSecure = process.env.SMTP_SECURE === 'true';
const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '').trim();
const ADMIN_NOTIFICATION_EMAIL = (process.env.ADMIN_NOTIFICATION_EMAIL || 'fazalpainthardware@gmail.com').trim();

// Fixed destination for support-ticket / quotation-request notifications,
// per the shop owner's explicit request — separate from the general admin
// notification address above.
const WEBSITE_NOTIFICATION_EMAIL = 'fornotificationofwebsite@gmail.com';
const jwtSecret = process.env.JWT_SECRET || 'dev-admin-secret';

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
// Needed so the new catalog_group_products join table's ON DELETE CASCADE
// actually fires (SQLite ignores declared foreign keys unless this is set).
db.pragma('foreign_keys = ON');

// In-memory OTP store: phone -> { code, expiresAt }
const otpStore = new Map();

function normalizePhone(phone) {
  return String(phone || '').replace(/[^\d+]/g, '');
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// NEW: consistent password normalizer used everywhere a password is
// hashed or compared, so stray leading/trailing spaces (very common with
// mobile keyboards' autofill/autocapitalize) never cause a false mismatch.
function normalizePassword(password) {
  return String(password || '').trim();
}

function getOtpKey({ email, phone }) {
  if (email) {
    return `email:${normalizeEmail(email)}`;
  }
  if (phone) {
    return `phone:${normalizePhone(phone)}`;
  }
  return null;
}

// ==================== REGISTRATION / FORGOT-PASSWORD OTP STATE ====================
//
// Kept separate from the general-purpose `otpStore` above (which powers
// the existing phone/email OTP-login shortcut) so this stricter, 4-digit,
// "verify before the account/password change exists" flow can't interfere
// with it.
//
// pendingSignups: normalized email -> { name, email, passwordHash, code,
//   expiresAt, attempts } — the account is NOT created in the `users`
//   table until the 4-digit code is verified.
const pendingSignups = new Map();
// passwordResets: normalized email -> { code, expiresAt, attempts,
//   verified, resetToken, resetTokenExpiresAt } — a reset can only reach
//   the final "set new password" step after the code has been verified
//   and produced a short-lived resetToken, so the reset endpoint can't be
//   called directly with a guessed code.
const passwordResets = new Map();

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const RESET_TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_OTP_ATTEMPTS = 5;

// Strictly 4 digits, per the requirement — zero-padded so "0042" is valid
// (never silently becomes a 3-digit send/verify mismatch).
function generateFourDigitOtp() {
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
}

async function sendOtpEmail(email, code, { purpose, name }) {
  if (!hasSmtpConfigured() || !transporter) {
    // Dev fallback so the flow is fully testable without SMTP configured —
    // mirrors the existing /api/auth/send-otp behavior. This is NOT an
    // error — it's an intentional "SMTP isn't set up yet" path.
    console.log(`[DEV] ${purpose} OTP for ${email}: ${code}`);
    return { delivered: false, configured: false };
  }

  try {
    // Kept deliberately plain and personal — matching the style of this
    // project's other emails (order/admin notifications), which are plain
    // text and land in the inbox reliably. A large, colorful "your code is
    // XXXX" HTML block is a classic pattern spam filters are trained to
    // flag, especially the first few times a Gmail account emails a
    // brand-new recipient. Addressing the person by name (when we have it)
    // also reads less like a templated/bulk send.
    const greeting = name ? `Hi ${name},\n\n` : '';
    const info = await transporter.sendMail({
      from: `"Fazal Paint Hardware" <${process.env.SMTP_FROM || smtpUser || 'order@fazalpainthardware.com'}>`,
      to: email,
      replyTo: process.env.SMTP_FROM || smtpUser,
      subject: 'Your verification code',
      text: `${greeting}Your Fazal Paint Hardware verification code is: ${code}\n\nThis code expires in 5 minutes. If you did not request this, you can safely ignore this email.\n\n— Fazal Paint Hardware and Trolley House, Dera Ismail Khan`
    });
    // Log the message id / SMTP response so a delivered-but-not-received
    // report (e.g. landed in spam) can be traced in the mail provider logs.
    console.log(`OTP email sent to ${email} for ${purpose}: messageId=${info.messageId} response=${info.response}`);
    return { delivered: true, configured: true };
  } catch (err) {
    // THIS is the case that was previously swallowed: SMTP *was*
    // configured, an actual send was attempted, and it failed — but the
    // caller still told the user "code sent". Now we surface it instead.
    console.error(`Failed to send ${purpose} OTP email to ${email}:`, err);
    return { delivered: false, configured: true, error: err.message };
  }
}

async function notifyAdminAction(action, details) {
  const text = `Action: ${action}\nDate: ${new Date().toISOString()}\nName: ${details.name || 'N/A'}\nEmail: ${details.email || 'N/A'}\nPhone: ${details.phone || 'N/A'}\nRole: ${details.role || 'customer'}`;

  if (!hasSmtpConfigured() || !transporter) {
    console.log(`Admin notification not sent (SMTP not configured): ${action}`, details);
    return;
  }

  // Subject label: every login variant (password, OTP, Google, dev-Google)
  // and every signup variant collapse down to one consistent "User Login"
  // / "User Signup" label, always with the person's name in it (falling
  // back to email/phone only if no name is known). Anything else (e.g.
  // "User Password Reset") keeps its original subject text unchanged.
  const who = details.name || details.email || details.phone || 'unknown user';
  let subjectLabel = action;
  if (action.includes('Logged In')) {
    subjectLabel = 'User Login';
  } else if (action.includes('Signed Up')) {
    subjectLabel = 'User Sign Up';
  }

  // NAME FIX: Gmail shows the sender as "me" whenever the From address is
  // identical to the recipient address and the From header has no display
  // name. Wrapping the address as `"User Login" <email>` gives Gmail an
  // actual name to show in the inbox/thread list instead of falling back
  // to "me".
  const fromAddress = process.env.SMTP_FROM || smtpUser || 'order@fazalpainthardware.com';

  try {
    await transporter.sendMail({
      from: `"${subjectLabel}" <${fromAddress}>`,
      to: ADMIN_NOTIFICATION_EMAIL,
      subject: `${subjectLabel} — ${who}`,
      text
    });
  } catch (err) {
    console.error(`Failed to send admin notification (${action}):`, err);
  }
}

async function verifyGoogleIdToken(idToken) {
  if (!idToken) {
    throw new Error('Google ID token is required');
  }

  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!response.ok) {
    throw new Error('Invalid Google token');
  }

  const payload = await response.json();

  if (!payload.email_verified) {
    throw new Error('Google account not verified');
  }

  if (GOOGLE_CLIENT_ID) {
    if (String(payload.aud) !== GOOGLE_CLIENT_ID) {
      throw new Error('Google token audience does not match server configuration');
    }
  } else {
    console.warn('GOOGLE_CLIENT_ID not configured on server — skipping audience check (development only)');
  }

  return payload;
}

// Emails the fixed WEBSITE_NOTIFICATION_EMAIL address whenever a customer
// submits a support/complaint ticket or a custom quotation request, per the
// shop owner's request — kept separate from notifyAdminAction (which goes
// to ADMIN_NOTIFICATION_EMAIL and is used for login/signup style events).
async function notifyWebsiteEmail(subject, text) {
  if (!hasSmtpConfigured() || !transporter) {
    console.log(`Website notification not sent (SMTP not configured): ${subject}`);
    return;
  }
  const fromAddress = process.env.SMTP_FROM || smtpUser || 'order@fazalpainthardware.com';
  try {
    await sendMailWithRetry({
      from: `"Fazal Paint Hardware Website" <${fromAddress}>`,
      to: WEBSITE_NOTIFICATION_EMAIL,
      subject,
      text
    });
  } catch (err) {
    console.error(`Failed to send website notification (${subject}):`, err);
  }
}

async function notifyAdminOfSignup(newUser) {
  if (!hasSmtpConfigured() || !transporter) {
    console.log('New signup (SMTP not configured, not emailed):', newUser);
    return;
  }
  const to = process.env.SHOP_ORDER_EMAIL || process.env.VITE_SHOP_ORDER_EMAIL || smtpUser;
  const text = `New account sign up on the website\n\nName: ${newUser.name || 'N/A'}\nEmail: ${newUser.email || 'N/A'}\nPhone: ${newUser.phone || 'N/A'}\nSigned up via: ${newUser.signupMode || 'email'}\nDate: ${new Date().toISOString()}`;
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || smtpUser || 'order@fazalpainthardware.com',
      to,
      subject: `New sign up: ${newUser.name || newUser.email || newUser.phone}`,
      text
    });
  } catch (err) {
    console.error('Failed to email admin about new signup:', err);
  }
}

function hasSmtpConfigured() {
  if (!smtpHost || !smtpUser || !smtpPass) return false;
  const badHosts = ['smtp.example.com', 'localhost', '127.0.0.1', '::1', ''];
  if (badHosts.includes(smtpHost.toLowerCase())) return false;
  return true;
}

function createTransporter() {
  if (!hasSmtpConfigured()) return null;

  const hostLower = smtpHost.toLowerCase();
  const transportOptions = {
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass
    },
    // Reuse connections instead of opening a brand-new SMTP connection for
    // every single email — under quick repeated submissions (e.g. a
    // customer submitting a few support tickets/bulk orders back to back)
    // this was the likely cause of some notification emails silently
    // failing to send while others went through.
    pool: true,
    maxConnections: 3,
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 20000
  };

  if (hostLower.includes('office365') || hostLower.includes('outlook') || smtpUser.toLowerCase().endsWith('@outlook.com') || smtpUser.toLowerCase().endsWith('@hotmail.com') || smtpUser.toLowerCase().endsWith('@live.com')) {
    transportOptions.port = transportOptions.port || 587;
    transportOptions.secure = false;
    transportOptions.tls = { ciphers: 'TLSv1.2' };
  }

  return nodemailer.createTransport(transportOptions);
}

const transporter = createTransporter();

// Wraps transporter.sendMail with a couple of retries — a single dropped
// SMTP connection (common with Gmail under quick repeated sends) used to
// mean the notification email for that one submission just never arrived,
// with nothing else different about it from the ones that did go through.
async function sendMailWithRetry(mailOptions, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await transporter.sendMail(mailOptions);
      return true;
    } catch (err) {
      lastError = err;
      if (attempt < attempts) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
      }
    }
  }
  throw lastError;
}

function initDatabase() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer'
    )
  `).run();

  // MIGRATION: add "name" for databases created before the OTP-verified
  // registration flow existed. Existing rows simply get NULL — harmless,
  // since login only ever depended on email/password.
  const existingUserColumns = db.prepare('PRAGMA table_info(users)').all().map((col) => col.name);
  if (!existingUserColumns.includes('name')) {
    console.log('Migrating users table: adding missing column "name"');
    db.prepare('ALTER TABLE users ADD COLUMN name TEXT').run();
  }

  db.prepare(`
    CREATE TABLE IF NOT EXISTS site_content (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT NOT NULL
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      brand TEXT,
      category TEXT,
      sub_category TEXT,
      price REAL NOT NULL,
      description TEXT,
      image_url TEXT,
      in_stock INTEGER NOT NULL DEFAULT 1,
      packaging TEXT,
      color_code TEXT,
      color_name TEXT,
      swatch_hex TEXT,
      parent_product_id INTEGER,
      created_at TEXT NOT NULL
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS product_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER UNIQUE NOT NULL,
      brand TEXT,
      product_line TEXT,
      image_url TEXT,
      created_at TEXT NOT NULL
    )
  `).run();

  // NOTE: "product_groups" above is the existing *auto-group* feature — it
  // links Quarter/Gallon/Drum variants of the same paint line by pointing
  // their parent_product_id at one real product row. It is unrelated to the
  // feature below.
  //
  // "catalog_groups" is the new *manual* Product Grouping feature: an admin
  // explicitly creates a named collection (name, description, photo, brand)
  // via "Add Group", then files arbitrary selected products into it via
  // "Add to Group". A group can hold any mix of products regardless of
  // packaging/variant relationships, and a product can belong to more than
  // one group (hence the separate join table rather than a single column on
  // products).
  db.prepare(`
    CREATE TABLE IF NOT EXISTS catalog_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      image_url TEXT,
      brand TEXT,
      created_at TEXT NOT NULL
    )
  `).run();

  // MIGRATION: a group can now have more than one photo. image_urls stores
  // the full list as JSON; image_url (above) is kept in sync as
  // image_urls[0] so every place that already reads the single image_url
  // field (admin group list thumbnails, the public collections strip)
  // keeps working unchanged.
  const existingCatalogGroupColumns = db.prepare("PRAGMA table_info(catalog_groups)").all().map((col) => col.name);
  if (!existingCatalogGroupColumns.includes('image_urls')) {
    console.log('Migrating catalog_groups table: adding missing column "image_urls"');
    db.prepare('ALTER TABLE catalog_groups ADD COLUMN image_urls TEXT').run();
  }

  db.prepare(`
    CREATE TABLE IF NOT EXISTS catalog_group_products (
      group_id INTEGER NOT NULL REFERENCES catalog_groups(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      added_at TEXT NOT NULL,
      PRIMARY KEY (group_id, product_id)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      customer_email TEXT,
      customer_phone TEXT NOT NULL,
      shipping_address TEXT,
      shipping_city TEXT,
      shipping_state TEXT,
      shipping_postal TEXT,
      payment_method TEXT NOT NULL,
      items_json TEXT NOT NULL,
      total REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending',
      ivr_call_sid TEXT,
      ivr_status TEXT,
      whatsapp_sent INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();

  // MIGRATION: add IVR/WhatsApp tracking columns for databases created
  // before automated order confirmation existed.
  const existingOrderColumns = db.prepare('PRAGMA table_info(orders)').all().map((col) => col.name);
  for (const col of ['ivr_call_sid', 'ivr_status', 'whatsapp_sent']) {
    if (!existingOrderColumns.includes(col)) {
      console.log(`Migrating orders table: adding missing column "${col}"`);
      const definition = col === 'whatsapp_sent' ? 'INTEGER NOT NULL DEFAULT 0' : 'TEXT';
      db.prepare(`ALTER TABLE orders ADD COLUMN ${col} ${definition}`).run();
    }
  }

  // MIGRATION: "unread dot" feature for AdminOrders — adds
  // viewed_by_admin (0 = new/unread, 1 = admin has opened it). Every order
  // that already existed before this migration runs is immediately marked
  // viewed_by_admin = 1, so upgrading never floods the admin panel by
  // marking hundreds of old orders as "new" — only orders placed AFTER
  // this migration (via the normal INSERT, which relies on the column
  // default of 0) start out unread.
  if (!existingOrderColumns.includes('viewed_by_admin')) {
    console.log('Migrating orders table: adding missing column "viewed_by_admin"');
    db.prepare('ALTER TABLE orders ADD COLUMN viewed_by_admin INTEGER NOT NULL DEFAULT 0').run();
    db.prepare('UPDATE orders SET viewed_by_admin = 1').run();
  }

  // MIGRATION: links an order to the logged-in customer who placed it (if
  // any), so customers can see "my orders" / order history. Orders placed
  // as a guest (not logged in) simply have user_id = NULL, same as before.
  if (!existingOrderColumns.includes('user_id')) {
    console.log('Migrating orders table: adding missing column "user_id"');
    db.prepare('ALTER TABLE orders ADD COLUMN user_id INTEGER REFERENCES users(id)').run();
  }

  // NEW: account-benefit features (order history/reorder, saved addresses,
  // wishlist, invoice history, support tickets, custom quotation requests).
  // All of these are additive — nothing above this point was changed.
  db.prepare(`
    CREATE TABLE IF NOT EXISTS addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      label TEXT,
      full_name TEXT,
      phone TEXT,
      address TEXT NOT NULL,
      city TEXT,
      state TEXT,
      postal_code TEXT,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS wishlist (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      added_at TEXT NOT NULL,
      PRIMARY KEY (user_id, product_id)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      order_invoice_number TEXT,
      status TEXT NOT NULL DEFAULT 'Open',
      admin_reply TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();

  // MIGRATION: "Complaint" vs "Suggestion" — the customer picks one when
  // filing a support request, and it changes what the admin notification
  // email is titled ("New Complaint" / "New Suggestion").
  const existingSupportTicketColumns = db.prepare('PRAGMA table_info(support_tickets)').all().map((col) => col.name);
  if (!existingSupportTicketColumns.includes('type')) {
    console.log('Migrating support_tickets table: adding missing column "type"');
    db.prepare("ALTER TABLE support_tickets ADD COLUMN type TEXT NOT NULL DEFAULT 'complaint'").run();
  }
  // MIGRATION: tracks whether the admin has opened this ticket yet, shown
  // to the admin as "Pending" vs "Received" — independent of the ticket's
  // own Open/Closed status.
  if (!existingSupportTicketColumns.includes('viewed_by_admin')) {
    console.log('Migrating support_tickets table: adding missing column "viewed_by_admin"');
    db.prepare('ALTER TABLE support_tickets ADD COLUMN viewed_by_admin INTEGER NOT NULL DEFAULT 0').run();
  }

  db.prepare(`
    CREATE TABLE IF NOT EXISTS quotation_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      details TEXT NOT NULL,
      quantity_estimate TEXT,
      status TEXT NOT NULL DEFAULT 'Pending',
      admin_quote TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();

  // MIGRATION: tracks whether the admin has opened this "Bulk Order"
  // request yet — shown to the admin as "Pending" vs "Received".
  const existingQuotationColumns = db.prepare('PRAGMA table_info(quotation_requests)').all().map((col) => col.name);
  if (!existingQuotationColumns.includes('viewed_by_admin')) {
    console.log('Migrating quotation_requests table: adding missing column "viewed_by_admin"');
    db.prepare('ALTER TABLE quotation_requests ADD COLUMN viewed_by_admin INTEGER NOT NULL DEFAULT 0').run();
  }

  // MIGRATION: default payment method saved on the customer's profile
  // ("saved payment / preferred contact info" benefit).
  if (!existingUserColumns.includes('default_payment_method')) {
    console.log('Migrating users table: adding missing column "default_payment_method"');
    db.prepare('ALTER TABLE users ADD COLUMN default_payment_method TEXT').run();
  }

  db.prepare(`
    CREATE TABLE IF NOT EXISTS social_links (
      platform TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      visible INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    )
  `).run();

  // MIGRATION: add "visible" to social_links for databases created before
  // the admin show/hide toggle existed.
  const existingSocialColumns = db.prepare('PRAGMA table_info(social_links)').all().map((col) => col.name);
  if (!existingSocialColumns.includes('visible')) {
    console.log('Migrating social_links table: adding missing column "visible"');
    db.prepare('ALTER TABLE social_links ADD COLUMN visible INTEGER NOT NULL DEFAULT 1').run();
  }

  // MIGRATION: earlier versions seeded a "Youtube" (capitalized) row and/or
  // a "pinterest" row. Normalize to lowercase "youtube" and drop pinterest
  // now that the footer shows YouTube instead of Pinterest, without losing
  // any URL an admin may have already saved.
  const legacyYoutube = db.prepare('SELECT url, visible FROM social_links WHERE platform = ?').get('Youtube');
  if (legacyYoutube) {
    db.prepare(`
      INSERT INTO social_links (platform, url, visible, updated_at)
      VALUES ('youtube', ?, ?, ?)
      ON CONFLICT(platform) DO NOTHING
    `).run(legacyYoutube.url, legacyYoutube.visible, new Date().toISOString());
    db.prepare('DELETE FROM social_links WHERE platform = ?').run('Youtube');
  }
  db.prepare('DELETE FROM social_links WHERE platform = ?').run('pinterest');

  // MIGRATION: "CREATE TABLE IF NOT EXISTS" above only creates the table the
  // very first time. If the products table already existed from an older
  // version of this file (before columns like sub_category/packaging/etc.
  // were added), those new columns never get added automatically — SQLite
  // needs an explicit ALTER TABLE for that. This checks the table's actual
  // columns and adds any that are missing, so old databases stay compatible
  // with new code without ever needing to delete the .sqlite file.
  const requiredProductColumns = {
    sub_category: 'TEXT',
    packaging: 'TEXT',
    color_code: 'TEXT',
    color_name: 'TEXT',
    swatch_hex: 'TEXT',
    parent_product_id: 'INTEGER',
    // Broad grouping (Emulsion / Enamel / Weather Coat / General) set by
    // the admin when adding a product. sub_category stays the specific,
    // brand-curated product line (e.g. "Royal Matt Emulsion"); line_group
    // is the coarser bucket used to power the Product Line filter when the
    // customer is browsing "All" brands together, where showing every
    // brand's specific line names at once would be a huge, messy list.
    line_group: 'TEXT'
  };
  const existingProductColumns = db.prepare('PRAGMA table_info(products)').all().map((col) => col.name);
  for (const [columnName, columnType] of Object.entries(requiredProductColumns)) {
    if (!existingProductColumns.includes(columnName)) {
      console.log(`Migrating products table: adding missing column "${columnName}"`);
      db.prepare(`ALTER TABLE products ADD COLUMN ${columnName} ${columnType}`).run();
    }
  }

  // NOTE: this only INSERTs if the admin row doesn't already exist (INSERT OR

  // IGNORE). It will NOT overwrite an existing admin password. If you ever
  // need to reset the admin password again, update ADMIN_PASSWORD in .env and
  // manually UPDATE the row (see notes below about fix-admin.js) — this
  // seed step alone won't do it once the row already exists.
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  db.prepare(`
    INSERT OR IGNORE INTO users (email, password, role) VALUES (?, ?, ?)
  `).run(adminEmail, adminPassword, 'admin');

  // Initialize default social links
  const defaultSocials = [
    { platform: 'instagram', url: 'https://instagram.com' },
    { platform: 'facebook', url: 'https://facebook.com' },
    { platform: 'tiktok', url: 'https://tiktok.com' },
    { platform: 'youtube', url: 'https://youtube.com' }
  ];
  
  defaultSocials.forEach(({ platform, url }) => {
    db.prepare(`
      INSERT OR IGNORE INTO social_links (platform, url, visible, updated_at)
      VALUES (?, ?, 1, ?)
    `).run(platform, url, new Date().toISOString());
  });
}

function saveOrder(order) {
  let orders = [];
  if (fs.existsSync(ordersFile)) {
    try {
      orders = JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
    } catch {
      orders = [];
    }
  }

  orders.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...order,
    createdAt: new Date().toISOString()
  });

  fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2));
}

function formatOrderEmail(order) {
  const billingAddress = order.customer.billingSameAsShipping
    ? order.customer.shippingAddress
    : order.customer.billingAddress;

  const itemsText = order.items
    .map((item, index) => {
      // Show packaging (Quarter/Gallon/Drum/etc.) and color so identical
      // product names (e.g. six "Master Synthetic Enamel" rows that are
      // really six different sizes/colors) are distinguishable in the email.
      // .filter(Boolean) means any field that's missing is just skipped —
      // never prints as the literal word "undefined".
      const specs = [item.packaging, item.colorCode, item.colorName].filter(Boolean).join(', ');
      return `${index + 1}. ${item.name}${specs ? ` (${specs})` : ''} x ${item.quantity}`;
    })
    .join('\n');

  return `New order received\n\nOrder date: ${order.orderDate}\n\nCustomer details:\nName: ${order.customer.fullName}\nEmail: ${order.customer.email}\nPhone: ${order.customer.phone}\n\nShipping address:\n${order.customer.shippingAddress}\n${order.customer.shippingCity}, ${order.customer.shippingState} ${order.customer.shippingPostal}\n\nBilling address:\n${billingAddress}\n\nPayment method: ${order.customer.paymentMethod}\n\nOrder notes:\n${order.customer.orderNotes || 'None'}\n\nItems:\n${itemsText}\n\nSubtotal: ${order.total}\n`;
}

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    req.user = jwt.verify(token, jwtSecret);
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  return next();
}

// Like `authenticate`, but never rejects the request — used on routes that
// work for guests too (like placing an order) but should silently link the
// order to req.user when a logged-in customer happens to be placing it.
function authenticateOptional(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token) {
    try {
      req.user = jwt.verify(token, jwtSecret);
    } catch (err) {
      // ignore invalid/expired token — treat as guest
    }
  }
  return next();
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeName = (file.originalname || 'image').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-');
    cb(null, `${timestamp}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, and WEBP images are allowed'));
    }
    cb(null, true);
  }
});

initDatabase();

app.use('/uploads', express.static(uploadsDir));
app.use(express.static(publicDir));

app.post('/send-order', async (req, res) => {
  const order = req.body;
  try {
    saveOrder(order);

    if (!hasSmtpConfigured() || !transporter) {
      console.log('No SMTP configured; order saved locally:', order.customer?.fullName);
      return res.json({ message: 'Order received and saved locally. Configure SMTP to send email.' });
    }

    const mailOptions = {
      // NAME FIX: same reasoning as notifyAdminAction — a display name in
      // the From header ("Order Received") is what makes Gmail show that
      // instead of "me" when the shop emails itself.
      from: `"Order Received" <${process.env.SMTP_FROM || smtpUser || 'order@fazalpainthardware.com'}>`,
      to: process.env.SHOP_ORDER_EMAIL || process.env.VITE_SHOP_ORDER_EMAIL || 'fazalpainthardware1@outlook.com',
      subject: `${order.customer.fullName} order received`,
      text: formatOrderEmail(order)
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log('Order email sent:', info.messageId || info);
      return res.json({ message: 'Order sent', info });
    } catch (emailErr) {
      console.error('SMTP send failed, order saved locally:', emailErr);
      return res.json({ message: 'Order received and saved locally. SMTP delivery failed.', error: (emailErr && emailErr.message) || String(emailErr) });
    }
  } catch (err) {
    console.error('Error processing order:', err);
    return res.status(500).json({ error: err.message || 'Failed to process order' });
  }
});

app.post('/test-email', async (req, res) => {
  const { to: requestedTo, subject = 'Test email from order server', text = 'This is a test email to verify SMTP configuration.' } = req.body || {};
  const recipient = requestedTo || process.env.SHOP_ORDER_EMAIL || process.env.VITE_SHOP_ORDER_EMAIL || smtpUser;

  if (hasSmtpConfigured() && transporter) {
    try {
      await transporter.verify();
      const testMail = {
        from: process.env.SMTP_FROM || smtpUser || 'order@fazalpainthardware.com',
        to: recipient,
        subject,
        text
      };
      const info = await transporter.sendMail(testMail);
      return res.json({ message: 'Test email sent via configured SMTP', info });
    } catch (err) {
      console.error('SMTP test email failed:', err);
    }
  }

  try {
    const testAccount = await nodemailer.createTestAccount();
    const ethTransport = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });

    const info = await ethTransport.sendMail({
      from: process.env.SMTP_FROM || testAccount.user,
      to: recipient,
      subject,
      text
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || null;
    return res.json({ message: 'Test email sent via Ethereal (preview)', info, previewUrl });
  } catch (err) {
    console.error('Ethereal test email failed:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

app.post('/api/auth/send-otp', async (req, res) => {
  const { email, phone } = req.body || {};
  const key = getOtpKey({ email, phone });
  if (!key) {
    return res.status(400).json({ error: 'Email or phone number is required for OTP' });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  otpStore.set(key, { code, expiresAt: Date.now() + 5 * 60 * 1000 });

  // Prefer email delivery when email provided and SMTP configured
  if (email && hasSmtpConfigured() && transporter) {
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || smtpUser || 'order@fazalpainthardware.com',
        to: email,
        subject: 'Your verification code',
        text: `Your verification code is ${code}. It expires in 5 minutes.`
      });
      return res.json({ message: 'OTP sent via email.' });
    } catch (err) {
      console.error('Failed to send OTP email, falling back to console:', err);
    }
  }

  // If no SMTP or email not provided, log the OTP for development/phone delivery
  console.log(`OTP for ${key}: ${code}`);
  return res.json({ message: 'OTP sent. Please check your device.', devCode: process.env.NODE_ENV !== 'production' ? code : undefined });
});

app.post('/api/auth/verify-otp', (req, res) => {
  const { email, phone, code } = req.body || {};
  const key = getOtpKey({ email, phone });
  if (!key) {
    return res.status(400).json({ verified: false, error: 'Email or phone number is required to verify OTP.' });
  }

  const record = otpStore.get(key);
  if (!record || record.expiresAt < Date.now()) {
    return res.status(400).json({ verified: false, error: 'OTP expired or not found. Please request a new one.' });
  }

  if (String(code).trim() !== record.code) {
    return res.status(400).json({ verified: false, error: 'Incorrect OTP code.' });
  }

  otpStore.delete(key);
  return res.json({ verified: true });
});

// OTP-based login: verify OTP and issue JWT, creating user if needed
app.post('/api/auth/otp-login', async (req, res) => {
  const { email, phone, code } = req.body || {};
  const key = getOtpKey({ email, phone });
  if (!key) {
    return res.status(400).json({ error: 'Email or phone number is required for OTP login' });
  }

  const record = otpStore.get(key);
  if (!record || record.expiresAt < Date.now()) {
    return res.status(400).json({ error: 'OTP expired or not found. Please request a new one.' });
  }

  if (String(code).trim() !== record.code) {
    return res.status(400).json({ error: 'Incorrect OTP code.' });
  }

  // Valid OTP, remove it
  otpStore.delete(key);

  // Derive an account email for phone-only users
  const accountEmail = normalizeEmail(email || `${normalizePhone(phone)}@phone.fazalpainthardware.local`);

  try {
    let user = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(accountEmail);
    if (!user) {
      const generatedPassword = Math.random().toString(36).slice(2, 12);
      const hashed = await bcrypt.hash(generatedPassword, 10);
      const result = db.prepare('INSERT INTO users (email, password, role) VALUES (?, ?, ?)').run(accountEmail, hashed, 'customer');
      user = { id: result.lastInsertRowid, email: accountEmail, role: 'customer' };
      await notifyAdminAction('New User Signed Up via OTP', { name: '', email: accountEmail, phone, role: 'customer' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, jwtSecret, { expiresIn: '8h' });
    await notifyAdminAction('User Logged In via OTP', { name: user.name || '', email: user.email, phone, role: user.role });
    return res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    console.error('OTP login failed:', err);
    return res.status(500).json({ error: 'OTP login failed' });
  }
});

app.post('/api/auth/signup', async (req, res) => {
  const { name, email, phone, password, signupMode } = req.body || {};

  if (signupMode === 'number' && !phone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }
  if (signupMode !== 'number' && !email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const accountEmail = normalizeEmail(email || `${normalizePhone(phone)}@phone.fazalpainthardware.local`);
  // FIX: trim the user-supplied password before hashing so a stray
  // leading/trailing space typed (or auto-inserted by a mobile keyboard)
  // never gets baked into the stored hash.
  const accountPassword = password
    ? normalizePassword(password)
    : Math.random().toString(36).slice(2, 10);

  try {
    const existing = db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(accountEmail);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists. Please log in instead.' });
    }

    const hashed = await bcrypt.hash(accountPassword, 10);
    const result = db.prepare(`
      INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'customer')
    `).run(name || null, accountEmail, hashed);

    const token = jwt.sign({ userId: result.lastInsertRowid, email: accountEmail, role: 'customer' }, jwtSecret, { expiresIn: '8h' });
    await notifyAdminAction('New User Signed Up', { name, email: accountEmail, phone, role: 'customer' });

    return res.status(201).json({
      token,
      user: { id: result.lastInsertRowid, email: accountEmail, role: 'customer' }
    });
  } catch (err) {
    console.error('Signup failed:', err);
    return res.status(500).json({ error: 'Unable to create account. Please try again.' });
  }
});

// ==================== OTP-VERIFIED REGISTRATION (4-digit) ====================
//
// Step 1: /register/start — validate + stash the signup in memory, email a
//         4-digit code. The account is NOT written to the `users` table
//         yet, so an unverified signup can never be used to log in.
// Step 2: /register/verify — strict server-side match of the 4-digit code.
//         Only on success is the row actually inserted into `users`.
// Both steps have a matching /resend endpoint.

app.post('/api/auth/register/start', async (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }
  if (!email || !String(email).trim()) {
    return res.status(400).json({ error: 'Email is required' });
  }
  const normalizedPassword = normalizePassword(password);
  if (normalizedPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const normalizedEmail = normalizeEmail(email);

  try {
    const existing = db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(normalizedEmail);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists. Please log in instead.' });
    }

    const code = generateFourDigitOtp();
    const passwordHash = await bcrypt.hash(normalizedPassword, 10);
    pendingSignups.set(normalizedEmail, {
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash,
      code,
      expiresAt: Date.now() + OTP_TTL_MS,
      attempts: 0
    });

    const emailResult = await sendOtpEmail(normalizedEmail, code, { purpose: 'signup', name: String(name).trim() });
    if (emailResult.configured && !emailResult.delivered) {
      // SMTP is set up but the actual send failed — don't lie and say it
      // was sent. The pending signup + code still exist, so Resend will
      // work once the SMTP issue is fixed.
      return res.status(502).json({ error: `Could not send the email (${emailResult.error || 'SMTP error'}). Please try again in a moment, or contact the shop.` });
    }
    return res.json({ message: 'Verification code sent to your email.' });
  } catch (err) {
    console.error('register/start failed:', err);
    return res.status(500).json({ error: 'Unable to start registration. Please try again.' });
  }
});

app.post('/api/auth/register/resend', async (req, res) => {
  const { email } = req.body || {};
  const normalizedEmail = normalizeEmail(email);
  const pending = pendingSignups.get(normalizedEmail);

  if (!pending) {
    return res.status(404).json({ error: 'No pending signup found for this email. Please start sign up again.' });
  }

  const code = generateFourDigitOtp();
  pending.code = code;
  pending.expiresAt = Date.now() + OTP_TTL_MS;
  pending.attempts = 0;
  pendingSignups.set(normalizedEmail, pending);

  const emailResult = await sendOtpEmail(normalizedEmail, code, { purpose: 'signup resend', name: pending.name });
  if (emailResult.configured && !emailResult.delivered) {
    return res.status(502).json({ error: `Could not send the email (${emailResult.error || 'SMTP error'}). Please try again in a moment, or contact the shop.` });
  }
  return res.json({ message: 'A new code has been sent to your email.' });
});

app.post('/api/auth/register/verify', async (req, res) => {
  const { email, code } = req.body || {};
  const normalizedEmail = normalizeEmail(email);
  const pending = pendingSignups.get(normalizedEmail);

  if (!pending) {
    return res.status(404).json({ error: 'No pending signup found for this email. Please start sign up again.' });
  }
  if (pending.expiresAt < Date.now()) {
    pendingSignups.delete(normalizedEmail);
    return res.status(400).json({ error: 'This code has expired. Please request a new one.' });
  }
  if (pending.attempts >= MAX_OTP_ATTEMPTS) {
    pendingSignups.delete(normalizedEmail);
    return res.status(429).json({ error: 'Too many incorrect attempts. Please start sign up again.' });
  }

  // Strict, exact string match — the whole point of the requirement.
  if (String(code || '').trim() !== pending.code) {
    pending.attempts += 1;
    return res.status(400).json({ error: 'Incorrect code. Please check your email and try again.' });
  }

  try {
    // Someone could have registered the same email in the few minutes this
    // signup was pending — re-check right before the actual insert.
    const existing = db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(normalizedEmail);
    if (existing) {
      pendingSignups.delete(normalizedEmail);
      return res.status(409).json({ error: 'An account with this email already exists. Please log in instead.' });
    }

    const result = db.prepare(`
      INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'customer')
    `).run(pending.name, normalizedEmail, pending.passwordHash);

    pendingSignups.delete(normalizedEmail);

    const user = { id: result.lastInsertRowid, name: pending.name, email: normalizedEmail, role: 'customer' };
    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, jwtSecret, { expiresIn: '8h' });
    await notifyAdminAction('New User Signed Up (verified)', { name: user.name, email: user.email, role: 'customer' });

    return res.status(201).json({ token, user });
  } catch (err) {
    console.error('register/verify failed:', err);
    return res.status(500).json({ error: 'Unable to complete registration. Please try again.' });
  }
});

// ==================== FORGOT PASSWORD (4-digit OTP) ====================

app.post('/api/auth/forgot-password/start', async (req, res) => {
  const { email } = req.body || {};
  if (!email || !String(email).trim()) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const normalizedEmail = normalizeEmail(email);

  try {
    const user = db.prepare('SELECT id, name FROM users WHERE lower(email) = lower(?)').get(normalizedEmail);
    if (!user) {
      // Exact wording requested: stop the flow here, don't send anything.
      return res.status(404).json({ error: 'Email is not registered' });
    }

    const code = generateFourDigitOtp();
    passwordResets.set(normalizedEmail, {
      code,
      expiresAt: Date.now() + OTP_TTL_MS,
      attempts: 0,
      verified: false,
      resetToken: null,
      resetTokenExpiresAt: null
    });

    const emailResult = await sendOtpEmail(normalizedEmail, code, { purpose: 'password reset', name: user.name });
    if (emailResult.configured && !emailResult.delivered) {
      return res.status(502).json({ error: `Could not send the email (${emailResult.error || 'SMTP error'}). Please try again in a moment, or contact the shop.` });
    }
    return res.json({ message: 'Verification code sent to your email.' });
  } catch (err) {
    console.error('forgot-password/start failed:', err);
    return res.status(500).json({ error: 'Unable to process request. Please try again.' });
  }
});

app.post('/api/auth/forgot-password/resend', async (req, res) => {
  const { email } = req.body || {};
  const normalizedEmail = normalizeEmail(email);
  const pending = passwordResets.get(normalizedEmail);

  if (!pending) {
    return res.status(404).json({ error: 'No password reset in progress for this email. Please start again.' });
  }

  const code = generateFourDigitOtp();
  pending.code = code;
  pending.expiresAt = Date.now() + OTP_TTL_MS;
  pending.attempts = 0;
  pending.verified = false;
  pending.resetToken = null;
  passwordResets.set(normalizedEmail, pending);

  const user = db.prepare('SELECT name FROM users WHERE lower(email) = lower(?)').get(normalizedEmail);
  const emailResult = await sendOtpEmail(normalizedEmail, code, { purpose: 'password reset resend', name: user?.name });
  if (emailResult.configured && !emailResult.delivered) {
    return res.status(502).json({ error: `Could not send the email (${emailResult.error || 'SMTP error'}). Please try again in a moment, or contact the shop.` });
  }
  return res.json({ message: 'A new code has been sent to your email.' });
});

app.post('/api/auth/forgot-password/verify', (req, res) => {
  const { email, code } = req.body || {};
  const normalizedEmail = normalizeEmail(email);
  const pending = passwordResets.get(normalizedEmail);

  if (!pending) {
    return res.status(404).json({ error: 'No password reset in progress for this email. Please start again.' });
  }
  if (pending.expiresAt < Date.now()) {
    passwordResets.delete(normalizedEmail);
    return res.status(400).json({ error: 'This code has expired. Please request a new one.' });
  }
  if (pending.attempts >= MAX_OTP_ATTEMPTS) {
    passwordResets.delete(normalizedEmail);
    return res.status(429).json({ error: 'Too many incorrect attempts. Please start again.' });
  }

  if (String(code || '').trim() !== pending.code) {
    pending.attempts += 1;
    return res.status(400).json({ error: 'Incorrect code. Please check your email and try again.' });
  }

  // Code correct — mint a short-lived, one-time reset token so the final
  // "set new password" step can't be reached by anyone who doesn't have
  // this exact response (i.e. can't be replayed with just the old code).
  const resetToken = crypto.randomBytes(24).toString('hex');
  pending.verified = true;
  pending.resetToken = resetToken;
  pending.resetTokenExpiresAt = Date.now() + RESET_TOKEN_TTL_MS;
  passwordResets.set(normalizedEmail, pending);

  return res.json({ verified: true, resetToken });
});

app.post('/api/auth/forgot-password/reset', async (req, res) => {
  const { email, resetToken, newPassword } = req.body || {};
  const normalizedEmail = normalizeEmail(email);
  const pending = passwordResets.get(normalizedEmail);
  const normalizedNewPassword = normalizePassword(newPassword);

  if (normalizedNewPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  if (!pending || !pending.verified || pending.resetToken !== resetToken) {
    return res.status(400).json({ error: 'Reset session is invalid. Please verify your code again.' });
  }
  if (!pending.resetTokenExpiresAt || pending.resetTokenExpiresAt < Date.now()) {
    passwordResets.delete(normalizedEmail);
    return res.status(400).json({ error: 'Reset session expired. Please start again.' });
  }

  try {
    const user = db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(normalizedEmail);
    if (!user) {
      passwordResets.delete(normalizedEmail);
      return res.status(404).json({ error: 'Email is not registered' });
    }

    const hashed = await bcrypt.hash(normalizedNewPassword, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, user.id);
    passwordResets.delete(normalizedEmail);

    await notifyAdminAction('User Password Reset', { email: normalizedEmail });
    return res.json({ message: 'Password reset successful. You can now log in with your new password.' });
  } catch (err) {
    console.error('forgot-password/reset failed:', err);
    return res.status(500).json({ error: 'Unable to reset password. Please try again.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // FIX: normalize both email and password the exact same way every time —
  // this is the single source of truth for what "the password" is, used
  // for bcrypt.compare, the legacy plaintext comparison, and the
  // plaintext -> hash migration below. No more silent mismatches from
  // stray spaces.
  const normalizedEmail = normalizeEmail(email);
  const normalizedPassword = normalizePassword(password);

  console.log('LOGIN REQUEST', { email: normalizedEmail });

  try {
    const user = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(normalizedEmail);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    let passwordMatches = false;

    if (typeof user.password === 'string' && user.password.startsWith('$2')) {
      passwordMatches = await bcrypt.compare(normalizedPassword, user.password);
    } else {
      passwordMatches = normalizedPassword === String(user.password || '').trim();
      if (passwordMatches) {
        try {
          const newHash = await bcrypt.hash(normalizedPassword, 10);
          db.prepare('UPDATE users SET password = ? WHERE id = ?').run(newHash, user.id);
        } catch (e) {
          console.error('Failed to migrate plaintext password to hash for user', user.id, e);
        }
      }
    }

    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, jwtSecret, { expiresIn: '8h' });
    await notifyAdminAction('User Logged In', { name: user.name || '', email: user.email, role: user.role });
    return res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Login route error:', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

app.post('/api/auth/google', async (req, res) => {
  const { idToken, token } = req.body || {};
  const credentialToken = idToken || token;

  if (!credentialToken) {
    return res.status(400).json({ error: 'Google credential token is required.' });
  }

  try {
    const payload = await verifyGoogleIdToken(credentialToken);
    const email = normalizeEmail(payload.email);
    const name = payload.name || '';

    let user = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(email);
    if (!user) {
      const generatedPassword = Math.random().toString(36).slice(2, 12);
      const hashed = await bcrypt.hash(generatedPassword, 10);
      const result = db.prepare(`
        INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'customer')
      `).run(name || null, email, hashed);
      user = { id: result.lastInsertRowid, name, email, role: 'customer' };
      await notifyAdminAction('New User Signed Up via Google', { name, email, role: 'customer' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, jwtSecret, { expiresIn: '8h' });
    await notifyAdminAction('User Logged In via Google', { name, email, role: user.role });
    return res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Google auth failed:', err);
    return res.status(400).json({ error: err.message || 'Google authentication failed' });
  }
});

app.get('/api/auth/me', authenticate, (req, res) => {
  return res.json({ user: req.user });
});

// Development-only: simulate Google sign-in without real Google tokens
if (process.env.NODE_ENV !== 'production') {
  app.post('/api/auth/dev-google', async (req, res) => {
    const { email, name } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email is required for dev Google sign-in' });

    const accountEmail = normalizeEmail(email);
    try {
      let user = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(accountEmail);
      if (!user) {
        const generatedPassword = Math.random().toString(36).slice(2, 12);
        const hashed = await bcrypt.hash(generatedPassword, 10);
        const result = db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run(name || null, accountEmail, hashed, 'customer');
        user = { id: result.lastInsertRowid, name: name || null, email: accountEmail, role: 'customer' };
        await notifyAdminAction('New User Signed Up via Dev Google', { name: name || '', email: accountEmail, role: 'customer' });
      }

      const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, jwtSecret, { expiresIn: '8h' });
      await notifyAdminAction('User Logged In via Dev Google', { name: name || '', email: user.email, role: user.role });
      return res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
    } catch (err) {
      console.error('Dev Google sign-in failed:', err);
      return res.status(500).json({ error: 'Dev Google sign-in failed' });
    }
  });
}

app.get('/api/content', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM site_content ORDER BY key').all();
  const payload = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return res.json(payload);
});

app.put('/api/admin/content', authenticate, requireAdmin, (req, res) => {
  const { key, value } = req.body || {};
  if (!key) {
    return res.status(400).json({ error: 'A content key is required' });
  }

  const updatedAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO site_content (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, value ?? '', updatedAt);

  return res.json({ message: 'Content updated', key, value: value ?? '' });
});

// ==================== CATEGORY VISIBILITY (Paint / Hardware show-hide) ====================
//
// Lets the admin hide an entire top-level department (Paint, Hardware, or
// Paint Additives) from the public storefront without touching any product data at all —
// every product row, price, image, and stock flag stays exactly as it is
// in the database. Hiding just flips a settings flag; unhiding brings
// everything straight back, instantly, with nothing to "recover". Stored
// as a single JSON blob in the existing site_content key/value table
// (key = 'category_visibility') rather than a new table, since this is
// just a couple of on/off flags, not per-product data.
function getCategoryVisibilityMap() {
  const row = db.prepare('SELECT value FROM site_content WHERE key = ?').get('category_visibility');
  if (!row || !row.value) return {};
  try {
    const parsed = JSON.parse(row.value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveCategoryVisibilityMap(map) {
  db.prepare(`
    INSERT INTO site_content (key, value, updated_at)
    VALUES ('category_visibility', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(JSON.stringify(map), new Date().toISOString());
}

// A category with no entry in the map (never toggled) defaults to visible,
// so this never accidentally hides anything for shops that haven't touched
// this feature yet.
function isCategoryHidden(category, visibilityMap) {
  return Boolean(category) && visibilityMap[category] === false;
}

function getCategoryVisibilityPayload() {
  const map = getCategoryVisibilityMap();
  const categories = Array.from(new Set(['Paint', 'Hardware', 'Paint Additives', ...Object.keys(map)]));
  const payload = {};
  categories.forEach((category) => {
    payload[category] = map[category] !== false;
  });
  return payload;
}

// Public: which departments are currently visible — powers the category
// pill row on the customer-facing Products page (a hidden department's
// pill disappears entirely, it doesn't just show an empty list).
app.get('/api/category-visibility', (req, res) => {
  return res.json(getCategoryVisibilityPayload());
});

// Admin: same shape as above, behind auth — powers the eye/eye-off toggle
// in the admin product manager.
app.get('/api/admin/category-visibility', authenticate, requireAdmin, (req, res) => {
  return res.json(getCategoryVisibilityPayload());
});

// Admin: show/hide a whole department. Only ever flips the settings flag
// above — no product row is touched, so unhiding always brings every
// product in that category back exactly as it was.
app.put('/api/admin/category-visibility', authenticate, requireAdmin, (req, res) => {
  const { category, visible } = req.body || {};
  if (!category || typeof visible !== 'boolean') {
    return res.status(400).json({ error: 'category and visible (boolean) are required' });
  }
  const map = getCategoryVisibilityMap();
  map[category] = visible;
  saveCategoryVisibilityMap(map);
  return res.json({ message: 'Category visibility updated', category, visible });
});

// ==================== CATEGORY ORDER (Paint / Hardware / Paint Additives display order) ====================
//
// Lets the admin change the order departments appear in — the storefront's
// category pill row on Products.jsx, and this same Category Visibility
// panel — independent of the show/hide flags above. Stored the same way,
// as a single JSON blob in site_content (key = 'category_order'): a plain
// array of category names in display order.
const DEFAULT_CATEGORY_ORDER = ['Paint', 'Hardware', 'Paint Additives'];

function getCategoryOrderList() {
  const row = db.prepare('SELECT value FROM site_content WHERE key = ?').get('category_order');
  let stored = [];
  if (row && row.value) {
    try {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed)) stored = parsed;
    } catch {
      stored = [];
    }
  }
  // Keep only names we actually know about, then append any known category
  // that isn't in the stored order yet (e.g. this feature was never used,
  // or a category was added after the last reorder) — so nothing ever
  // silently drops out of the row.
  const known = Array.from(new Set([...DEFAULT_CATEGORY_ORDER, ...stored]));
  const ordered = stored.filter((category) => known.includes(category));
  known.forEach((category) => {
    if (!ordered.includes(category)) ordered.push(category);
  });
  return ordered;
}

function saveCategoryOrderList(order) {
  db.prepare(`
    INSERT INTO site_content (key, value, updated_at)
    VALUES ('category_order', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(JSON.stringify(order), new Date().toISOString());
}

// Public: display order for the category pill row on the customer-facing
// Products page.
app.get('/api/category-order', (req, res) => {
  return res.json({ order: getCategoryOrderList() });
});

// Admin: same list, behind auth — powers the up/down reorder controls in
// the admin product manager.
app.get('/api/admin/category-order', authenticate, requireAdmin, (req, res) => {
  return res.json({ order: getCategoryOrderList() });
});

// Admin: replace the whole order in one call — the admin UI sends the full
// reordered array after each up/down move.
app.put('/api/admin/category-order', authenticate, requireAdmin, (req, res) => {
  const { order } = req.body || {};
  if (!Array.isArray(order) || order.length === 0 || order.some((category) => typeof category !== 'string')) {
    return res.status(400).json({ error: 'order (array of category names) is required' });
  }
  saveCategoryOrderList(order);
  return res.json({ message: 'Category order updated', order });
});

app.get('/api/products', (req, res) => {
  // is_out_of_stock is derived from the existing in_stock column at read time
  // (never stored) so the two can never drift out of sync — see the
  // "MANUAL PRODUCT GROUPS" section below for why we didn't add a second
  // stored column instead.
  const rows = db.prepare(`
    SELECT *, (CASE WHEN in_stock = 1 THEN 0 ELSE 1 END) AS is_out_of_stock
    FROM products
    ORDER BY created_at DESC, id DESC
  `).all();

  // Storefront pages (Products/Home/ProductDetail) opt into "group
  // inheritance": a product that belongs to a manually-curated Group
  // Collection displays that group's name/photo/description/brand instead
  // of its own — even if the product has no photo of its own, the group's
  // photo is shown. This is requested via ?inherit=1 so the admin product
  // editor (which calls this same endpoint with no params) keeps seeing
  // each product's real, unoverridden values to edit.
  if (req.query.inherit === '1') {
    // Same ?inherit=1 flag also marks this as a storefront request, so this
    // is also where a whole hidden department (Paint/Hardware) gets dropped
    // for regular customers — the admin editor above still sees everything.
    const visibilityMap = getCategoryVisibilityMap();
    const visibleRows = rows.filter((product) => !isCategoryHidden(product.category, visibilityMap));

    const groupMemberships = db.prepare(`
      SELECT cgp.product_id, cg.name AS group_name, cg.description AS group_description,
             cg.image_url AS group_image_url, cg.brand AS group_brand
      FROM catalog_group_products cgp
      INNER JOIN catalog_groups cg ON cg.id = cgp.group_id
    `).all();
    const overrideByProductId = new Map();
    groupMemberships.forEach((row) => overrideByProductId.set(row.product_id, row));

    const withInheritance = visibleRows.map((product) => {
      const override = overrideByProductId.get(product.id);
      if (!override) return product;
      return {
        ...product,
        name: override.group_name || product.name,
        description: override.group_description || product.description,
        image_url: override.group_image_url || product.image_url,
        brand: override.group_brand || product.brand
      };
    });
    return res.json(withInheritance);
  }

  return res.json(rows);
});

app.post('/api/admin/products', authenticate, requireAdmin, (req, res) => {
  const {
    name, brand, category, sub_category, price, description, image_url, in_stock,
    packaging, color_code, color_name, swatch_hex, parent_product_id, line_group
  } = req.body || {};
  
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'Product name is required' });
  }
  const priceValue = Number(price);
  if (!Number.isFinite(priceValue)) {
    return res.status(400).json({ error: 'Price must be a valid number' });
  }

  const createdAt = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO products (name, brand, category, sub_category, price, description, image_url, in_stock, packaging, color_code, color_name, swatch_hex, parent_product_id, line_group, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    String(name).trim(),
    brand || '',
    category || '',
    sub_category || '',
    priceValue,
    description || '',
    image_url || '',
    in_stock ? 1 : 0,
    packaging || '',
    color_code || '',
    color_name || '',
    swatch_hex || '',
    parent_product_id || null,
    line_group || '',
    createdAt
  );

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
  return res.status(201).json(product);
});

app.put('/api/admin/products/:id', authenticate, requireAdmin, (req, res) => {
  const { id } = req.params;
  const {
    name, brand, category, sub_category, price, description, image_url, in_stock,
    packaging, color_code, color_name, swatch_hex, line_group
  } = req.body || {};
  
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'Product name is required' });
  }
  const priceValue = Number(price);
  if (!Number.isFinite(priceValue)) {
    return res.status(400).json({ error: 'Price must be a valid number' });
  }

  const result = db.prepare(`
    UPDATE products
    SET name = ?, brand = ?, category = ?, sub_category = ?, price = ?, description = ?, image_url = ?, in_stock = ?, packaging = ?, color_code = ?, color_name = ?, swatch_hex = ?, line_group = ?
    WHERE id = ?
  `).run(
    String(name).trim(),
    brand || '',
    category || '',
    sub_category || '',
    priceValue,
    description || '',
    image_url || '',
    in_stock ? 1 : 0,
    packaging || '',
    color_code || '',
    color_name || '',
    swatch_hex || '',
    line_group || '',
    id
  );

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  return res.json(product);
});

app.delete('/api/admin/products/:id', authenticate, requireAdmin, (req, res) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM products WHERE id = ?').run(id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Product not found' });
  }
  return res.json({ message: 'Product deleted' });
});

app.post('/api/admin/upload', authenticate, requireAdmin, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const publicUrl = `/uploads/${path.basename(req.file.filename)}`;
    return res.json({ url: publicUrl, filename: req.file.filename });
  });
});

// ==================== AI SHOP ASSISTANT API ====================
//
// Powers the "Ask Fazal" chat widget. Always grounds its answer in the
// REAL, current products table (never invents stock status), so "is X in
// stock?" is always accurate as of the moment it's asked.
//
// Two modes, chosen automatically:
//  1. If ANTHROPIC_API_KEY is set in .env, every question is answered by
//     Claude, given a compact summary of the live catalog as context — this
//     is the fully "intelligent" free-text mode.
//  2. If no key is set, a dependency-free rule-based responder still
//     answers greetings, shop-info questions (timings/location/phone/
//     delivery), and stock/availability questions with real matches +
//     in-stock alternatives. The widget works out of the box either way;
//     adding a key just makes it smarter and more conversational.

function loadAssistantCatalog() {
  return db.prepare(`
    SELECT name, brand, category, sub_category, packaging, color_name, price, in_stock
    FROM products
    ORDER BY created_at DESC
    LIMIT 600
  `).all();
}

function formatPriceForAssistant(price) {
  if (price === null || price === undefined) return 'Call for price';
  return `Rs ${Math.round(price).toLocaleString('en-PK')}`;
}

function catalogToPromptText(products) {
  return products
    .map((product) => {
      const line = [product.brand, product.sub_category || product.category, product.color_name, product.packaging]
        .filter(Boolean)
        .join(' / ');
      const stock = product.in_stock ? 'IN STOCK' : 'OUT OF STOCK';
      return `- ${product.name} (${line}) — ${formatPriceForAssistant(product.price)} — ${stock}`;
    })
    .join('\n');
}

const SHOP_FACTS = `Shop: Fazal Paint Hardware and Trolley House, Bannu Road, Opposite Kotli Imam Hussain, Dera Ismail Khan, Pakistan (est. 1982).
Hours: Monday to Sunday, 6am to 6pm.
Phone / WhatsApp: +92 342 9085556.
Brands carried: Master Paint, Berger Paint, Choice Paint, plus general hardware, tools, fittings, and trolleys across four floors.`;

const GREETING_PATTERN = /^(hi|hello|hey|salam|assalam|as-salam|aoa|slam|hy|hii+)\b/i;
const FAQ_PATTERNS = [
  { pattern: /(timing|time|hour|khul|band\b)/i, reply: `Hum Monday se Sunday, subah 6 baje se sham 6 baje tak khule rehte hain. 🕕` },
  { pattern: /(location|address|kahan|kidhar|pata)/i, reply: `Hamari location Bannu Road, Opposite Kotli Imam Hussain, Dera Ismail Khan hai. 📍` },
  { pattern: /(phone|number|whatsapp|contact|rabta|call)/i, reply: `Aap hume +92 342 9085556 par call ya WhatsApp kar sakte hain. 📞` },
  { pattern: /(deliver|delivery|bhejna|ghar tak)/i, reply: `Ji, hum D.I. Khan ke andar delivery aur pickup dono offer karte hain — order confirm hone ke baad shop se contact hoga. 🚚` },
  { pattern: /(brand|company|kaunsi paint|which paint)/i, reply: `Hum Master Paint, Berger Paint, aur Choice Paint rakhte hain, sath general hardware, tools aur trolleys bhi. 🎨` }
];

function normalizeText(value) {
  return (value || '').toString().toLowerCase().trim();
}

function scoreProductAgainstQuery(product, queryWords) {
  const haystack = normalizeText(
    [product.name, product.brand, product.category, product.sub_category, product.color_name, product.packaging].join(' ')
  );
  let score = 0;
  for (const word of queryWords) {
    if (word.length < 3) continue;
    if (haystack.includes(word)) score += 1;
  }
  return score;
}

// Dependency-free fallback used when no ANTHROPIC_API_KEY is configured —
// still genuinely useful for the most common questions (stock checks,
// shop info) rather than a generic "I don't understand".
function answerWithRules(message, products) {
  const clean = normalizeText(message);

  if (GREETING_PATTERN.test(clean)) {
    return `Assalam-o-Alaikum! Main Fazal Paint Hardware ka assistant hoon. Aap mujhse kisi bhi product ka stock, price, ya shop ki details pooch sakte hain — masalan "Master Enamel gallon available hai?" 😊`;
  }

  for (const faq of FAQ_PATTERNS) {
    if (faq.pattern.test(clean)) return faq.reply;
  }

  const queryWords = clean.split(/\s+/).filter(Boolean);
  const scored = products
    .map((product) => ({ product, score: scoreProductAgainstQuery(product, queryWords) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (scored.length === 0) {
    return `Mujhe is query se koi matching product nahi mila. Aap product ka naam, brand (Master/Berger/Choice), ya category bata kar dobara try karein — ya phir "Products" page par pura catalog dekh sakte hain. 🙂`;
  }

  const inStockMatches = scored.filter((entry) => entry.product.in_stock);
  const outOfStockMatches = scored.filter((entry) => !entry.product.in_stock);

  let reply = '';
  if (inStockMatches.length > 0) {
    reply += `Ye mila stock mein ✅:\n`;
    reply += inStockMatches
      .map((entry) => `• ${entry.product.name} (${entry.product.brand || 'General'}) — ${formatPriceForAssistant(entry.product.price)}`)
      .join('\n');
  }
  if (outOfStockMatches.length > 0) {
    if (reply) reply += '\n\n';
    reply += `Ye filhal out of stock hai ❌:\n`;
    reply += outOfStockMatches.map((entry) => `• ${entry.product.name} (${entry.product.brand || 'General'})`).join('\n');

    // Suggest an in-stock alternative from the same sub-category/category.
    const outCategories = new Set(outOfStockMatches.map((entry) => entry.product.sub_category || entry.product.category));
    const alternatives = products.filter(
      (product) => product.in_stock && outCategories.has(product.sub_category || product.category)
    ).slice(0, 3);
    if (alternatives.length > 0) {
      reply += `\n\nIski jagah ye options abhi stock mein maujood hain:\n`;
      reply += alternatives.map((product) => `• ${product.name} — ${formatPriceForAssistant(product.price)}`).join('\n');
    }
  }
  return reply;
}

async function answerWithClaude(message, history, products) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const systemPrompt = `You are the friendly, professional shop assistant for Fazal Paint Hardware and Trolley House, a paint and hardware store in Dera Ismail Khan, Pakistan.

${SHOP_FACTS}

Current live catalog (name / brand / line / color / packaging — price — stock status):
${catalogToPromptText(products)}

Rules:
- Only state a product as "in stock" or "out of stock" if it appears in the catalog above — never guess or invent stock status.
- If asked about something not in the catalog, say so honestly and suggest the closest real alternative from the list, or suggest calling +92 342 9085556.
- Reply in the same language/register the customer used (Roman Urdu, Urdu, or English) — most customers write in Roman Urdu.
- Keep answers short, warm, and professional — this is a real customer chatting from their phone. Use at most 1-2 short paragraphs or a short bullet list.
- You may suggest in-stock alternatives when something is out of stock.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-latest',
      max_tokens: 500,
      system: systemPrompt,
      messages: [...(history || []).slice(-6), { role: 'user', content: message }]
    })
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Anthropic API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const textBlock = (data.content || []).find((block) => block.type === 'text');
  return textBlock?.text || answerWithRules(message, products);
}

app.post('/api/assistant', async (req, res) => {
  const { message, history } = req.body || {};

  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    const products = loadAssistantCatalog();
    let reply;
    let mode = 'rules';

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        reply = await answerWithClaude(String(message).trim(), history, products);
        mode = 'ai';
      } catch (err) {
        console.error('Assistant AI mode failed, falling back to rules:', err.message);
        reply = answerWithRules(String(message).trim(), products);
      }
    } else {
      reply = answerWithRules(String(message).trim(), products);
    }

    return res.json({ reply, mode });
  } catch (err) {
    console.error('Assistant route error:', err);
    return res.status(500).json({ error: 'Assistant is temporarily unavailable' });
  }
});

// Public: only platforms the admin has left visible, as a simple
// { platform: url } map (unchanged shape so the public footer keeps working).
app.get('/api/social-links', (req, res) => {
  try {
    const rows = db.prepare('SELECT platform, url FROM social_links WHERE visible = 1 ORDER BY platform').all();
    const payload = Object.fromEntries(rows.map((row) => [row.platform, row.url]));
    return res.json(payload);
  } catch (err) {
    console.error('Social links route error:', err);
    return res.status(500).json({ error: 'Unable to load social links' });
  }
});

// Admin: full list including hidden platforms + their visibility, so the
// footer's admin edit mode can show a working eye/eye-off toggle.
app.get('/api/admin/social-links', authenticate, requireAdmin, (req, res) => {
  try {
    const rows = db.prepare('SELECT platform, url, visible FROM social_links ORDER BY platform').all();
    return res.json(rows.map((row) => ({ ...row, visible: Boolean(row.visible) })));
  } catch (err) {
    console.error('Admin social links route error:', err);
    return res.status(500).json({ error: 'Unable to load social links' });
  }
});

app.put('/api/admin/social-links/:platform', authenticate, requireAdmin, (req, res) => {
  const { platform } = req.params;
  const { url } = req.body || {};

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const updatedAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO social_links (platform, url, visible, updated_at)
    VALUES (?, ?, 1, ?)
    ON CONFLICT(platform) DO UPDATE SET url = excluded.url, updated_at = excluded.updated_at
  `).run(platform, url, updatedAt);

  return res.json({ message: 'Social link updated', platform, url });
});

// Show/hide a social link on the public footer without deleting its saved
// URL, so an admin can turn Pinterest/TikTok/etc. back on later.
app.put('/api/admin/social-links/:platform/visibility', authenticate, requireAdmin, (req, res) => {
  const { platform } = req.params;
  const { visible } = req.body || {};

  if (typeof visible !== 'boolean') {
    return res.status(400).json({ error: 'visible (boolean) is required' });
  }

  const existing = db.prepare('SELECT platform FROM social_links WHERE platform = ?').get(platform);
  if (!existing) {
    return res.status(404).json({ error: 'Unknown platform' });
  }

  db.prepare('UPDATE social_links SET visible = ?, updated_at = ? WHERE platform = ?')
    .run(visible ? 1 : 0, new Date().toISOString(), platform);

  return res.json({ message: 'Visibility updated', platform, visible });
});

// ==================== PRODUCT VARIANT MANAGEMENT ====================

app.post('/api/admin/products/toggle-stock/:id', authenticate, requireAdmin, (req, res) => {
  const { id } = req.params;
  const product = db.prepare('SELECT in_stock FROM products WHERE id = ?').get(id);

  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const newStock = product.in_stock ? 0 : 1;
  db.prepare('UPDATE products SET in_stock = ? WHERE id = ?').run(newStock, id);
  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  return res.json(updated);
});

app.get('/api/admin/product-groups', authenticate, requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT pg.id, pg.parent_id, pg.brand, pg.product_line, pg.image_url,
           COUNT(p.id) as variant_count,
           GROUP_CONCAT(p.packaging) as packagings,
           GROUP_CONCAT(p.color_code) as color_codes
    FROM product_groups pg
    LEFT JOIN products p ON p.parent_product_id = pg.parent_id
    GROUP BY pg.id
    ORDER BY pg.created_at DESC
  `).all();

  return res.json(rows);
});

// ==================== MANUAL PRODUCT GROUPS ====================
// "Add Group" + "Add to Group" feature. A catalog_group is an admin-curated
// named collection (name, description, photo, brand) that any selection of
// products can be filed into via catalog_group_products, independent of the
// auto-group variant linking above.
//
// On is_out_of_stock: the requested schema asked for an `is_out_of_stock`
// boolean column, but the products table already has a fully-wired `in_stock`
// column (form, Excel import, bulk actions, toggle endpoint all use it).
// Adding a second stored column for the same fact would need to be kept in
// sync everywhere in_stock changes, which is a real risk of the two silently
// disagreeing. Instead, every endpoint below computes
// `is_out_of_stock = NOT in_stock` at query time, so it's always correct and
// the frontend can use whichever name reads better.

app.post('/api/admin/catalog-groups', authenticate, requireAdmin, (req, res) => {
  const { name, description, image_url, image_urls, brand } = req.body || {};

  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'Group name is required' });
  }

  // Accept either the legacy single image_url, or the new image_urls array
  // (multi-photo). Whichever is given, keep both fields in sync: image_url
  // always mirrors the first photo so old readers keep working.
  const urls = Array.isArray(image_urls) ? image_urls.filter(Boolean) : (image_url ? [image_url] : []);
  const primaryUrl = urls[0] || '';

  const createdAt = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO catalog_groups (name, description, image_url, image_urls, brand, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    String(name).trim(),
    description || '',
    primaryUrl,
    JSON.stringify(urls),
    String(brand || '').trim(),
    createdAt
  );

  const group = db.prepare('SELECT *, 0 AS product_count FROM catalog_groups WHERE id = ?').get(result.lastInsertRowid);
  return res.status(201).json({ ...group, image_urls: urls });
});

app.get('/api/admin/catalog-groups', authenticate, requireAdmin, (req, res) => {
  const { brand } = req.query || {};

  let sql = `
    SELECT cg.*, COUNT(cgp.product_id) AS product_count
    FROM catalog_groups cg
    LEFT JOIN catalog_group_products cgp ON cgp.group_id = cg.id
  `;
  const params = [];

  if (brand && brand !== 'All') {
    sql += ' WHERE cg.brand = ?';
    params.push(String(brand));
  }

  sql += ' GROUP BY cg.id ORDER BY cg.created_at DESC';

  const rows = db.prepare(sql).all(...params);
  const withParsedImages = rows.map((row) => ({
    ...row,
    image_urls: (() => { try { return JSON.parse(row.image_urls || '[]'); } catch { return row.image_url ? [row.image_url] : []; } })()
  }));
  return res.json(withParsedImages);
});

app.get('/api/admin/catalog-groups/:id', authenticate, requireAdmin, (req, res) => {
  const { id } = req.params;
  const group = db.prepare('SELECT * FROM catalog_groups WHERE id = ?').get(id);
  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }

  const products = db.prepare(`
    SELECT p.*, (CASE WHEN p.in_stock = 1 THEN 0 ELSE 1 END) AS is_out_of_stock
    FROM products p
    INNER JOIN catalog_group_products cgp ON cgp.product_id = p.id
    WHERE cgp.group_id = ?
    ORDER BY p.name
  `).all(id);

  let imageUrls = [];
  try { imageUrls = JSON.parse(group.image_urls || '[]'); } catch { imageUrls = group.image_url ? [group.image_url] : []; }

  return res.json({ ...group, image_urls: imageUrls, products });
});

app.put('/api/admin/catalog-groups/:id', authenticate, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, description, image_url, image_urls, brand } = req.body || {};

  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'Group name is required' });
  }

  const urls = Array.isArray(image_urls) ? image_urls.filter(Boolean) : (image_url ? [image_url] : []);
  const primaryUrl = urls[0] || '';

  const result = db.prepare(`
    UPDATE catalog_groups
    SET name = ?, description = ?, image_url = ?, image_urls = ?, brand = ?
    WHERE id = ?
  `).run(String(name).trim(), description || '', primaryUrl, JSON.stringify(urls), String(brand || '').trim(), id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Group not found' });
  }

  const group = db.prepare('SELECT * FROM catalog_groups WHERE id = ?').get(id);
  return res.json({ ...group, image_urls: urls });
});

app.delete('/api/admin/catalog-groups/:id', authenticate, requireAdmin, (req, res) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM catalog_groups WHERE id = ?').run(id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Group not found' });
  }
  // catalog_group_products rows are removed automatically via ON DELETE CASCADE
  return res.json({ message: 'Group deleted' });
});

// Assign selected product(s) to a group ("Add to Group" modal action)
// When products are added to (or removed from) a manually-curated catalog
// group, this keeps their parent_product_id links in sync so the group
// behaves exactly like the old "Auto-Group Paint Products" feature did:
// the group's products show up as ONE card on the storefront with a
// size/color variant picker, instead of N separate cards.
//
// The lowest-id product currently in the group becomes the "parent" (its
// own parent_product_id is cleared); every other product in the group is
// linked to it via parent_product_id. This re-runs after every add/remove
// so the parent is always re-derived from current group membership rather
// than stored separately.
function relinkGroupVariants(groupId) {
  const memberIds = db.prepare(`
    SELECT p.id FROM products p
    INNER JOIN catalog_group_products cgp ON cgp.product_id = p.id
    WHERE cgp.group_id = ?
    ORDER BY p.id ASC
  `).all(groupId).map((row) => row.id);

  if (memberIds.length === 0) return;

  const parentId = memberIds[0];
  db.prepare('UPDATE products SET parent_product_id = NULL WHERE id = ?').run(parentId);

  const linkChild = db.prepare('UPDATE products SET parent_product_id = ? WHERE id = ?');
  memberIds.slice(1).forEach((childId) => linkChild.run(parentId, childId));
}

app.post('/api/admin/catalog-groups/:id/products', authenticate, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { product_ids } = req.body || {};

  const group = db.prepare('SELECT id FROM catalog_groups WHERE id = ?').get(id);
  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }

  if (!Array.isArray(product_ids) || product_ids.length === 0) {
    return res.status(400).json({ error: 'product_ids must be a non-empty array' });
  }

  const insertStmt = db.prepare(`
    INSERT INTO catalog_group_products (group_id, product_id, added_at)
    VALUES (?, ?, ?)
    ON CONFLICT(group_id, product_id) DO NOTHING
  `);
  const addedAt = new Date().toISOString();
  const failed = [];
  let assignedCount = 0;

  const runAssign = db.transaction((ids) => {
    ids.forEach((productId) => {
      const product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
      if (!product) {
        failed.push({ id: productId, reason: 'Product not found' });
        return;
      }
      insertStmt.run(id, productId, addedAt);
      assignedCount += 1;
    });
  });

  try {
    runAssign(product_ids);
    relinkGroupVariants(id);
    return res.json({ assignedCount, failed, group_id: Number(id) });
  } catch (err) {
    console.error('Assign to group failed:', err);
    return res.status(500).json({ error: 'Assign to group failed', details: err.message });
  }
});

// Remove a single product from a group
app.delete('/api/admin/catalog-groups/:groupId/products/:productId', authenticate, requireAdmin, (req, res) => {
  const { groupId, productId } = req.params;
  const result = db.prepare('DELETE FROM catalog_group_products WHERE group_id = ? AND product_id = ?').run(groupId, productId);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Product is not in this group' });
  }
  // This product is leaving the group, so it shouldn't stay linked as a
  // variant of whichever product is the group's parent.
  db.prepare('UPDATE products SET parent_product_id = NULL WHERE id = ?').run(productId);
  // Re-derive the parent/variant links for whoever is left in the group
  // (handles the case where the removed product WAS the parent).
  relinkGroupVariants(groupId);
  return res.json({ message: 'Product removed from group' });
});

// Public, unauthenticated: powers the customer-facing group/catalog view.
// Each product includes is_out_of_stock so the frontend can render the 🚫
// overlay without any extra lookups.
app.get('/api/catalog-groups', (req, res) => {
  const groups = db.prepare('SELECT * FROM catalog_groups ORDER BY created_at DESC').all();

  const productsStmt = db.prepare(`
    SELECT p.*, (CASE WHEN p.in_stock = 1 THEN 0 ELSE 1 END) AS is_out_of_stock
    FROM products p
    INNER JOIN catalog_group_products cgp ON cgp.product_id = p.id
    WHERE cgp.group_id = ?
    ORDER BY p.name
  `);

  const withProducts = groups.map((group) => {
    let imageUrls = [];
    try { imageUrls = JSON.parse(group.image_urls || '[]'); } catch { imageUrls = group.image_url ? [group.image_url] : []; }
    return { ...group, image_urls: imageUrls, products: productsStmt.all(group.id) };
  });

  return res.json(withProducts);
});

// ==================== EMAIL ORDER PARSER ====================

// Parse raw email content and extract items
app.post('/api/admin/parse-order-email', authenticate, requireAdmin, (req, res) => {
  const { emailContent } = req.body || {};

  if (!emailContent) {
    return res.status(400).json({ error: 'Email content is required' });
  }

  const lines = String(emailContent).split('\n');
  const items = [];
  let currentItem = {};

  // Simple regex-based parser to extract items
  lines.forEach((line) => {
    const trimmed = line.trim();

    // Look for quantity patterns (e.g., "2x", "2 x", "2 Gallon")
    const qtyMatch = trimmed.match(/^(\d+)\s*x?\s*(.+)$/i);
    if (qtyMatch) {
      if (Object.keys(currentItem).length > 0) {
        items.push(currentItem);
      }
      currentItem = {
        quantity: parseInt(qtyMatch[1], 10),
        name: qtyMatch[2].trim()
      };
    }

    // Extract variant info (size, color) if on separate lines
    if (trimmed.match(/gallon|liter|litre|quarter|pint|drum|drumi/i)) {
      currentItem.packaging = trimmed;
    }
    if (trimmed.match(/^#\d+|white|red|blue|black|green|yellow|brown|grey|ivory/i)) {
      currentItem.color = trimmed;
    }
  });

  if (Object.keys(currentItem).length > 0) {
    items.push(currentItem);
  }

  // Format as strictly numbered list
  const formattedList = items
    .map((item, idx) => {
      let line = `${idx + 1}. ${item.quantity} x ${item.name}`;
      if (item.packaging) line += ` — ${item.packaging}`;
      if (item.color) line += ` — ${item.color}`;
      return line;
    })
    .join('\n');

  return res.json({
    message: 'Order items parsed',
    itemCount: items.length,
    items,
    formattedList
  });
});

// ==================== BULK EXCEL IMPORT ====================

app.post('/api/admin/products/bulk-import', authenticate, requireAdmin, (req, res) => {
  const { rows } = req.body || {};

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'No rows provided for import' });
  }

  const createdAt = new Date().toISOString();
  const skippedRows = [];
  let insertedCount = 0;

  const insertStmt = db.prepare(`
    INSERT INTO products (name, brand, category, sub_category, price, description, image_url, in_stock, packaging, color_code, color_name, swatch_hex, parent_product_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // db.transaction() wraps every insert in one atomic SQLite transaction —
  // either all valid rows commit together (fast, single disk write), or if
  // something unexpected throws, none of them commit. Individual bad rows
  // are still just skipped (not thrown), so one bad row never blocks the
  // rest of a large spreadsheet from importing.
  const runImport = db.transaction((items) => {
    items.forEach((item, index) => {
      const rowNumber = index + 2; // +2 assumes row 1 in the spreadsheet is the header
      const name = String(item.name || item.Name || '').trim();
      const priceValue = Number(item.price ?? item.Price);

      if (!name) {
        skippedRows.push({ row: rowNumber, reason: 'Name is required' });
        return;
      }
      if (!Number.isFinite(priceValue) || priceValue < 0) {
        skippedRows.push({ row: rowNumber, reason: 'Price must be a valid number' });
        return;
      }

      const inStockRaw = item.in_stock ?? item['In Stock'] ?? item.InStock;
      const inStock = (inStockRaw === false || inStockRaw === 0 || String(inStockRaw).trim().toUpperCase() === 'FALSE') ? 0 : 1;

      try {
        insertStmt.run(
          name,
          String(item.brand || item.Brand || '').trim(),
          String(item.category || item.Category || '').trim(),
          String(item.sub_category || item['Sub Category'] || '').trim(),
          priceValue,
          String(item.description || item.Description || '').trim(),
          '',
          inStock,
          String(item.packaging || item.Packaging || '').trim(),
          String(item.color_code || item['Color Code'] || '').trim(),
          String(item.color_name || item['Color Name'] || '').trim(),
          String(item.swatch_hex || item['Swatch Hex'] || '').trim(),
          null,
          createdAt
        );
        insertedCount++;
      } catch (err) {
        skippedRows.push({ row: rowNumber, reason: err.message || 'Database error' });
      }
    });
  });

  try {
    runImport(rows);
    return res.json({ insertedCount, skippedRows });
  } catch (err) {
    console.error('Bulk import failed:', err);
    return res.status(500).json({ error: 'Bulk import failed', details: err.message });
  }
});

// ==================== BULK PHOTO UPLOAD ====================

app.post('/api/admin/products/bulk-upload-images', authenticate, requireAdmin, (req, res) => {
  upload.array('images', 50)(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results = req.files.map((file) => ({
      url: `/uploads/${path.basename(file.filename)}`,
      originalName: file.originalname
    }));

    return res.json({ files: results });
  });
});

app.put('/api/admin/products/bulk-assign-images', authenticate, requireAdmin, (req, res) => {
  const { assignments } = req.body || {};

  if (!Array.isArray(assignments) || assignments.length === 0) {
    return res.status(400).json({ error: 'No assignments provided' });
  }

  const updateStmt = db.prepare('UPDATE products SET image_url = ? WHERE id = ?');
  let updatedCount = 0;
  const failed = [];

  const runAssign = db.transaction((items) => {
    items.forEach((item) => {
      if (!item.product_id || !item.image_url) {
        failed.push({ item, reason: 'Missing product_id or image_url' });
        return;
      }
      const result = updateStmt.run(item.image_url, item.product_id);
      if (result.changes === 0) {
        failed.push({ item, reason: 'Product not found' });
      } else {
        updatedCount++;
      }
    });
  });

  try {
    runAssign(assignments);
    return res.json({ updatedCount, failed });
  } catch (err) {
    console.error('Bulk image assignment failed:', err);
    return res.status(500).json({ error: 'Bulk assignment failed', details: err.message });
  }
});

// ==================== ORDERS + AUTOMATED CONFIRMATION ====================
//
// Foundational note: before this, orders were never actually stored in the
// database — Checkout only emailed them (via EmailJS or the /send-order
// fallback) and appended to a flat orders.json file. Automated
// confirmation (IVR "press 1/2") and status-aware WhatsApp messages need a
// real record with a stable ID and a status column to update, so this adds
// a proper `orders` table and a POST /api/orders endpoint that Checkout
// calls IN ADDITION TO (not instead of) the existing email flow, so
// nothing that already worked can be broken by this being new/unproven.
//
// IVR (phone call) and WhatsApp both go through Twilio, gated behind env
// vars — with no Twilio account configured, order creation still works
// exactly as before, it just skips the call/message and logs why.

const TWILIO_ACCOUNT_SID = (process.env.TWILIO_ACCOUNT_SID || '').trim();
const TWILIO_AUTH_TOKEN = (process.env.TWILIO_AUTH_TOKEN || '').trim();
const TWILIO_VOICE_NUMBER = (process.env.TWILIO_VOICE_NUMBER || '').trim(); // e.g. +1415XXXXXXX
const TWILIO_WHATSAPP_NUMBER = (process.env.TWILIO_WHATSAPP_NUMBER || '').trim(); // e.g. +14155238886 (Twilio sandbox) — no "whatsapp:" prefix here, it's added automatically
// A real, publicly-reachable URL for THIS server (Twilio calls back into
// it to fetch call instructions and report keypresses). localhost will
// NOT work — Twilio's servers can't reach your machine directly. Use your
// real domain in production, or a tool like ngrok while testing locally.
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
// Optional: URL to a hosted, pre-recorded human voice message (mp3/wav).
// Strongly recommended over text-to-speech — Twilio's <Say> does not have
// a natural Urdu voice, so Roman Urdu text read by an English/Hindi voice
// can sound off. If this isn't set, falls back to best-effort <Say>.
const IVR_AUDIO_URL = (process.env.IVR_AUDIO_URL || '').trim();

function hasTwilioConfigured() {
  return Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_VOICE_NUMBER);
}

function hasTwilioWhatsappConfigured() {
  return Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_WHATSAPP_NUMBER);
}

function twilioAuthHeader() {
  return 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
}

// Pakistani mobile numbers are collected/validated as "03XXXXXXXXX"
// (see Checkout.jsx's phone regex). Twilio requires E.164 (+92XXXXXXXXXX).
function toE164Pakistan(localPhone) {
  const digits = String(localPhone || '').replace(/\D/g, '');
  if (digits.startsWith('92')) return `+${digits}`;
  if (digits.startsWith('0')) return `+92${digits.slice(1)}`;
  return `+92${digits}`;
}

function generateInvoiceNumber() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const todayCount = db.prepare(`
    SELECT COUNT(*) AS c FROM orders WHERE invoice_number LIKE ?
  `).get(`FPH-${datePart}-%`).c;
  const sequence = String(todayCount + 1).padStart(4, '0');
  return `FPH-${datePart}-${sequence}`;
}

function formatAmountForMessage(amount) {
  return Math.round(Number(amount) || 0).toLocaleString('en-PK');
}

// ---- Exact message templates, as specified ----

function buildBankTransferMessage({ invoiceNumber, amount }) {
  return `Assalam-o-Alaikum,
Fazal Paint & Hardware Store se bat kar rahe hain. Aapka order hume mausool ho gaya hai. 

Invoice #: ${invoiceNumber}
Total Amount: Rs. ${formatAmountForMessage(amount)}

Kyunki aapne Bank Transfer select kiya hai, is liye baraye-meharbani niche diye gaye Easypaisa account par rakam send kar dein:

Easypaisa Account Details:
- Account Title: Fazal-ur-Rehman
- Account Number: 0342-9085556

⚠️ Note: Payment transfer karne ke baad, raseed (receipt) ka screenshot isi chat par lazmi share karein taake aapka order jald az jald dispatch kiya ja sake.
Shukriya!
Fazal Paint & Hardware Store`;
}

function buildCodConfirmedMessage({ invoiceNumber, amount }) {
  return `Assalam-o-Alaikum,
Fazal Paint & Hardware Store se bat kar rahe hain. Aapka Cash on Delivery (COD) order kamyabi se confirm ho gaya hai!

Invoice #: ${invoiceNumber}
Total Amount: Rs. ${formatAmountForMessage(amount)} (Delivery ke waqt ada kijiye ga)

Aapka order jald hi hamare warehouse se rawana kar diya jayega. Jab rider aapke pass pahuche, to baraye-meharbani cash payment usay hand-over kar dein.
Humaare sath shopping karne ka shukriya!
Fazal Paint & Hardware Store`;
}

async function sendWhatsAppMessage(toLocalPhone, body) {
  if (!hasTwilioWhatsappConfigured()) {
    console.log(`[DEV] WhatsApp not configured — would have sent to ${toLocalPhone}:\n${body}`);
    return { sent: false, configured: false };
  }

  try {
    const params = new URLSearchParams({
      From: `whatsapp:${TWILIO_WHATSAPP_NUMBER}`,
      To: `whatsapp:${toE164Pakistan(toLocalPhone)}`,
      Body: body
    });
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: twilioAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });
    const data = await response.json();
    if (!response.ok) {
      console.error('WhatsApp send failed:', data);
      return { sent: false, configured: true, error: data.message };
    }
    console.log(`WhatsApp message sent to ${toLocalPhone}: sid=${data.sid}`);
    return { sent: true, configured: true, sid: data.sid };
  } catch (err) {
    console.error('WhatsApp send threw:', err);
    return { sent: false, configured: true, error: err.message };
  }
}

// Places the actual outbound call. Twilio then fetches TwiML instructions
// from our /api/twilio/ivr-twiml endpoint (below) once the customer answers.
async function triggerIvrCall(order) {
  if (!hasTwilioConfigured()) {
    console.log(`[DEV] IVR not configured — would have called ${order.customer_phone} to confirm order ${order.invoice_number}`);
    return { called: false, configured: false };
  }
  if (!PUBLIC_BASE_URL) {
    console.warn('IVR skipped: PUBLIC_BASE_URL is not set, so Twilio has no reachable URL to fetch call instructions from.');
    return { called: false, configured: true, error: 'PUBLIC_BASE_URL not set' };
  }

  try {
    const params = new URLSearchParams({
      To: toE164Pakistan(order.customer_phone),
      From: TWILIO_VOICE_NUMBER,
      Url: `${PUBLIC_BASE_URL}/api/twilio/ivr-twiml?orderId=${order.id}`,
      StatusCallback: `${PUBLIC_BASE_URL}/api/twilio/ivr-status?orderId=${order.id}`
    });
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`, {
      method: 'POST',
      headers: {
        Authorization: twilioAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });
    const data = await response.json();
    if (!response.ok) {
      console.error('IVR call failed to start:', data);
      return { called: false, configured: true, error: data.message };
    }
    db.prepare('UPDATE orders SET ivr_call_sid = ?, updated_at = ? WHERE id = ?').run(data.sid, new Date().toISOString(), order.id);
    console.log(`IVR call started for order ${order.invoice_number}: sid=${data.sid}`);
    return { called: true, configured: true, sid: data.sid };
  } catch (err) {
    console.error('IVR call threw:', err);
    return { called: false, configured: true, error: err.message };
  }
}

function xmlEscape(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const IVR_SCRIPT = 'Assalam-o-Alaikum! Fazal Paint and Hardware Store se baat kar rahe hain. Aapke order ki tasdeeq ke liye yeh call ki gayi hai. Agar aap apna order confirm karna chahte hain, to 1 dabayein. Agar aap apna order cancel karna chahte hain, to 2 dabayein.';

// Twilio requests this URL when the call connects. It must respond with
// TwiML (a small XML dialect), not JSON.
app.post('/api/twilio/ivr-twiml', (req, res) => {
  const orderId = req.query.orderId;
  const gatherAction = `${PUBLIC_BASE_URL}/api/twilio/ivr-response?orderId=${orderId}`;

  const speakOrPlay = IVR_AUDIO_URL
    ? `<Play>${xmlEscape(IVR_AUDIO_URL)}</Play>`
    : `<Say language="ur-PK">${xmlEscape(IVR_SCRIPT)}</Say>`;

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf" numDigits="1" timeout="10" action="${xmlEscape(gatherAction)}" method="POST">
    ${speakOrPlay}
  </Gather>
  <Say language="ur-PK">Koi jawab nahi mila. Allah Hafiz.</Say>
</Response>`;

  res.type('text/xml').send(twiml);
});

// Twilio posts the digit the customer pressed here.
app.post('/api/twilio/ivr-response', (req, res) => {
  const orderId = req.query.orderId;
  const digit = req.body?.Digits;
  const now = new Date().toISOString();

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  let replyMessage = 'Shukriya. Allah Hafiz.';

  if (order && digit === '1') {
    db.prepare('UPDATE orders SET status = ?, ivr_status = ?, updated_at = ? WHERE id = ?').run('Confirmed', 'Confirmed', now, orderId);
    replyMessage = 'Aapka order confirm ho gaya hai. Shukriya!';
    // COD orders only get their WhatsApp confirmation once the customer
    // has actually confirmed over the call — Bank Transfer already got
    // its message immediately at checkout (see POST /api/orders below).
    if (order.payment_method === 'Cash on Delivery' && !order.whatsapp_sent) {
      sendWhatsAppMessage(order.customer_phone, buildCodConfirmedMessage({ invoiceNumber: order.invoice_number, amount: order.total }))
        .then((result) => {
          if (result.sent) {
            db.prepare('UPDATE orders SET whatsapp_sent = 1, updated_at = ? WHERE id = ?').run(new Date().toISOString(), orderId);
          }
        });
    }
  } else if (order && digit === '2') {
    db.prepare('UPDATE orders SET status = ?, ivr_status = ?, updated_at = ? WHERE id = ?').run('Cancelled', 'Cancelled', now, orderId);
    replyMessage = 'Aapka order cancel kar diya gaya hai.';
  } else if (order) {
    db.prepare('UPDATE orders SET ivr_status = ?, updated_at = ? WHERE id = ?').run('No response / invalid key', now, orderId);
  }

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="ur-PK">${xmlEscape(replyMessage)}</Say>
</Response>`;
  res.type('text/xml').send(twiml);
});

// Twilio posts call lifecycle events here (ringing/answered/no-answer/
// busy/failed) — useful for seeing why a call didn't get a keypress.
app.post('/api/twilio/ivr-status', (req, res) => {
  const orderId = req.query.orderId;
  const callStatus = req.body?.CallStatus;
  console.log(`IVR call status for order ${orderId}: ${callStatus}`);
  if (orderId && callStatus && ['no-answer', 'busy', 'failed'].includes(callStatus)) {
    db.prepare('UPDATE orders SET ivr_status = ?, updated_at = ? WHERE id = ?').run(callStatus, new Date().toISOString(), orderId);
  }
  res.sendStatus(200);
});

// Called by Checkout.jsx right after the existing email-based order send —
// creates the persistent order record, fires the Bank Transfer WhatsApp
// message immediately if applicable, and starts the IVR confirmation call.
app.post('/api/orders', authenticateOptional, async (req, res) => {
  const { customer, items, total, paymentMethod } = req.body || {};

  if (!customer?.fullName || !customer?.phone) {
    return res.status(400).json({ error: 'Customer name and phone are required' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Order must include at least one item' });
  }

  try {
    const invoiceNumber = generateInvoiceNumber();
    const now = new Date().toISOString();
    const billingAddress = customer.billingSameAsShipping ? customer.shippingAddress : customer.billingAddress;

    const result = db.prepare(`
      INSERT INTO orders (
        invoice_number, customer_name, customer_email, customer_phone,
        shipping_address, shipping_city, shipping_state, shipping_postal,
        payment_method, items_json, total, status, user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?)
    `).run(
      invoiceNumber,
      customer.fullName,
      customer.email || null,
      customer.phone,
      customer.shippingAddress || null,
      customer.shippingCity || null,
      customer.shippingState || null,
      customer.shippingPostal || null,
      paymentMethod || 'Cash on Delivery',
      JSON.stringify(items),
      Number(total) || 0,
      req.user?.userId || null,
      now,
      now
    );

    const order = { id: result.lastInsertRowid, invoice_number: invoiceNumber, customer_phone: customer.phone, payment_method: paymentMethod, total };

    // Bank Transfer: send payment instructions right away — no need to
    // wait for an IVR confirmation, the customer still has to actually
    // transfer the money.
    if (paymentMethod === 'Bank Transfer') {
      sendWhatsAppMessage(customer.phone, buildBankTransferMessage({ invoiceNumber, amount: total }))
        .then((result2) => {
          if (result2.sent) {
            db.prepare('UPDATE orders SET whatsapp_sent = 1, updated_at = ? WHERE id = ?').run(new Date().toISOString(), order.id);
          }
        });
    }

    // Fire-and-forget: don't make the customer wait for Twilio before
    // seeing their "order placed" confirmation screen.
    triggerIvrCall(order);

    return res.status(201).json({ message: 'Order recorded', invoiceNumber, orderId: order.id });
  } catch (err) {
    console.error('POST /api/orders failed:', err);
    return res.status(500).json({ error: err.message || 'Failed to record order' });
  }
});

// ==================== CUSTOMER ACCOUNT: ORDER HISTORY / REORDER / INVOICE ====================

// Customer: "my orders" — order history + tracking (only orders placed
// while logged in are linked via user_id; guest-checkout orders placed
// before this feature existed won't retroactively appear here).
app.get('/api/orders/mine', authenticate, (req, res) => {
  const rows = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(req.user.userId);
  return res.json(rows.map((row) => ({ ...row, items: JSON.parse(row.items_json) })));
});

// Customer: single order detail (for the invoice/receipt view and "reorder"
// button). Only the owning customer (or an admin) may view it.
app.get('/api/orders/:id', authenticate, (req, res) => {
  const { id } = req.params;
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  if (order.user_id !== req.user.userId && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not allowed to view this order' });
  }
  return res.json({ ...order, items: JSON.parse(order.items_json) });
});

function buildStatusUpdateMessage({ invoiceNumber, status }) {
  return `Assalam-o-Alaikum,\nFazal Paint & Hardware Store se bat kar rahe hain.\n\nInvoice #: ${invoiceNumber}\nAapke order ka status update ho gaya hai: ${status}\n\nShukriya!\nFazal Paint & Hardware Store`;
}

async function notifyCustomerOfStatusChange(order, status) {
  // Email (if the order has one and SMTP is configured)
  if (order.customer_email && hasSmtpConfigured() && transporter) {
    try {
      await transporter.sendMail({
        from: `"Fazal Paint Hardware" <${process.env.SMTP_FROM || smtpUser || 'order@fazalpainthardware.com'}>`,
        to: order.customer_email,
        subject: `Order ${order.invoice_number} status update: ${status}`,
        text: `Aapke order (Invoice #: ${order.invoice_number}) ka status update ho gaya hai: ${status}\n\nShukriya!\nFazal Paint & Hardware Store`
      });
    } catch (err) {
      console.error('Failed to email customer about status change:', err);
    }
  }
  // WhatsApp (if configured)
  if (order.customer_phone) {
    sendWhatsAppMessage(order.customer_phone, buildStatusUpdateMessage({ invoiceNumber: order.invoice_number, status })).catch(() => {});
  }
}

// Admin: change order status (Pending/Confirmed/Shipped/Delivered/Cancelled
// etc — any free-text status is accepted) and notify the customer by
// email + WhatsApp so they get an "order status update" benefit.
app.put('/api/admin/orders/:id/status', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  if (!status || !String(status).trim()) {
    return res.status(400).json({ error: 'Status is required' });
  }
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').run(status, new Date().toISOString(), id);
  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  notifyCustomerOfStatusChange(updated, status).catch(() => {});
  return res.json({ ...updated, items: JSON.parse(updated.items_json) });
});

// ==================== CUSTOMER ACCOUNT: SAVED ADDRESSES ====================

app.get('/api/addresses', authenticate, (req, res) => {
  const rows = db.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC').all(req.user.userId);
  return res.json(rows);
});

app.post('/api/addresses', authenticate, (req, res) => {
  const { label, fullName, phone, address, city, state, postalCode, isDefault } = req.body || {};
  if (!address || !String(address).trim()) {
    return res.status(400).json({ error: 'Address is required' });
  }
  const now = new Date().toISOString();
  if (isDefault) {
    db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(req.user.userId);
  }
  const result = db.prepare(`
    INSERT INTO addresses (user_id, label, full_name, phone, address, city, state, postal_code, is_default, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.userId, label || null, fullName || null, phone || null, address, city || null, state || null, postalCode || null, isDefault ? 1 : 0, now);
  const row = db.prepare('SELECT * FROM addresses WHERE id = ?').get(result.lastInsertRowid);
  return res.status(201).json(row);
});

app.put('/api/addresses/:id', authenticate, (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ?').get(id, req.user.userId);
  if (!existing) {
    return res.status(404).json({ error: 'Address not found' });
  }
  const { label, fullName, phone, address, city, state, postalCode, isDefault } = req.body || {};
  if (isDefault) {
    db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(req.user.userId);
  }
  db.prepare(`
    UPDATE addresses SET label = ?, full_name = ?, phone = ?, address = ?, city = ?, state = ?, postal_code = ?, is_default = ?
    WHERE id = ?
  `).run(
    label ?? existing.label,
    fullName ?? existing.full_name,
    phone ?? existing.phone,
    address ?? existing.address,
    city ?? existing.city,
    state ?? existing.state,
    postalCode ?? existing.postal_code,
    isDefault ? 1 : existing.is_default,
    id
  );
  const row = db.prepare('SELECT * FROM addresses WHERE id = ?').get(id);
  return res.json(row);
});

app.delete('/api/addresses/:id', authenticate, (req, res) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM addresses WHERE id = ? AND user_id = ?').run(id, req.user.userId);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Address not found' });
  }
  return res.json({ message: 'Address deleted' });
});

// ==================== CUSTOMER ACCOUNT: WISHLIST ====================

app.get('/api/wishlist', authenticate, (req, res) => {
  const rows = db.prepare(`
    SELECT p.* FROM wishlist w JOIN products p ON p.id = w.product_id
    WHERE w.user_id = ? ORDER BY w.added_at DESC
  `).all(req.user.userId);
  return res.json(rows);
});

app.post('/api/wishlist', authenticate, (req, res) => {
  const { productId } = req.body || {};
  if (!productId) {
    return res.status(400).json({ error: 'productId is required' });
  }
  db.prepare('INSERT OR IGNORE INTO wishlist (user_id, product_id, added_at) VALUES (?, ?, ?)').run(req.user.userId, productId, new Date().toISOString());
  return res.status(201).json({ message: 'Added to wishlist' });
});

app.delete('/api/wishlist/:productId', authenticate, (req, res) => {
  const { productId } = req.params;
  db.prepare('DELETE FROM wishlist WHERE user_id = ? AND product_id = ?').run(req.user.userId, productId);
  return res.json({ message: 'Removed from wishlist' });
});

// ==================== CUSTOMER ACCOUNT: PROFILE (saved payment/contact) ====================

app.get('/api/profile', authenticate, (req, res) => {
  const row = db.prepare('SELECT id, name, email, role, default_payment_method FROM users WHERE id = ?').get(req.user.userId);
  if (!row) {
    return res.status(404).json({ error: 'User not found' });
  }
  return res.json(row);
});

app.put('/api/profile', authenticate, (req, res) => {
  const { name, defaultPaymentMethod } = req.body || {};
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.userId);
  if (!existing) {
    return res.status(404).json({ error: 'User not found' });
  }
  db.prepare('UPDATE users SET name = ?, default_payment_method = ? WHERE id = ?').run(
    name ?? existing.name,
    defaultPaymentMethod ?? existing.default_payment_method,
    req.user.userId
  );
  const row = db.prepare('SELECT id, name, email, role, default_payment_method FROM users WHERE id = ?').get(req.user.userId);
  return res.json(row);
});

// ==================== CUSTOMER ACCOUNT: SUPPORT / COMPLAINT TICKETS ====================

app.post('/api/support-tickets', authenticate, (req, res) => {
  const { subject, message, orderInvoiceNumber, type } = req.body || {};
  if (!subject || !String(subject).trim() || !message || !String(message).trim()) {
    return res.status(400).json({ error: 'Subject and message are required' });
  }
  const ticketType = type === 'suggestion' ? 'suggestion' : 'complaint';
  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO support_tickets (user_id, subject, message, order_invoice_number, status, type, viewed_by_admin, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'Open', ?, 0, ?, ?)
  `).run(req.user.userId, subject, message, orderInvoiceNumber || null, ticketType, now, now);
  const row = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(result.lastInsertRowid);
  const emailLabel = ticketType === 'suggestion' ? 'New Suggestion' : 'New Complaint';
  notifyWebsiteEmail(
    `${emailLabel}: ${subject}`,
    `A new ${ticketType} was submitted.\n\nFrom: ${req.user.email}\nSubject: ${subject}\nRelated invoice #: ${orderInvoiceNumber || 'N/A'}\nDate: ${now}\n\nMessage:\n${message}`
  ).catch(() => {});
  return res.status(201).json(row);
});

app.get('/api/support-tickets/mine', authenticate, (req, res) => {
  const rows = db.prepare('SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC').all(req.user.userId);
  return res.json(rows);
});

app.get('/api/admin/support-tickets', authenticate, requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT t.*, u.email AS user_email FROM support_tickets t JOIN users u ON u.id = t.user_id ORDER BY t.created_at DESC').all();
  return res.json(rows);
});

app.put('/api/admin/support-tickets/:id', authenticate, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { status, adminReply } = req.body || {};
  const existing = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Ticket not found' });
  }
  db.prepare('UPDATE support_tickets SET status = ?, admin_reply = ?, viewed_by_admin = 1, updated_at = ? WHERE id = ?').run(
    status ?? existing.status,
    adminReply ?? existing.admin_reply,
    new Date().toISOString(),
    id
  );
  const row = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(id);
  return res.json(row);
});

// Marks a ticket as opened/read by the admin — flips it from "Pending" to
// "Received" in the admin list without requiring a reply.
app.put('/api/admin/support-tickets/:id/mark-viewed', authenticate, requireAdmin, (req, res) => {
  const { id } = req.params;
  const result = db.prepare('UPDATE support_tickets SET viewed_by_admin = 1 WHERE id = ?').run(id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Ticket not found' });
  }
  return res.json({ message: 'Marked as viewed' });
});

app.get('/api/admin/support-tickets/unread-count', authenticate, requireAdmin, (req, res) => {
  const row = db.prepare('SELECT COUNT(*) AS count FROM support_tickets WHERE viewed_by_admin = 0').get();
  return res.json({ count: row.count });
});

// ==================== CUSTOMER ACCOUNT: CUSTOM QUOTATION REQUESTS ====================

app.post('/api/quotation-requests', authenticate, (req, res) => {
  const { details, quantityEstimate } = req.body || {};
  if (!details || !String(details).trim()) {
    return res.status(400).json({ error: 'Details are required' });
  }
  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO quotation_requests (user_id, details, quantity_estimate, status, viewed_by_admin, created_at, updated_at)
    VALUES (?, ?, ?, 'Pending', 0, ?, ?)
  `).run(req.user.userId, details, quantityEstimate || null, now, now);
  const row = db.prepare('SELECT * FROM quotation_requests WHERE id = ?').get(result.lastInsertRowid);
  notifyWebsiteEmail(
    'Bulk Order Received',
    `A new bulk order request was submitted.\n\nFrom: ${req.user.email}\nQuantity estimate: ${quantityEstimate || 'N/A'}\nDate: ${now}\n\nDetails:\n${details}`
  ).catch(() => {});
  return res.status(201).json(row);
});

app.get('/api/quotation-requests/mine', authenticate, (req, res) => {
  const rows = db.prepare('SELECT * FROM quotation_requests WHERE user_id = ? ORDER BY created_at DESC').all(req.user.userId);
  return res.json(rows);
});

app.get('/api/admin/quotation-requests', authenticate, requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT q.*, u.email AS user_email FROM quotation_requests q JOIN users u ON u.id = q.user_id ORDER BY q.created_at DESC').all();
  return res.json(rows);
});

app.put('/api/admin/quotation-requests/:id', authenticate, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { status, adminQuote } = req.body || {};
  const existing = db.prepare('SELECT * FROM quotation_requests WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Quotation request not found' });
  }
  db.prepare('UPDATE quotation_requests SET status = ?, admin_quote = ?, viewed_by_admin = 1, updated_at = ? WHERE id = ?').run(
    status ?? existing.status,
    adminQuote ?? existing.admin_quote,
    new Date().toISOString(),
    id
  );
  const row = db.prepare('SELECT * FROM quotation_requests WHERE id = ?').get(id);
  return res.json(row);
});

// Marks a bulk-order request as opened/read by the admin.
app.put('/api/admin/quotation-requests/:id/mark-viewed', authenticate, requireAdmin, (req, res) => {
  const { id } = req.params;
  const result = db.prepare('UPDATE quotation_requests SET viewed_by_admin = 1 WHERE id = ?').run(id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Quotation request not found' });
  }
  return res.json({ message: 'Marked as viewed' });
});

app.get('/api/admin/quotation-requests/unread-count', authenticate, requireAdmin, (req, res) => {
  const row = db.prepare('SELECT COUNT(*) AS count FROM quotation_requests WHERE viewed_by_admin = 0').get();
  return res.json({ count: row.count });
});

// Admin: view orders + their confirmation status (Pending/Confirmed/Cancelled).
// Each row includes viewed_by_admin (0/1) so the frontend can render the
// unread dot without a separate lookup.
app.get('/api/admin/orders', authenticate, requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 200').all();
  return res.json(rows.map((row) => ({ ...row, items: JSON.parse(row.items_json) })));
});

// Admin: count of unread orders — handy for a badge on the "Orders" nav
// link itself (not just the dots inside the list). Registered BEFORE the
// "/:id" route below on purpose: Express matches routes in registration
// order, and "/:id" would otherwise swallow this request by treating the
// literal word "unread-count" as an order id.
app.get('/api/admin/orders/unread-count', authenticate, requireAdmin, (req, res) => {
  const row = db.prepare('SELECT COUNT(*) AS c FROM orders WHERE viewed_by_admin = 0').get();
  return res.json({ count: row.c });
});

// Admin: get a single order's full detail (used when opening the order
// detail view/modal).
app.get('/api/admin/orders/:id', authenticate, requireAdmin, (req, res) => {
  const { id } = req.params;
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  return res.json({ ...order, items: JSON.parse(order.items_json) });
});

// Admin: mark an order as viewed — call this the moment an admin opens an
// order's detail view/modal, so its unread dot disappears both for this
// admin session and everywhere else the order list is loaded from.
app.put('/api/admin/orders/:id/mark-viewed', authenticate, requireAdmin, (req, res) => {
  const { id } = req.params;
  const result = db.prepare('UPDATE orders SET viewed_by_admin = 1, updated_at = ? WHERE id = ?').run(new Date().toISOString(), id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Order not found' });
  }
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  return res.json({ ...order, items: JSON.parse(order.items_json) });
});

// Admin: delete an order permanently. Removes the row from the orders
// table entirely — there is no "trash"/undo, so the frontend confirms
// with the admin before calling this.
app.delete('/api/admin/orders/:id', authenticate, requireAdmin, (req, res) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM orders WHERE id = ?').run(id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Order not found' });
  }
  return res.json({ message: 'Order deleted' });
});

const port = Number(process.env.ORDER_SERVER_PORT || 5173);
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(port, () => console.log(`Order server running on port ${port}`));