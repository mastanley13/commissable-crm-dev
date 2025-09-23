# 🚀 Google Cloud SQL Proxy - Complete Launch Guide

## 📋 Prerequisites Checklist

Before starting, make sure you have:
- [ ] Google Cloud SDK installed (`gcloud` command available)
- [ ] Authenticated with Google Cloud (`gcloud auth login`)
- [ ] Access to your Google Cloud project
- [ ] Windows PowerShell or Command Prompt

## 🎯 Your Specific Configuration

**Project Details:**
- **Project ID**: `groovy-design-471709-d1`
- **Instance Name**: `commissable-sql`
- **Region**: `us-central1`
- **Connection Name**: `groovy-design-471709-d1:us-central1:commissable-sql`
- **Database**: `crm`
- **Username**: `app`
- **Password**: `commissable@2025`

---

## 🔧 Step 1: Download Cloud SQL Proxy


## QUICK START ## 
cd C:\cloud-sql-proxy
.\cloud_sql_proxy.exe groovy-design-471709-d1:us-central1:commissable-sql --port 5432


### Option A: Using PowerShell (Recommended)
```powershell
# Create a directory for the proxy
New-Item -ItemType Directory -Force -Path "C:\cloud-sql-proxy"

# Download the Cloud SQL Proxy for Windows
Invoke-WebRequest -Uri "https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.18.1/cloud-sql-proxy.x64.exe" -OutFile "C:\cloud-sql-proxy\cloud_sql_proxy.exe"

# Verify download
Get-ChildItem "C:\cloud-sql-proxy\cloud_sql_proxy.exe"
```

### Option B: Using Command Prompt
```cmd
# Create directory
mkdir C:\cloud-sql-proxy

# Download (using curl if available)
curl -o C:\cloud-sql-proxy\cloud_sql_proxy.exe https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.18.1/cloud-sql-proxy.x64.exe
```

### Option C: Manual Download
1. Go to: https://cloud.google.com/sql/docs/mysql/sql-proxy#install
2. Download `cloud_sql_proxy_windows_amd64.exe`
3. Rename it to `cloud_sql_proxy.exe`
4. Place it in `C:\cloud-sql-proxy\`

---

## 🔐 Step 2: Authenticate with Google Cloud

```powershell
# Login to Google Cloud
gcloud auth login

# Set your project
gcloud config set project groovy-design-471709-d1

# Set up application default credentials
gcloud auth application-default login

# Verify authentication
gcloud auth list
```

---

## 🚀 Step 3: Launch Cloud SQL Proxy

### Method 1: Direct Launch (Recommended)
```powershell
# Navigate to the proxy directory
cd C:\cloud-sql-proxy

# Launch the proxy (replace with your actual connection details)
.\cloud_sql_proxy.exe -instances=groovy-design-471709-d1:us-central1:commissable-sql=tcp:5432

OR

.\cloud_sql_proxy.exe groovy-design-471709-d1:us-central1:commissable-sql --port 5432 --debug-logs


```

### Method 2: Background Launch
```powershell
# Launch in background (Windows)
Start-Process -FilePath "C:\cloud-sql-proxy\cloud_sql_proxy.exe" -ArgumentList "-instances=groovy-design-471709-d1:us-central1:commissable-sql=tcp:5432" -WindowStyle Hidden
```

### Method 3: With Verbose Logging
```powershell
# Launch with detailed logging
.\cloud_sql_proxy.exe -instances=groovy-design-471709-d1:us-central1:commissable-sql=tcp:5432 -verbose
```

---

## ✅ Step 4: Verify Connection

### Test with PowerShell
```powershell
# Test if the proxy is listening on port 5432
Test-NetConnection -ComputerName localhost -Port 5432
```

### Test with Prisma
```powershell
# Navigate to your project directory
cd "C:\Users\Administrator\.cursor-projects\projects\Commissable CRM"

# Test database connection
npx prisma db pull
```

---

## 🔧 Step 5: Create Environment File

Create a `.env.local` file in your project root:

```env
# Google Cloud SQL Configuration
DATABASE_URL="postgresql://app:commissable%402025@127.0.0.1:5432/crm"

# Next.js Configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"
```

**Note**: The `%40` in the password is URL encoding for `@` symbol.

---

## 🎯 Step 6: Test Your Setup

```powershell
# Generate Prisma client
npx prisma generate

# Test database connection
npx prisma db pull

# Start your development server
npm run dev
```

---

## 🛠️ Troubleshooting Common Issues

### Issue 1: "gcloud: command not found"
**Solution:**
```powershell
# Install Google Cloud SDK
# Download from: https://cloud.google.com/sdk/docs/install
# Or use winget:
winget install Google.CloudSDK
```

### Issue 2: "Authentication failed"
**Solution:**
```powershell
# Re-authenticate
gcloud auth login
gcloud auth application-default login

# Check current project
gcloud config get-value project
```

### Issue 3: "Connection refused"
**Solution:**
```powershell
# Check if proxy is running
Get-Process | Where-Object {$_.ProcessName -like "*cloud_sql_proxy*"}

# Check if port 5432 is in use
netstat -an | findstr :5432
```

### Issue 4: "Instance not found"
**Solution:**
```powershell
# List your instances
gcloud sql instances list

# Verify connection name format
# Should be: project-id:region:instance-name
```

### Issue 5: "Permission denied"
**Solution:**
```powershell
# Run PowerShell as Administrator
# Or check firewall settings
New-NetFirewallRule -DisplayName "Cloud SQL Proxy" -Direction Inbound -Protocol TCP -LocalPort 5432 -Action Allow
```

---

## 📝 Quick Reference Commands

### Start Proxy
```powershell
cd C:\cloud-sql-proxy
.\cloud_sql_proxy.exe -instances=groovy-design-471709-d1:us-central1:commissable-sql=tcp:5432
```

### Stop Proxy
```powershell
# Find and kill the process
Get-Process | Where-Object {$_.ProcessName -like "*cloud_sql_proxy*"} | Stop-Process -Force
```

### Check Status
```powershell
# Check if proxy is running
Test-NetConnection -ComputerName localhost -Port 5432

# Check processes
Get-Process | Where-Object {$_.ProcessName -like "*cloud_sql_proxy*"}
```

---

## 🎉 Success Indicators

You'll know everything is working when:

1. ✅ Cloud SQL Proxy shows: `Ready for new connections`
2. ✅ `Test-NetConnection` returns `TcpTestSucceeded : True`
3. ✅ `npx prisma db pull` completes without errors
4. ✅ Your Next.js app connects to the database

---

## 🔄 Daily Workflow

### Starting Development Session
```powershell
# 1. Start Cloud SQL Proxy
cd C:\cloud-sql-proxy
.\cloud_sql_proxy.exe -instances=groovy-design-471709-d1:us-central1:commissable-sql=tcp:5432

# 2. In a new terminal, start your app
cd "C:\Users\Administrator\.cursor-projects\projects\Commissable CRM"
npm run dev
```

### Ending Development Session
```powershell
# Stop the proxy (Ctrl+C in the proxy terminal)
# Or kill the process:
Get-Process | Where-Object {$_.ProcessName -like "*cloud_sql_proxy*"} | Stop-Process -Force
```

---

## 🚨 Emergency Commands

### If Everything Breaks
```powershell
# 1. Kill all proxy processes
Get-Process | Where-Object {$_.ProcessName -like "*cloud_sql_proxy*"} | Stop-Process -Force

# 2. Re-authenticate
gcloud auth login
gcloud auth application-default login

# 3. Re-download proxy
Remove-Item "C:\cloud-sql-proxy\cloud_sql_proxy.exe" -Force
Invoke-WebRequest -Uri "https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.18.1/cloud-sql-proxy.x64.exe" -OutFile "C:\cloud-sql-proxy\cloud_sql_proxy.exe"

# 4. Start fresh
cd C:\cloud-sql-proxy
.\cloud_sql_proxy.exe -instances=groovy-design-471709-d1:us-central1:commissable-sql=tcp:5432
```

---

## 📞 Need Help?

If you're still having issues:

1. **Check the logs**: Look at the Cloud SQL Proxy output for error messages
2. **Verify credentials**: Make sure your Google Cloud account has access to the project
3. **Check network**: Ensure your firewall isn't blocking port 5432
4. **Restart everything**: Sometimes a fresh start fixes everything

**Your connection string for reference:**
```
postgresql://app:commissable%402025@127.0.0.1:5432/crm
```

---

*This guide is specifically tailored for your Commissable CRM project. All commands are ready to copy and paste!* 🎯
