# Database Configuration

## Google Cloud SQL Instance Details
- **Project ID**: groovy-design-471709-d1
- **Instance Name**: commissable-sql
- **Database Version**: PostgreSQL 15
- **Region**: us-central1
- **Connection Name**: groovy-design-471709-d1:us-central1:commissable-sql
- **Public IP**: 34.135.8.243
- **Port**: 5432

## Environment Variables

Create a `.env.local` file in your project root with the following content:

```env
# Google Cloud SQL Configuration
# Project: groovy-design-471709-d1
# Instance: commissable-sql
# Connection Name: groovy-design-471709-d1:us-central1:commissable-sql

# For local development with Cloud SQL Proxy (when available)
# DATABASE_URL="postgresql://username:password@localhost:5432/commissable_crm"

# For direct connection (temporary - less secure)
# Replace 'username' and 'password' with your actual database credentials
DATABASE_URL="postgresql://username:password@34.135.8.243:5432/commissable_crm"

# For production with Unix sockets (when deployed)
# DATABASE_URL="postgresql://username:password@/commissable_crm?host=/cloudsql/groovy-design-471709-d1:us-central1:commissable-sql"

# Next.js Configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"
```

## Next Steps

1. **Create Database User**: You need to create a database user and database
2. **Update DATABASE_URL**: Replace 'username' and 'password' with actual credentials
3. **Test Connection**: Run Prisma commands to test the connection
4. **Set up Cloud SQL Proxy**: For more secure local development

## Security Notes

- The current setup uses public IP which is less secure
- For production, use Cloud SQL Proxy or private IP
- Enable SSL in production environments
- Consider using IAM database authentication for better security
