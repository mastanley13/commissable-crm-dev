I'll walk you through the complete process of connecting your Prisma schema to Google Cloud PostgreSQL. Let me break this down into detailed steps.

## Step 1: Set Up Google Cloud PostgreSQL Instance

### 1.1 Create a Cloud SQL PostgreSQL Instance

1. **Go to Google Cloud Console** → **SQL** → **Create Instance**
2. **Choose PostgreSQL** as your database engine
3. **Configure your instance**:
   ```
   Instance ID: commissable-crm-db
   Database version: PostgreSQL 15 (recommended)
   Region: Choose closest to your users
   Zonal availability: Single zone (for development) or Multi-zone (for production)
   ```

4. **Set up machine configuration**:
   ```
   Machine type: db-f1-micro (for development) or db-n1-standard-1 (for production)
   Storage type: SSD
   Storage capacity: 10GB (minimum)
   ```

5. **Set up authentication**:
   ```
   Root password: [Create a strong password]
   Database flags: Leave default
   ```

### 1.2 Configure Database Access

1. **Authorized networks**: Add your IP address or use Cloud SQL Proxy
2. **Create a database**:
   ```sql
   CREATE DATABASE commissable_crm;
   ```

3. **Create a dedicated user**:
   ```sql
   CREATE USER commissable_user WITH PASSWORD 'your_secure_password';
   GRANT ALL PRIVILEGES ON DATABASE commissable_crm TO commissable_user;
   ```

## Step 2: Update Your Prisma Configuration

### 2.1 Update `prisma/schema.prisma`

```prisma
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DIRECT_URL") // For connection pooling
}

// ... rest of your schema models ...
```

### 2.2 Create Environment Variables

Create a `.env` file in your project root:

```env
# Database URLs
DATABASE_URL="postgresql://commissable_user:your_secure_password@/commissable_crm?host=/cloudsql/your-project-id:region:commissable-crm-db"
DIRECT_URL="postgresql://commissable_user:your_secure_password@/commissable_crm?host=/cloudsql/your-project-id:region:commissable-crm-db"

# For local development with Cloud SQL Proxy
# DATABASE_URL="postgresql://commissable_user:your_secure_password@localhost:5432/commissable_crm"
# DIRECT_URL="postgresql://commissable_user:your_secure_password@localhost:5432/commissable_crm"

# For production with public IP (less secure)
# DATABASE_URL="postgresql://commissable_user:your_secure_password@your-instance-ip:5432/commissable_crm"
# DIRECT_URL="postgresql://commissable_user:your_secure_password@your-instance-ip:5432/commissable_crm"
```

## Step 3: Set Up Cloud SQL Proxy (Recommended for Development)

### 3.1 Install Cloud SQL Proxy

```bash
# Download Cloud SQL Proxy
curl -o cloud_sql_proxy https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64
chmod +x cloud_sql_proxy

# Or on Windows
# Download from: https://cloud.google.com/sql/docs/mysql/connect-admin-proxy
```

### 3.2 Start the Proxy

```bash
# Get your connection name from Cloud Console
./cloud_sql_proxy -instances=your-project-id:region:commissable-crm-db=tcp:5432
```

### 3.3 Update `.env` for Local Development

```env
DATABASE_URL="postgresql://commissable_user:your_secure_password@localhost:5432/commissable_crm"
DIRECT_URL="postgresql://commissable_user:your_secure_password@localhost:5432/commissable_crm"
```

## Step 4: Install Required Dependencies

```bash
npm install @prisma/client prisma
npm install pg @types/pg
```

## Step 5: Run Prisma Migrations

### 5.1 Initialize Prisma

```bash
npx prisma migrate dev --name init
```

This will:
- Create the migration files
- Apply the schema to your database
- Generate the Prisma client

### 5.2 Generate Prisma Client

```bash
npx prisma generate
```

## Step 6: Create Database Connection Utility

Create `lib/db.ts`:

```typescript
import { PrismaClient } from '../generated/prisma'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

## Step 7: Update Your Application Code

### 7.1 Replace Mock Data with Database Queries

Update `app/(dashboard)/accounts/page.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { ListHeader } from '@/components/list-header'
import { DynamicTable, Column } from '@/components/dynamic-table'
import { prisma } from '@/lib/db'
import { Trash2 } from 'lucide-react'

// ... your existing column definitions ...

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([])
  const [filteredAccounts, setFilteredAccounts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAccounts()
  }, [])

  const fetchAccounts = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/accounts')
      const data = await response.json()
      setAccounts(data)
      setFilteredAccounts(data)
    } catch (error) {
      console.error('Error fetching accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  // ... rest of your component logic ...
}
```

### 7.2 Create API Routes

Create `app/api/accounts/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const accounts = await prisma.account.findMany({
      include: {
        owner: {
          select: {
            fullName: true
          }
        },
        _count: {
          select: {
            contacts: true,
            opportunities: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(accounts)
  } catch (error) {
    console.error('Error fetching accounts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch accounts' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const account = await prisma.account.create({
      data: {
        accountName: body.accountName,
        accountLegalName: body.accountLegalName,
        accountType: body.accountType,
        shippingStreet: body.shippingStreet,
        shippingCity: body.shippingCity,
        shippingState: body.shippingState,
        shippingZip: body.shippingZip,
        ownerId: body.ownerId, // You'll need to get this from auth
      }
    })

    return NextResponse.json(account)
  } catch (error) {
    console.error('Error creating account:', error)
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    )
  }
}
```

## Step 8: Production Deployment Considerations

### 8.1 For Vercel Deployment

Update your Vercel environment variables:

```env
DATABASE_URL="postgresql://commissable_user:password@/commissable_crm?host=/cloudsql/your-project-id:region:commissable-crm-db"
DIRECT_URL="postgresql://commissable_user:password@/commissable_crm?host=/cloudsql/your-project-id:region:commissable-crm-db"
```

### 8.2 For Google Cloud Run

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "start"]
```

### 8.3 Enable Connection Pooling

For production, consider using PgBouncer or Prisma Accelerate:

```typescript
// With Prisma Accelerate
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + '?pgbouncer=true&connection_limit=1'
    }
  }
})
```

## Step 9: Security Best Practices

### 9.1 Use IAM Authentication (Recommended)

```bash
# Enable IAM authentication
gcloud sql users create commissable_user@your-project-id.iam \
  --instance=commissable-crm-db \
  --type=cloud_iam_user
```

### 9.2 Update Connection String

```env
DATABASE_URL="postgresql://commissable_user@your-project-id.iam:/commissable_crm?host=/cloudsql/your-project-id:region:commissable-crm-db"
```

### 9.3 Set Up SSL

```env
DATABASE_URL="postgresql://commissable_user:password@/commissable_crm?host=/cloudsql/your-project-id:region:commissable-crm-db&sslmode=require"
```

## Step 10: Testing Your Connection

Create a test script `scripts/test-db.ts`:

```typescript
import { prisma } from '../lib/db'

async function testConnection() {
  try {
    await prisma.$connect()
    console.log('✅ Database connection successful')
    
    // Test a simple query
    const userCount = await prisma.user.count()
    console.log(`📊 Users in database: ${userCount}`)
    
  } catch (error) {
    console.error('❌ Database connection failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testConnection()
```

Run it with:
```bash
npx tsx scripts/test-db.ts
```

## Troubleshooting Common Issues

### Connection Issues
- Verify your Cloud SQL instance is running
- Check firewall rules and authorized networks
- Ensure the connection string format is correct

### Migration Issues
- Make sure your database user has proper permissions
- Check if the database exists
- Verify Prisma schema syntax

### Performance Issues
- Use connection pooling in production
- Consider read replicas for read-heavy workloads
- Monitor query performance with Prisma's logging
