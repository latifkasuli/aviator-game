# Aviator Game Deployment Checklist

## Pre-Deployment Status
- [OK] Code pushed to GitHub
- [OK] Admin system implemented and tested
- [OK] Database migrations ready
- [Ready] Ready for deployment

## Backend Deployment (Railway)

### Step 1: Create Railway Project
1. Go to [Railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose `aviator-game` repository
5. Select the `/backend` directory as root

### Step 2: Add PostgreSQL Database
1. In Railway dashboard, click "New Service"
2. Select "Database" → "PostgreSQL"
3. Railway will automatically set `DATABASE_URL`

### Step 3: Configure Environment Variables
Add these in Railway dashboard → Variables:

```env
# JWT Secrets (generate strong random strings)
JWT_SECRET=your-very-long-random-string-here
JWT_REFRESH_SECRET=another-very-long-random-string-here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Server Config
PORT=3002
NODE_ENV=production

# CORS (update with your Vercel URL after frontend deploy)
CORS_ORIGINS=https://your-app.vercel.app,https://your-custom-domain.com

# Admin Security
ADMIN_REGISTRATION_KEY=super-secret-admin-key-change-this

# Optional: IP Restriction (your IPs)
# ADMIN_IP_RANGES=your.public.ip.here

# Game Settings
DEFAULT_BALANCE=1000
MIN_BET=1
MAX_BET=10000
HOUSE_EDGE=0.01
GAME_DURATION=10000
COUNTDOWN_DURATION=5000
```

### Step 4: Deploy
1. Railway will auto-deploy when you push
2. Check logs for successful startup
3. Note your backend URL: `https://your-app.railway.app`

---

## Frontend Deployment (Vercel)

### Step 1: Import to Vercel
1. Go to [Vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import `aviator-game` repository
4. Keep root directory as `/` (not /backend)

### Step 2: Configure Build Settings
- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`

### Step 3: Add Environment Variables
Add these in Vercel → Settings → Environment Variables:

```env
# Backend URLs (use your Railway URL)
VITE_API_URL=https://your-backend.railway.app/api
VITE_WS_URL=wss://your-backend.railway.app

# Optional: Auto-update for testing
VITE_ENABLE_AUTO_UPDATE=false
```

### Step 4: Deploy
1. Click "Deploy"
2. Wait for build to complete
3. Note your frontend URL: `https://your-app.vercel.app`

---

## Post-Deployment Setup

### 1. Update CORS Origins
Go back to Railway and update:
```env
CORS_ORIGINS=https://your-app.vercel.app
```

### 2. Create Admin User
SSH into Railway or use local database connection:

```sql
-- Check if admin exists
SELECT id, username, role FROM users WHERE username = 'admin';

-- Update to ADMIN role if needed
UPDATE users SET role = 'ADMIN' WHERE username = 'admin';
```

### 3. Test Everything
1. Visit `https://your-app.vercel.app`
2. Test normal gameplay
3. Visit `https://your-app.vercel.app?admin=1`
4. Login with admin credentials
5. Verify admin dashboard works

---

## Important Security Steps

### Before Going Live:
1. [OK] Change default admin password
2. [OK] Set strong JWT secrets
3. [OK] Configure ADMIN_IP_RANGES (optional but recommended)
4. [OK] Update ADMIN_REGISTRATION_KEY
5. [OK] Enable HTTPS (automatic on Railway/Vercel)

### Admin Credentials:
- Current: `admin` / `admin123`
- **CHANGE IMMEDIATELY IN PRODUCTION**

---

## Troubleshooting

### Backend Issues:
- Check Railway logs
- Verify DATABASE_URL is set
- Ensure migrations ran (check logs)

### Frontend Issues:
- Check Vercel build logs
- Verify environment variables
- Check browser console for errors

### CORS Issues:
- Ensure CORS_ORIGINS includes your frontend URL
- Check for trailing slashes
- Verify protocol (https://)

### WebSocket Issues:
- Use wss:// not ws:// for VITE_WS_URL
- Check Railway supports WebSockets (it does)

---

## Testing Checklist

- [ ] Game loads and connects
- [ ] Can create account/login
- [ ] Can place bets
- [ ] Balance updates correctly
- [ ] Admin login works
- [ ] Admin dashboard loads
- [ ] Can view users
- [ ] Can adjust balances
- [ ] Audit logs work

---

## Launch Checklist

- [ ] All tests passing
- [ ] Security configured
- [ ] Custom domain set up (optional)
- [ ] Monitoring enabled
- [ ] Backups configured
- [ ] Support contact ready

Need help? The logs are your friend!
