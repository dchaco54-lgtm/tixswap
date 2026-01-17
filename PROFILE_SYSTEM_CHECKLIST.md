# ✅ Implementation Checklist: Profile System

Use this checklist to track implementation progress.

---

## 📋 Pre-Implementation (Already Done ✅)

- [x] Created `lib/profileActions.js` - 6 server actions
- [x] Created `components/ProfileChangeModal.jsx` - Modal for email/rut changes
- [x] Created `components/AvatarUploadSection.jsx` - Avatar upload component
- [x] Created `components/OnboardingModal.jsx` - Onboarding for incomplete profiles
- [x] Modified `app/dashboard/page.jsx` - Full integration
- [x] Created `MIGRATION_PROFILES.sql` - Database migration
- [x] Created documentation (setup, quick start, troubleshooting, complete guide)
- [x] Tested all files for syntax errors - ✅ No errors found

---

## 🚀 Implementation Checklist (You Need to Do This)

### Step 1: Database Migration

**⏱️ Time: 2 minutes**

- [ ] Open Supabase Dashboard
- [ ] Go to SQL Editor
- [ ] Copy entire content of `MIGRATION_PROFILES.sql`
- [ ] Paste into SQL Editor
- [ ] Click ▶️ (Execute)
- [ ] Verify no errors appear
- [ ] Go to Table Editor → profiles
- [ ] Confirm `avatar_url` column exists (TEXT NULL)
- [ ] Confirm `status` column exists (TEXT DEFAULT 'online')
- [ ] Verify CHECK constraint on status

**If you see errors:**
```
→ Check PROFILE_SYSTEM_TROUBLESHOOTING.md → Section 3
```

---

### Step 2: Create Storage Bucket

**⏱️ Time: 1 minute**

- [ ] Open Supabase Dashboard
- [ ] Go to Storage
- [ ] Click "New Bucket"
- [ ] Name: `avatars`
- [ ] Privacy: **Public**
- [ ] Click Create
- [ ] Verify bucket appears in list

**If bucket is Private:**
- [ ] Click bucket gear icon ⚙️
- [ ] Change privacy to Public
- [ ] Save

**If bucket doesn't work:**
```
→ Check PROFILE_SYSTEM_TROUBLESHOOTING.md → Section 2
```

---

### Step 3: Environment Variables

**⏱️ Time: 1 minute**

- [ ] Open `.env.local` in project
- [ ] Add line: `SUPABASE_SERVICE_ROLE_KEY=[YOUR_KEY]`
- [ ] Get key from Supabase → Settings → API → Service Role Key
- [ ] Copy the full key
- [ ] Paste into `.env.local`
- [ ] Save file
- [ ] Restart dev server: `npm run dev`

**Verify in Terminal:**
```
✅ No "SUPABASE_SERVICE_ROLE_KEY not found" errors
```

---

### Step 4: Verify File Structure

**⏱️ Time: 1 minute**

- [ ] Check `lib/profileActions.js` exists
- [ ] Check `components/ProfileChangeModal.jsx` exists
- [ ] Check `components/AvatarUploadSection.jsx` exists
- [ ] Check `components/OnboardingModal.jsx` exists
- [ ] Check `app/dashboard/page.jsx` was modified
- [ ] Check `MIGRATION_PROFILES.sql` exists

```bash
# Run this in terminal to verify:
find . -name "profileActions.js" -o -name "ProfileChangeModal.jsx" | head -5
```

---

## 🧪 Testing Checklist

### Test 1: Basic Profile Editing

**⏱️ Time: 3 minutes**

- [ ] Login to dashboard
- [ ] Go to "Mi perfil" tab
- [ ] Click "Editar"
- [ ] Change name to "Test User" (10 chars)
- [ ] Click "Guardar"
- [ ] ✅ Should see "Perfil actualizado ✅"
- [ ] Reload page
- [ ] ✅ Name should still be "Test User"

**If name doesn't save:**
```
→ Check PROFILE_SYSTEM_TROUBLESHOOTING.md → Section 5
```

### Test 2: Name Validation

**⏱️ Time: 2 minutes**

- [ ] Click "Editar" again
- [ ] Try to save with name "AB" (1 char)
- [ ] ✅ Should see error "entre 3 y 40"
- [ ] Clear and type "This is a very long name that exceeds forty characters exactly" (60+ chars)
- [ ] ✅ Should see error again
- [ ] Type "Valid Name" (10 chars)
- [ ] Save ✅

### Test 3: Avatar Upload

**⏱️ Time: 3 minutes**

- [ ] Click "Editar"
- [ ] Scroll to Avatar section
- [ ] Click "Cambiar"
- [ ] Select JPG file from computer
- [ ] ✅ Should see preview
- [ ] Click "Guardar" (or it saves auto)
- [ ] ✅ Should see "Avatar actualizado ✅"
- [ ] Reload page
- [ ] ✅ Avatar should still be visible

**If avatar doesn't upload:**
```
→ Check PROFILE_SYSTEM_TROUBLESHOOTING.md → Section 7 (Avatar)
```

### Test 4: Avatar Validation

**⏱️ Time: 2 minutes**

- [ ] Click "Cambiar" in Avatar
- [ ] Try to select a 10MB video file
- [ ] ✅ Should see error "debe pesar menos de 2MB"
- [ ] Try to select a PDF file
- [ ] ✅ Should see error "Solo se permiten JPG, PNG o WebP"
- [ ] Select valid JPG/PNG
- [ ] ✅ Should upload

### Test 5: Status Dropdown

**⏱️ Time: 2 minutes**

- [ ] Click "Editar"
- [ ] Scroll to Estado section (visible only in edit mode)
- [ ] Select "Ocupado" from dropdown
- [ ] Click "Guardar"
- [ ] ✅ Should see "Perfil actualizado ✅"
- [ ] Reload page
- [ ] ✅ Should show "🔴 Ocupado"
- [ ] Click Edit → Change to "Ausente"
- [ ] ✅ Should show "🟡 Ausente"

### Test 6: Email Change Request

**⏱️ Time: 3 minutes**

- [ ] In "Mi perfil", click "Cambiar" next to Email
- [ ] ✅ Should see ProfileChangeModal
- [ ] Type new email: `test123@example.com`
- [ ] Type reason: `Testing email change`
- [ ] Click "Solicitar cambio"
- [ ] ✅ Should see success message
- [ ] Go to Supabase → Table Editor → support_tickets
- [ ] ✅ Should see new row with:
  - subject: "Solicitud cambio de EMAIL - test123@example.com"
  - status: "abierto"
  - category: "cambio_datos"

### Test 7: Anti-Duplicado (Email)

**⏱️ Time: 2 minutes**

- [ ] Click "Cambiar" email again
- [ ] Try same email: `test123@example.com`
- [ ] Click "Solicitar cambio"
- [ ] ✅ Should see error: "Ya tienes un ticket abierto para cambio de email"
- [ ] ✅ No new ticket created in support_tickets

**Cleanup:**
- [ ] In Supabase, delete the test ticket from support_tickets
- [ ] Or change its status to 'cerrado'

### Test 8: RUT Change Request

**⏱️ Time: 2 minutes**

- [ ] Click "Cambiar" next to RUT
- [ ] ✅ Should see ProfileChangeModal
- [ ] Type new RUT: `12.345.678-9`
- [ ] Click "Solicitar cambio"
- [ ] ✅ Should see success message
- [ ] Check support_tickets
- [ ] ✅ Should see new row with subject containing RUT

### Test 9: Onboarding Modal

**⏱️ Time: 3 minutes**

**Setup (one-time):**
- [ ] In Supabase, find your user in profiles table
- [ ] Edit `full_name` → Clear it → Save (leave empty)

**Test:**
- [ ] Reload dashboard
- [ ] ✅ OnboardingModal should appear automatically
- [ ] Read the 3 steps (name, avatar, status)
- [ ] Click "Ir a mi perfil"
- [ ] ✅ Should close modal and open edit mode
- [ ] Type a name
- [ ] Click "Guardar"
- [ ] ✅ Modal should not appear again on reload

### Test 10: Blocked Account Banner

**⏱️ Time: 2 minutes**

**Setup:**
- [ ] In Supabase, in your profile row
- [ ] Add column `is_blocked = true` (if column exists)
- [ ] Or set `is_blocked` to true manually

**Test:**
- [ ] Reload dashboard
- [ ] ✅ Should see red banner: "🚫 Tu cuenta está bloqueada"
- [ ] Message: "Contáctanos a soporte..."

**Cleanup:**
- [ ] Set `is_blocked = false` again

---

## 🔍 Code Review Checklist

- [ ] `lib/profileActions.js` - Review all server actions
  - [ ] `getCurrentProfile()` returns full profile
  - [ ] `updateProfile()` validates name (3-40), status values
  - [ ] `uploadAvatar()` validates file size and type
  - [ ] `createProfileChangeTicket()` has anti-duplicado logic
  - [ ] `findOpenChangeTicket()` searches correctly

- [ ] `app/dashboard/page.jsx` - Integration points
  - [ ] Imports all 4 components correctly
  - [ ] `useEffect` loads profile with new fields
  - [ ] Edit state includes new fields (draftFullName, draftStatus)
  - [ ] saveProfile() calls updateProfile() action
  - [ ] Modal callbacks work (ProfileChangeModal, OnboardingModal)

- [ ] Components - Rendering
  - [ ] ProfileChangeModal renders correctly
  - [ ] AvatarUploadSection shows preview
  - [ ] OnboardingModal displays on load

---

## 🚀 Production Deployment Checklist

Before deploying to production:

- [ ] All tests above passed ✅
- [ ] No console errors in DevTools
- [ ] No SQL errors in Supabase logs
- [ ] Avatar upload works to Storage
- [ ] Tickets are created in support_tickets
- [ ] Environment variables set in deployment platform (Vercel/Netlify)
- [ ] Database migration applied to production database
- [ ] Bucket 'avatars' created in production Storage
- [ ] All 5 files present in production codebase
- [ ] Tested at least one complete flow (profile edit → save)

---

## 📊 Completion Tracker

Use this to track overall progress:

```
Pre-Implementation:   ████████████████████ 100% ✅
Database Setup:       □□□□□□□□□□ 0% (YOU ARE HERE)
Environment:          □□□□□□□□□□ 0%
Testing:              □□□□□□□□□□ 0%
Production Deploy:    □□□□□□□□□□ 0%

Total: ████░░░░░░░░░░░░░░░░ 20% (3/15 steps done)
```

---

## 🎯 Next Steps

1. **Start Setup**: Begin with "Step 1: Database Migration"
2. **Follow Checklist**: Go through each step in order
3. **Run Tests**: Complete "Testing Checklist" section
4. **Deploy**: When all tests pass, push to production

---

## 📞 Getting Help

If you get stuck:

1. **Check error message** in console or terminal
2. **Search**: PROFILE_SYSTEM_TROUBLESHOOTING.md
3. **Verify**: This checklist step by step
4. **Debug**: Add console.log() to see what's happening
5. **Reset**: Delete test data and start fresh

---

## ✅ Sign-Off

When all items are checked:

```
Date completed: _______________
Tested by: _______________
Ready for production: YES / NO
```

---

**Good luck! 🚀**

If you need help, the troubleshooting guide has solutions for the most common issues.
