# Testing Checklist: Auth Loop Fix + Onboarding Implementation

**Status:** Ready for manual testing
**Components:** PKCE Callback + OnboardingWelcomeModal + Rate-Limiting
**Deployment:** Execute SQL migration in Supabase first

---

## 📋 Pre-Testing Checklist

### Database Migration
- [ ] Execute SQL migration in Supabase SQL Editor (copy from MIGRATION_ONBOARDING_COMPLETE.sql)
- [ ] Verify 4 columns created: `email_confirmed`, `onboarding_completed`, `onboarding_dismissed_at`, `onboarding_completed_at`
- [ ] Verify 3 indexes created

### Code Verification
- [ ] Dashboard imports updated (OnboardingWelcomeModal instead of OnboardingModal)
- [ ] Dashboard state uses `useOnboardingLogic` hook
- [ ] Dashboard rendering uses `shouldShowOnboarding` from hook
- [ ] API endpoints created: `/api/profile/onboarding-dismiss/route.ts`, `/api/profile/onboarding-complete/route.ts`
- [ ] Route handler exists: `app/auth/callback/route.ts` (PKCE implementation)
- [ ] Old callback page deprecated: `app/auth/callback/page.jsx.deprecated`

### Supabase Configuration
- [ ] Email template verified with `{{ .ConfirmationURL }}`
- [ ] Redirect URLs configured: `https://www.tixswap.cl/auth/callback`
- [ ] Test Supabase project ready for local testing

---

## 🧪 Test Scenario 1: Email Confirmation (Fix Infinite Loop)

### Setup
- Clear browser cache/cookies for localhost:3000
- Have email client ready (test email account)

### Steps
1. **Register new user:**
   - Go to `http://localhost:3000/register`
   - Enter: Email, Password (strong), Full Name, Accept T&Cs
   - Click "Crear Cuenta"
   - Expected: "Check your email" message

2. **Receive confirmation email:**
   - Open test email account
   - Find email from "noreply@tixswap.cl" with subject "Confirm your signup"
   - Click "Confirm my account" link or use `{{ .ConfirmationURL }}`
   - Expected: Link redirects to `https://www.tixswap.cl/auth/callback?code=xxx&state=xxx`

3. **Callback processing (CRITICAL - This is the fix):**
   - URL should land on route handler: `app/auth/callback/route.ts`
   - Route handler exchanges code for session (PKCE flow)
   - Auto-creates profile in Supabase
   - Expected: Redirects to `/dashboard` (NOT stuck on callback)
   - Expected: No "Verificando sesión..." spinner > 2 seconds

4. **Dashboard loads:**
   - Should see profile data (name, avatar, settings, etc.)
   - Expected: OnboardingWelcomeModal appears with Step 0 (Welcome intro)

### Success Criteria
- ✅ NO infinite loop / NO "Verificando sesión..." stuck
- ✅ Redirect to /dashboard succeeds
- ✅ Onboarding modal appears
- ✅ Profile auto-created in Supabase (check `public.profiles` table)

### Failure Diagnosis
- If stuck on `/auth/callback?code=...`: Check route.ts file exists and is TypeScript
- If "Verificando sesión...": Check middleware.js uses createMiddlewareClient with cookies
- If modal doesn't appear: Check profile.onboarding_completed = false in DB
- If 404 on callback: Ensure route handler is at `app/auth/callback/route.ts` (NOT page.jsx)

---

## 🎯 Test Scenario 2: Onboarding Modal Steps

### Setup
- User just confirmed email and dashboard is open with modal visible
- Modal should show "Step 0: Welcome" with 3 icon preview

### Steps

**Step 0: Welcome Screen**
1. Modal shows: "Bienvenido a TixSwap" message
2. Shows 3 icons: Photo, Wallet, Explore
3. Buttons: "Comenzar" (next step) | "Actualizar Más Tarde" (dismiss)
4. Progress bar shows: 0/3 steps

**Step 1: Upload Photo**
1. Click "Comenzar"
2. Modal shows "Step 1: Sube tu foto de perfil"
3. File upload input appears
4. Progress bar: 1/3
5. Button: "Siguiente" (next)

**Step 2: Connect Wallet**
1. Click "Siguiente"
2. Modal shows "Step 2: Conecta tu billetera"
3. Text explains wallet benefits
4. Button: "Conectar Wallet" (placeholder - no actual wallet logic)
5. Progress bar: 2/3

**Step 3: Explore Events**
1. Click "Conectar Wallet"
2. Modal shows "Step 3: Explora eventos"
3. Button: "Completar Onboarding"
4. Progress bar: 3/3

**Final: Onboarding Completed**
1. Click "Completar Onboarding"
2. Modal closes
3. Expected: `onboarding_completed = true` set in DB
4. Expected: `onboarding_completed_at = NOW()` in DB

### Success Criteria
- ✅ All steps display correctly
- ✅ Progress bar updates on each step
- ✅ Modal is responsive (not too wide on mobile)
- ✅ ESC key closes modal (triggers dismiss, not complete)
- ✅ DB fields update when completing

### Expected DB State After Completion
```sql
-- In public.profiles for this user:
onboarding_completed = true
onboarding_completed_at = 2024-XX-XX HH:MM:SS (recent timestamp)
onboarding_dismissed_at = NULL (or previous value)
```

---

## ⏱️ Test Scenario 3: Rate-Limiting (1x/day Dismiss)

### Setup
- User has completed scenario 2 OR dismissed modal once
- Track timestamps in Supabase

### Scenario 3A: First Dismiss
1. Open dashboard with modal visible
2. Click "Actualizar Más Tarde" (dismiss button)
3. Expected: Modal closes
4. Expected: `onboarding_dismissed_at = NOW()` in DB
5. Reload page: Modal should NOT appear
6. Expected: Hook detects `< 24 hours` and returns `shouldShow = false`

### Scenario 3B: After 24+ Hours
1. Manually update DB (simulate next day):
   ```sql
   UPDATE public.profiles 
   SET onboarding_dismissed_at = NOW() - INTERVAL '25 hours'
   WHERE id = '{user_id}';
   ```
2. Reload dashboard
3. Expected: Modal appears again
4. Expected: Hook calculates `hoursAgo > 24` and returns `shouldShow = true`

### Scenario 3C: Never Show If Completed
1. User has `onboarding_completed = true`
2. Reload dashboard any number of times
3. Expected: Modal NEVER appears
4. Expected: Hook returns `shouldShow = false` (first condition checked)

### Success Criteria
- ✅ Dismiss sets `onboarding_dismissed_at` timestamp
- ✅ Modal doesn't reappear within 24 hours
- ✅ Modal reappears after 24+ hours
- ✅ Completed state is permanent (modal never shows again)
- ✅ Rate-limiting works across page reloads

---

## 📱 Test Scenario 4: Mobile Responsiveness

### Setup
- Chrome DevTools: Toggle Device Toolbar
- Test devices: iPhone 12 (390px), iPad (768px)

### iPhone 12 View (390px)
1. Modal should be full-width with left/right padding (~12px each)
2. Modal content grid should stack vertically (2 columns → 1 column)
3. Buttons should stack vertically (not side-by-side)
4. Text should be readable (16px+ font size)
5. Step icons should be appropriately sized

### iPad View (768px)
1. Modal should max-width ~600px and be centered
2. 2-column grid should display normally
3. Buttons can be side-by-side
4. All content readable without horizontal scroll

### Success Criteria
- ✅ No horizontal scrolling on mobile
- ✅ All content readable on small screens
- ✅ Buttons tappable (48px+ height)
- ✅ Modal backdrop visible on mobile
- ✅ Modal doesn't cover essential content

---

## 🔧 API Endpoint Testing (Optional - Advanced)

### Endpoint 1: POST /api/profile/onboarding-dismiss
```bash
curl -X POST http://localhost:3000/api/profile/onboarding-dismiss \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=..." \
  -d '{"userId": "user-uuid"}'
```
Expected: 200 OK, sets `onboarding_dismissed_at`

### Endpoint 2: POST /api/profile/onboarding-complete
```bash
curl -X POST http://localhost:3000/api/profile/onboarding-complete \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=..." \
  -d '{"userId": "user-uuid"}'
```
Expected: 200 OK, sets `onboarding_completed = true`

---

## 📊 Final Verification Checklist

### Code Changes Verification
- [ ] No payment/fees/webpay code touched
- [ ] No checkout flow modified
- [ ] Auth code isolated to `app/auth/*` and `lib/supabase/*`
- [ ] Only dashboard and profile endpoints modified (expected)
- [ ] TypeScript files compile without errors
- [ ] JavaScript files have no syntax errors

### Database Verification
```sql
-- Run in Supabase SQL Editor:
SELECT 
  id, 
  email, 
  full_name,
  email_confirmed, 
  onboarding_completed, 
  onboarding_dismissed_at,
  onboarding_completed_at
FROM public.profiles
WHERE id = '{test-user-id}'
LIMIT 1;
```

### File Structure Verification
```
✅ app/auth/callback/route.ts (NEW - PKCE handler)
✅ components/OnboardingWelcomeModal.jsx (NEW - 4-step modal)
✅ hooks/useOnboardingLogic.js (NEW - rate-limiting logic)
✅ app/api/profile/onboarding-dismiss/route.ts (NEW - API)
✅ app/api/profile/onboarding-complete/route.ts (NEW - API)
✅ app/dashboard/page.jsx (MODIFIED - uses hook + new modal)
✅ app/auth/callback/page.jsx.deprecated (RENAMED)
```

---

## 🚀 Deployment Checklist

### Before Production Deploy
- [ ] All testing scenarios pass locally
- [ ] No console errors in DevTools (F12)
- [ ] Network tab shows no 404s or 500s
- [ ] Rate-limiting tested (24h cooldown)
- [ ] Mobile responsiveness verified
- [ ] Database migration executed in prod Supabase

### Git Workflow
```bash
# 1. Stage all changes
git add -A

# 2. Commit with descriptive message
git commit -m "feat: fix auth infinite loop with PKCE callback + implement onboarding modal with rate-limiting

- Replace implicit flow with PKCE server-side callback (route.ts)
- Auto-create profile on email confirmation
- Add OnboardingWelcomeModal (4-step tour)
- Implement 24h rate-limiting for dismissed state
- Add database fields: email_confirmed, onboarding_completed, onboarding_dismissed_at, onboarding_completed_at
- Create API endpoints: /api/profile/onboarding-dismiss, /api/profile/onboarding-complete
- Update dashboard integration with useOnboardingLogic hook
- Maintain backward compatibility; no payment/checkout code touched"

# 3. Push to main
git push origin main

# 4. Monitor Vercel build
# Check: https://vercel.com/tixswap-production
```

### Post-Deployment Validation
- [ ] Vercel build succeeds (check deployment logs)
- [ ] Email confirmation flow works (test with prod Supabase)
- [ ] Modal appears on first visit to dashboard
- [ ] Rate-limiting works in production
- [ ] No errors in Vercel production logs

---

## 📞 Troubleshooting

| Issue | Root Cause | Solution |
|-------|-----------|----------|
| "Verificando sesión..." infinite loop | Middleware using cookies, client using localStorage | ✅ Fixed: route.ts sets cookies, middleware reads them |
| Modal doesn't appear | `onboarding_completed = true` OR `onboarding_dismissed_at < 24h ago` | Check DB values, manually reset if testing |
| 404 on /auth/callback | File is `page.jsx` not `route.ts` | Rename to `route.ts`, remove `page.jsx.deprecated` |
| "showOnboarding is not defined" | Dashboard still references old state | Update render logic to use `shouldShowOnboarding` from hook |
| SQL migration fails | Columns already exist | Use `IF NOT EXISTS` (migration has this) |
| Rate-limit not working | `onboarding_dismissed_at` not set | Check API endpoint response, verify auth headers sent |
| Modal not responsive on mobile | CSS grid not using responsive classes | Check Tailwind responsive prefixes (md:, lg:) |

---

## ✅ Success Criteria (All Must Pass)

1. ✅ Email confirmation → Dashboard (no infinite loop)
2. ✅ Onboarding modal appears on first dashboard visit
3. ✅ Modal steps progress correctly (0→1→2→3→complete)
4. ✅ Modal can be dismissed
5. ✅ Dismiss triggers 24h rate-limit
6. ✅ Complete sets permanent `onboarding_completed = true`
7. ✅ Mobile responsive (full-width on mobile, max-width on desktop)
8. ✅ No payment/checkout code modified
9. ✅ All files created and dashboard updated
10. ✅ Build succeeds (npm run build or Vercel)

---

**Ready for testing!** Execute database migration first, then follow scenarios 1-4 in order.
