# HQT Internal Cloud (Vercel demo)

## Deploy
1. Set environment variables in Vercel:
   - SUPABASE_URL
   - SUPABASE_SERVICE_ROLE_KEY
   - JWT_SECRET
2. Push to GitHub and import into Vercel.

## Notes
- Uses Supabase Auth for login and a `profiles` table for role assignment.
- Drive state & uploads are in-memory for demo; replace with Supabase DB/storage for persistence.
