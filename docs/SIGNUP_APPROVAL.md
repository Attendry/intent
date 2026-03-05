# Signup Approval Guide

Twobrains uses Supabase Auth for authentication. By default, anyone can sign up. To require admin approval before new users can access the app, use one of the approaches below.

---

## Option 1: Invite-only (simplest)

**Best for:** Small teams, low signup volume.

1. In **Supabase Dashboard** → **Authentication** → **Providers** → **Email**
2. Turn **off** "Allow new users to sign up" (or use **Settings** → **Auth** → **User Signups**)
3. To add a user: **Authentication** → **Users** → **Add user** → enter email and optionally a temporary password
4. Supabase sends an invite email; the user sets their password and signs in

**Pros:** No code changes, full control over who gets access  
**Cons:** Manual process; no self-service "request access" flow

---

## Option 2: Approved email list (Supabase Auth Hook)

**Best for:** You want a signup form, but only approve specific emails.

Supabase supports a **Before User Created** hook that runs before each signup. You can reject signups unless the email is in an approved list.

### Setup

1. **Create an approved-emails table** (run in Supabase SQL Editor):

```sql
CREATE TABLE IF NOT EXISTS public.approved_signups (
  email TEXT PRIMARY KEY,
  added_at TIMESTAMPTZ DEFAULT now()
);

-- Add your approved emails
INSERT INTO public.approved_signups (email) VALUES
  ('you@example.com'),
  ('teammate@example.com')
ON CONFLICT (email) DO NOTHING;
```

2. **Create a Supabase Edge Function** or **HTTP endpoint** that:
   - Receives the hook payload (contains `user.email`)
   - Queries `approved_signups` for that email
   - Returns `{}` (200) to allow, or `{ "error": { "message": "Signup requires approval. Contact admin." } }` (4xx) to reject

3. **Configure the hook** in Supabase:
   - **Authentication** → **Hooks** → **Before user created**
   - Set the HTTP URL to your Edge Function or API route

### Example Edge Function (Deno)

```typescript
// supabase/functions/before-user-created/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const { user } = await req.json();
  const email = user?.email?.toLowerCase();
  if (!email) {
    return new Response(
      JSON.stringify({ error: { message: "Invalid request" } }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { data } = await supabase
    .from("approved_signups")
    .select("email")
    .eq("email", email)
    .single();

  if (!data) {
    return new Response(
      JSON.stringify({
        error: {
          message: "Signup requires approval. Please contact the administrator.",
        },
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({}), { status: 200 });
});
```

**Pros:** Self-service signup form; only approved emails succeed  
**Cons:** Requires maintaining the approved list; Edge Function setup

---

## Option 3: Request access + manual approval

**Best for:** You want to see who requested access and approve them manually.

1. Replace the signup flow with a "Request access" form that:
   - Does **not** call `supabase.auth.signUp()`
   - Instead, saves the email to a `pending_signups` table (or similar)
   - Shows: "We'll review your request and email you when approved."

2. Build a simple admin page (or use Supabase Table Editor) to:
   - List pending requests
   - Approve: add the email to `approved_signups` (if using Option 2), or manually create the user in Supabase (Option 1)

3. When approving: either send an invite via Supabase, or tell the user to try signing up again (if you use Option 2's hook).

**Pros:** Visibility into who wants access; approval workflow  
**Cons:** More custom code; two-step flow for users

---

## Recommendation

- **Quickest:** Use **Option 1** (invite-only). Disable signups in Supabase and add users manually.
- **More flexible:** Use **Option 2** with an approved-emails table. Add emails when you approve someone; they can then sign up via the normal form.

For Option 2, see [Supabase Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook) for full details.
