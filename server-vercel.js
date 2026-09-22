import express from 'express'
import cors from 'cors'
import session from 'express-session'
import connectPgSimple from 'connect-pg-simple'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import 'dotenv/config'
import { pool } from './lib/db/pool.js'
import authRoutes from './routes/auth.js'
import postRoutes from './routes/posts.js'
import aiRoutes from './routes/ai.js'
import liveRoutes from './routes/live.js'
import userRoutes from './routes/user.js'
import analyticsRoutes from './routes/analytics.js'
import oauthServerRoutes from './routes/oauthServer.js'
import mcpRoutes from './routes/mcp.js'
import { requireAuth } from './lib/auth.js'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
app.set('trust proxy', 1)
app.use(cors({
  origin: process.env.BASE_URL || 'https://flixty.vercel.app',
  credentials: true
}))
app.use('/mcp', express.json({ limit: '65mb' }))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
// ============================================================
// PostgreSQL-backed sessions
// Required for Vercel/serverless OAuth callbacks
// ============================================================
const PgSession = connectPgSimple(session)
app.use(session({
  store: new PgSession({
    pool,
    tableName: 'user_sessions',
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET || 'curator-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}))
// ============================================================
// Pages
// ============================================================
app.get('/', (req, res) => {
  if (req.session?.userId) {
    res.sendFile(path.join(__dirname, 'public/index.html'))
  } else {
    res.sendFile(path.join(__dirname, 'public/landing.html'))
  }
})
app.use(express.static(path.join(__dirname, 'public')))
// ============================================================
// Uploads
// ============================================================
const uploadsDir = path.join(__dirname, 'data/uploads')
if (fs.existsSync(uploadsDir)) {
  app.use('/uploads', express.static(uploadsDir, {
    setHeaders: (res) => {
      res.set('X-Content-Type-Options', 'nosniff')
    }
  }))
}
// ============================================================
// Routes
// ============================================================
app.use('/api/user', userRoutes)
app.use('/auth', authRoutes)
app.use('/api', postRoutes)
app.use('/api/ai', requireAuth, aiRoutes)
app.use('/api/live', requireAuth, liveRoutes)
app.use('/api/analytics', requireAuth, analyticsRoutes)
app.use(oauthServerRoutes)
app.use(mcpRoutes)
// ============================================================
// Health
// ============================================================
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    platform: 'vercel',
    time: new Date().toISOString()
  })
})
export default app
