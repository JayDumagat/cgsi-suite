import connectPgSimple from "connect-pg-simple";
import session from "express-session";
import { Pool } from "pg";
import { config } from "../../config/environment.js";

export const sessionPool = new Pool({
  host: process.env.PGHOST || "postgres",
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || "cgsi_identity",
  password: process.env.PGPASSWORD ?? "",
  database: process.env.PGDATABASE || "cgsi",
  max: 10,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
});

const PgSessionStore = connectPgSimple(session);

export const sessionStore = new PgSessionStore({
  pool: sessionPool,
  schemaName: "platform",
  tableName: "user_sessions",
  createTableIfMissing: false,
  pruneSessionInterval: 15 * 60,
});

export function createSessionMiddleware(): ReturnType<typeof session> {
  return session({
    name: "cgsi_session",
    secret: config.sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: "lax",
      path: "/",
      ...(config.cookieDomain ? { domain: config.cookieDomain } : {}),
      maxAge: config.sessionMaxAgeSeconds * 1000,
    },
  });
}
