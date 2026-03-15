# 💕 Qalbi - GCC Dating App

A free-tier dating app for the Gulf region built with Next.js and Supabase.

## 🆓 Zero-Cost Stack

| Service | Free Tier | Limit |
|---------|-----------|-------|
| **Supabase** | Database + Auth + Storage + Realtime | 500MB DB, 1GB storage, 50K MAU |
| **Vercel** | Hosting | 100GB bandwidth |
| **Resend** | Email (optional) | 3,000 emails/month |

**This stack can handle 1,000-5,000 users at $0/month!**

---

## 🚀 Quick Deploy (15 minutes)

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up (free)
2. Click "New Project"
3. Choose a name (e.g., "qalbi-dating")
4. Set a strong database password (save it!)
5. Select region: **Bahrain (Middle East)** for GCC
6. Wait ~2 minutes for setup

### Step 2: Set Up Database

1. In Supabase dashboard, go to **SQL Editor**
2. Copy the entire contents of `supabase/schema.sql`
3. Paste and click **Run**
4. You should see "Success" for each statement

### Step 3: Configure Authentication

1. Go to **Authentication** → **Providers**
2. **Email**: Already enabled (magic link)
3. **Google** (optional):
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create OAuth credentials
   - Add redirect URL: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
   - Copy Client ID and Secret to Supabase

### Step 4: Get API Keys

1. Go to **Settings** → **API**
2. Copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Step 5: Deploy to Vercel

1. Push this code to GitHub
2. Go to [vercel.com](https://vercel.com) and sign up (free)
3. Click "Import Project" → Select your repo
4. Add Environment Variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```
5. Click **Deploy**

### Step 6: Update Auth Redirect

1. In Supabase → **Authentication** → **URL Configuration**
2. Set Site URL: `https://your-app.vercel.app`
3. Add Redirect URLs:
   - `https://your-app.vercel.app/auth/callback`
   - `http://localhost:3000/auth/callback` (for dev)

---

## 🛠️ Local Development

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/gcc-dating-app.git
cd gcc-dating-app

# Install dependencies
npm install

# Create .env.local
cp .env.example .env.local
# Edit .env.local with your Supabase keys

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 📁 Project Structure

```
gcc-dating-app/
├── app/
│   ├── page.tsx           # Main app entry
│   ├── layout.tsx         # Root layout
│   ├── globals.css        # Tailwind styles
│   └── auth/callback/     # OAuth callback
├── components/
│   ├── AuthModal.tsx      # Login/signup UI
│   ├── ProfileSetup.tsx   # Onboarding flow
│   ├── DiscoveryFeed.tsx  # Swipe cards
│   ├── MatchList.tsx      # Matches view
│   └── ChatView.tsx       # Real-time chat
├── lib/
│   └── supabase/
│       ├── client.ts      # Browser client
│       └── server.ts      # Server client
└── supabase/
    └── schema.sql         # Database schema
```

---

## ✨ Features

- ✅ Email magic link + Google OAuth
- ✅ Profile creation with GCC-relevant fields
- ✅ Swipe-based discovery (like/pass)
- ✅ Match detection
- ✅ Real-time chat with Supabase Realtime
- ✅ Mobile-responsive design
- ✅ Arabic-friendly (RTL ready)

---

## 🔜 Future Enhancements

When you need to scale beyond free tier:

| Feature | Add-on Cost |
|---------|-------------|
| SMS OTP (Twilio) | ~$0.05/SMS |
| Photo moderation (AWS Rekognition) | ~$1/1000 images |
| Push notifications (FCM) | Free |
| Custom domain | ~$10/year |
| Supabase Pro (8GB DB) | $25/month |

---

## 📱 PWA Support

To make this installable on phones, add to `app/layout.tsx`:

```tsx
<link rel="manifest" href="/manifest.json" />
```

Create `public/manifest.json`:
```json
{
  "name": "Qalbi",
  "short_name": "Qalbi",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#f43f5e",
  "background_color": "#fff1f2",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

---

## 🔒 Security Notes

- All database access uses Row Level Security (RLS)
- Users can only see/modify their own data
- Messages are only visible to match participants
- Photo URLs are public but require auth to upload

For production:
- Enable Supabase email confirmations
- Add rate limiting via Supabase Edge Functions
- Consider adding photo verification

---

## 📄 License

MIT - Use freely for your project!

---

## 🤝 Support

Built with Claude. For questions, open an issue or reach out!
