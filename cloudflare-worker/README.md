# ThingsToDo Push Setup — Cloudflare Pages Functions

## Step 1: Add KV Binding in Pages Dashboard

1. Go to **Cloudflare Dashboard** → **Workers & Pages** → **Pages** tab
2. Click on your **thingstodoapp** project
3. Go to **Settings** → **Functions** → **KV namespace bindings**
4. Click **"Add binding"**:
   - Variable name: `PUSH_SCHEDULES`
   - KV namespace: select **push-schedules** (created earlier)
5. Click **"Save"**

## Step 2: Add VAPID Secrets

In the same **Settings** → **Environment variables** (under Functions):

Add these two **secrets** (click "Add variable", then check "Encrypt"):

| Variable name | Value |
|--------------|-------|
| `VAPID_PUBLIC_KEY` | `BJRwAeexC9A0eQiykJrQDTRq4WC9uhxeq1wA_vnbJJqfnJ35UJ2yLhYcNMx0aG6OhwrvwAAddVKYXIh0V8Nuv8M` |
| `VAPID_PRIVATE_KEY` | `LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1JR0hBZ0VBTUJNR0J5cUdTTTQ5QWdFR0NDcUdTTTQ5QXdFSEJHMHdhd0lCQVFRZ1FiOHRNSk4yTmVWMVFoRDkKNk0wWFJvN3FmOXljckRZbUhTTitRdEhhdkRhaFJBTkNBQVNjc0FIbnNRdlFOSGtJc3BDYTBBMDBhdUZndmJvYwpYcXRjQVA3NTJ5U2FuNXlkK1ZDZHNpNFdIRFRNZEdodWpvY0s3OEFBSFhWU21GeUlkRmZEYnIvRAotLS0tLUVORCBQUklWQVRFIEtFWS0tLS0t` |

## Step 3: Set Up Cron Job (for automatic checks)

1. Go to **https://cron-job.org** → create a free account
2. Click **"Create Cronjob"**
3. Fill in:
   - **Title:** `ThingsToDo push check`
   - **URL:** `POST https://thingstodoapp.pages.dev/api/check`
   - **Schedule:** Every **1 minute**
   - Leave other settings as default
4. Click **"Create"**

## Step 4: Deploy

Push the code to GitHub — Cloudflare Pages will auto-deploy the Functions alongside your app.
