# 🎨 Profile System Architecture & Data Flow

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        TixSwap Dashboard                         │
│                  /app/dashboard/page.jsx                         │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              "Mi Perfil" Tab                              │  │
│  │                                                            │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │ Banner: Account Blocked (if is_blocked=true)      │ │  │
│  │  │ Banner: Open Ticket (if cambio_datos ticket open)  │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │                                                            │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │ Avatar Section (AvatarUploadSection.jsx)           │ │  │
│  │  │ - Upload/preview/delete                            │ │  │
│  │  │ - Max 2MB, JPG/PNG/WebP                            │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │                                                            │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │ Name Field (editable)                              │ │  │
│  │  │ - 3-40 character validation                         │ │  │
│  │  │ - Validation shown: X/40                           │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │                                                            │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │ Email Field                                         │ │  │
│  │  │ - Editable inline (if editing)                      │ │  │
│  │  │ - "Cambiar" button → ProfileChangeModal.jsx         │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │                                                            │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │ RUT Field                                           │ │  │
│  │  │ - Read-only inline                                  │ │  │
│  │  │ - "Cambiar" button → ProfileChangeModal.jsx         │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │                                                            │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │ Phone Field (editable)                              │ │  │
│  │  │ - Free text input                                   │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │                                                            │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │ Status Dropdown (edit mode only)                    │ │  │
│  │  │ - 🟢 online                                         │ │  │
│  │  │ - 🔴 busy                                          │ │  │
│  │  │ - 🟡 away                                          │ │  │
│  │  │ - ⚫ invisible                                      │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │                                                            │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │ Category Badge (read-only)                          │ │  │
│  │  │ - Based on user tier                                │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │                                                            │  │
│  │  Edit/Guardar/Cancelar buttons                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  + OnboardingModal (appears if full_name is empty)              │
│  + ProfileChangeModal (for email/rut changes)                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

### 1. Profile Load Flow

```
User Login
    ↓
/dashboard loads
    ↓
useEffect → getCurrentProfile() [server action]
    ↓
Supabase: SELECT profiles WHERE id = user.id
    ↓
Load data:
  - full_name
  - email, phone
  - avatar_url
  - status
  - role, tier, is_blocked
    ↓
Set state: profile, draftEmail, draftPhone, draftFullName, draftStatus
    ↓
If full_name is empty → Show OnboardingModal
    ↓
Check findOpenChangeTicket('email' and 'rut')
    ↓
If exists → Show "Open Ticket" banner
    ↓
Dashboard renders with all data loaded
```

### 2. Profile Edit Flow

```
User clicks "Editar" button
    ↓
setEditing(true)
draftFullName = profile.full_name
draftEmail = profile.email
draftPhone = profile.phone
draftStatus = profile.status
    ↓
UI shows input fields instead of display text
UI shows Status dropdown
UI shows AvatarUploadSection
    ↓
User makes changes to:
  - draftFullName
  - draftEmail
  - draftPhone
  - draftStatus
    ↓
User clicks "Guardar"
    ↓
saveProfile() called
    ↓
Validations:
  ✓ fullName 3-40 chars
  ✓ email not empty
  ✓ status in allowed list
    ↓
updateProfile({full_name, email, phone, status}) [server action]
    ↓
Supabase: UPDATE profiles SET ... WHERE id = user.id
    ↓
Return updated profile
    ↓
setProfile(updatedProfile)
setEditing(false)
Show success message
    ↓
User can now see updated values in display mode
```

### 3. Avatar Upload Flow

```
User clicks "Cambiar" in Avatar section
    ↓
<input type="file"> click triggered
    ↓
File selected:
  - Validate: size ≤ 2MB
  - Validate: type in [JPG, PNG, WebP]
    ↓
uploadAvatar(file, userId) [server action]
    ↓
Upload to Supabase Storage:
  Path: avatars/{userId}/{filename}
    ↓
Get public URL:
  https://[PROJECT].supabase.co/storage/v1/object/public/avatars/...
    ↓
Return avatarUrl
    ↓
Store in profiles.avatar_url
    ↓
Update UI preview
Show success message: "Avatar actualizado ✅"
    ↓
Avatar visible immediately with public URL
```

### 4. Email/RUT Change Request Flow

```
User clicks "Cambiar" button (email or RUT)
    ↓
Open ProfileChangeModal
showChangeModal = 'email' or 'rut'
    ↓
Modal shows:
  - Input for new value
  - Optional reason field
    ↓
User enters value and clicks "Solicitar cambio"
    ↓
createProfileChangeTicket(field, requestedValue, reason) [server action]
    ↓
Validations:
  ✓ requestedValue not empty
  ✓ For RUT: validate format
  ✓ No duplicate tickets
    ↓
findOpenChangeTicket(field) → Check if exists
    ↓
IF exists:
  Return error: "Ya tienes un ticket abierto..."
    ↓
ELSE:
  Insert into support_tickets:
    - category = 'cambio_datos'
    - subject = 'Solicitud cambio de EMAIL - new@email.com'
    - message = 'Solicito cambiar mi email a: ...'
    - requester_email = user.email
    - requester_name = profile.full_name
    - requester_rut = profile.rut
    - status = 'abierto'
    ↓
Close modal
Show success: "Solicitud creada ✅"
    ↓
Show banner: "Tienes una solicitud pendiente"
    ↓
Admin reviews ticket and:
  - Updates profiles table manually
  - Changes ticket status to 'cerrado'
```

### 5. Onboarding Flow

```
New user logs in
    ↓
profile.full_name is empty/null
    ↓
useEffect detects: !profile?.full_name
    ↓
setShowOnboarding(true)
    ↓
OnboardingModal renders
Shows 3 steps:
  1. 📝 Nombre
  2. 🖼️  Avatar
  3. 🟢 Estado
    ↓
User clicks "Ir a mi perfil"
    ↓
setShowOnboarding(false)
setEditing(true) ← Opens edit mode
    ↓
User edits name, avatar, status
    ↓
User clicks "Guardar"
    ↓
saveProfile() → updateProfile()
    ↓
setEditing(false)
    ↓
Modal doesn't appear again (profile has name now)
```

---

## Component Communication

```
┌─────────────────────────────────────────────────────────────┐
│  app/dashboard/page.jsx (Parent)                             │
│                                                              │
│  State:                                                      │
│  - profile, user                                             │
│  - editing, draftFullName, draftEmail, draftPhone, draftStatus
│  - showChangeModal, showOnboarding                           │
│  - openChangeTicket                                          │
│                                                              │
│  ┌──────────────────────┐                                   │
│  │ AvatarUploadSection  │ ← avatarUrl, userId              │
│  │ (component)          │ → onSuccess(avatarUrl)            │
│  │                      │                                    │
│  │ Calls:               │                                    │
│  │ - uploadAvatar()     │                                    │
│  │ - deleteAvatar()     │                                    │
│  └──────────────────────┘                                   │
│                                                              │
│  ┌──────────────────────┐                                   │
│  │ProfileChangeModal    │ ← field, currentValue             │
│  │ (component)          │ → onClose(), onSuccess()          │
│  │                      │                                    │
│  │ Calls:               │                                    │
│  │ - createProfileChange│                                    │
│  │   Ticket()           │                                    │
│  └──────────────────────┘                                    │
│                                                              │
│  ┌──────────────────────┐                                   │
│  │ OnboardingModal      │ ← onComplete()                    │
│  │ (component)          │ → onClick "Ir a mi perfil"        │
│  │                      │                                    │
│  │ Calls:               │                                    │
│  │ - setShowOnboarding()│                                    │
│  │ - setEditing()       │                                    │
│  └──────────────────────┘                                    │
│                                                              │
│  Calls (server actions):                                    │
│  - getCurrentProfile()                                      │
│  - updateProfile()                                          │
│  - findOpenChangeTicket()                                   │
│  - uploadAvatar()                                           │
│  - deleteAvatar()                                           │
│  - createProfileChangeTicket()                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema

```
┌─────────────────────────────┐
│       profiles              │
├─────────────────────────────┤
│ id (UUID) [PK]              │
│ email (TEXT, UNIQUE)        │
│ full_name (TEXT, 3-40)      │
│ rut (TEXT, UNIQUE if not null)│
│ phone (TEXT)                │
│ avatar_url (TEXT, nullable) │ ← NEW
│ status (TEXT, default)      │ ← NEW
│ role (TEXT)                 │
│ tier (TEXT)                 │
│ is_blocked (BOOLEAN)        │
│ created_at (TIMESTAMP)      │
│ updated_at (TIMESTAMP)      │
└─────────────────────────────┘
         ↑
         │ uses
         │
┌──────────────────────────────────┐
│    support_tickets               │
├──────────────────────────────────┤
│ id (UUID) [PK]                   │
│ category (TEXT = 'cambio_datos') │
│ subject (TEXT)                   │
│ message (TEXT)                   │
│ status (TEXT = 'abierto')        │
│ requester_email (TEXT)           │
│ requester_name (TEXT)            │
│ requester_rut (TEXT)             │
│ created_at (TIMESTAMP)           │
│ updated_at (TIMESTAMP)           │
└──────────────────────────────────┘
```

---

## Storage Structure

```
Supabase Storage
│
└── avatars (bucket, PUBLIC)
    │
    └── {userId} (folder)
        │
        ├── {userId}-1234567890.jpg
        │   URL: https://[PROJECT].supabase.co/storage/v1/object/public/avatars/{userId}/...
        │
        ├── {userId}-1234567891.png
        │   (old avatar, can be deleted)
        │
        └── ...
```

---

## Validation Rules Summary

```
Name:
  ├─ Min 3 characters
  ├─ Max 40 characters
  └─ Trimmed (spaces removed)

Email:
  ├─ Valid email format
  ├─ Unique in profiles
  └─ Required

Phone:
  ├─ Optional
  ├─ Free format
  └─ Trimmed

Status:
  ├─ Must be: 'online' | 'busy' | 'away' | 'invisible'
  └─ Default: 'online'

Avatar:
  ├─ Max size: 2MB
  ├─ Types: image/jpeg, image/png, image/webp
  ├─ Uploaded to: avatars/{userId}/{filename}
  └─ URL stored in: profiles.avatar_url

RUT:
  ├─ Unique if not null
  ├─ Change requires ticket
  ├─ Anti-duplicado: max 1 open ticket
  └─ Status: 'cambio_datos'

Email Change:
  ├─ Change requires ticket
  ├─ Anti-duplicado: max 1 open ticket
  ├─ Category: 'cambio_datos'
  └─ Status: 'abierto'
```

---

## Error Handling Flow

```
User Action
    ↓
Validation fails?
    ├─ YES → Show error message
    │         Modal stays open
    │         User can retry
    │
    └─ NO → Proceed
          ↓
       Server Action called
          ↓
       Server validation fails?
          ├─ YES → Return error result
          │        Show in modal
          │        User can retry
          │
          └─ NO → Database update succeeds
                ↓
             Return success
                ↓
             Update UI
             Show success message
             Close modal
```

---

## Performance Optimizations

```
✅ Avatar Upload:
   - Compressed at upload time
   - CDN delivery via Supabase Storage
   - Lazy load image in preview

✅ Profile Fetch:
   - Single query with select()
   - Loaded once on mount
   - Cached in state

✅ Server Actions:
   - No N+1 queries
   - Minimal roundtrips
   - Single update per save

✅ Components:
   - Only re-render on state change
   - Modals not rendered until needed
   - useEffect cleanup
```

---

## Security Layers

```
Layer 1: Client Side
  ├─ Input validation (format, length)
  └─ Type validation (email, etc)

Layer 2: Network (HTTPS)
  └─ Encrypted transmission

Layer 3: Server Actions
  ├─ Auth check (user session required)
  ├─ Input sanitization (trim, validate)
  └─ Constraint checks (size, type)

Layer 4: Database
  ├─ RLS Policies
  ├─ CHECK constraints
  └─ UNIQUE indexes

Layer 5: Storage
  ├─ Bucket policies
  ├─ File type validation
  └─ Size limits
```

---

This architecture ensures:
- ✅ Data consistency
- ✅ User validation
- ✅ Secure storage
- ✅ Clear error handling
- ✅ Scalable design
