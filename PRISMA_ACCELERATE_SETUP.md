# Deprecated\n\nThis document predates the Cloud SQL Node.js connector rollout (see local_accelerate_workflow.md). Keep for historical reference only.\n\n# Prisma Accelerate Setup Guide

This guide will help you complete the Prisma Accelerate implementation for your Commissable CRM project.

## Current Status ✅

- [x] Dependencies installed (`@prisma/extension-accelerate`)
- [x] Database client configured with Accelerate extension
- [x] Schema configured for PostgreSQL
- [x] Build scripts optimized with `--no-engine` flag
- [x] Database health check endpoint created (`/api/__dbcheck`)

## Remaining Steps 🔧

### 1. Prisma Data Platform Setup

1. Go to [Prisma Data Platform](https://console.prisma.io)
2. Sign in and select your project
3. Navigate to **Accelerate** section
4. Click **"Enable Accelerate"** for production environment
5. Provide your direct PostgreSQL connection string:
   ```
   postgresql://username:password@34.135.8.243:5432/commissable_crm?sslmode=require
   ```
6. Select the region closest to your Google Cloud SQL instance (likely `us-central1`)
7. **Recommended**: Enable **Static IP** (requires Pro/Business plan)
8. Copy the generated Accelerate connection string

### 2. Google Cloud SQL Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **SQL** → **commissable-sql** instance
3. Go to **Connections** → **Networking**
4. Ensure **Public IP** is enabled
5. Add **Authorized Networks**:
   - If using Static IP: Add the static IP addresses from Prisma Accelerate
   - If not using Static IP: Add `0.0.0.0/0` temporarily (remove after testing)
6. Ensure **SSL/TLS** is enforced

### 3. Environment Variables

Update your Vercel environment variables:

#### Option A: Single URL (Recommended)
```
DATABASE_URL=prisma+postgres://accelerate.prisma-data.net/?api_key=YOUR_ACCELERATE_API_KEY
```

#### Option B: Two URLs
```
DATABASE_URL=prisma://accelerate.prisma-data.net/?api_key=YOUR_ACCELERATE_API_KEY
DIRECT_DATABASE_URL=postgresql://username:password@34.135.8.243:5432/commissable_crm?sslmode=require
```

### 4. Deploy and Test

1. Deploy to Vercel
2. Run migrations:
   ```bash
   npx prisma migrate deploy
   ```
3. Test connectivity: Visit `https://your-app.vercel.app/api/__dbcheck`
4. Expected response: `{"ok": true, "timestamp": "...", "message": "Database connection successful"}`

### 5. Security Hardening (After Testing)

1. Remove temporary `0.0.0.0/0` from Cloud SQL authorized networks
2. Use only the specific Accelerate static IPs
3. Verify SSL/TLS enforcement
4. Monitor Prisma Accelerate dashboard for performance metrics

## Troubleshooting

### Common Issues

1. **"Accelerate was not able to connect"**
   - Check Cloud SQL authorized networks
   - Verify database credentials
   - Ensure SSL/TLS is properly configured

2. **Migration failures**
   - Use Option A (single URL) for easier migration handling
   - Ensure the machine running migrations is authorized

3. **Performance issues**
   - Check Prisma Accelerate dashboard
   - Consider enabling query caching for read-heavy operations

### Health Check Endpoint

The `/api/__dbcheck` endpoint will help you verify connectivity:
- Success: `{"ok": true, "timestamp": "...", "message": "Database connection successful"}`
- Failure: `{"ok": false, "error": "...", "timestamp": "..."}`

## Next Steps

Once Accelerate is working:
1. Monitor performance in the Prisma dashboard
2. Consider enabling query caching for frequently accessed data
3. Set up monitoring and alerts
4. Document any custom caching strategies

## Rollback Plan

If issues arise:
1. Change `DATABASE_URL` back to direct PostgreSQL connection
2. Remove `withAccelerate()` from `lib/db.ts`
3. Redeploy

This will revert to direct database connections while maintaining all other functionality.

