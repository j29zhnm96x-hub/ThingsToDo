# ThingsToDo Push Scheduler — Cloudflare Worker

## Deploy to Cloudflare Dashboard

1. Go to **Cloudflare Dashboard** → **Workers & Pages** → **Create Worker**

2. Give it a name (e.g., `thingstodo-push`)

3. Delete the default code, paste the contents of `push-scheduler.js`

4. Go to the **Settings** tab → **Variables** → add these **secrets**:

   | Name | Value |
   |------|-------|
   | `VAPID_PRIVATE_KEY` | (paste the PKCS#8 PEM from `VAPID_PRIVATE_KEY` above) |
   | `VAPID_PUBLIC_KEY` | `BJRwAeexC9A0eQiykJrQDTRq4WC9uhxeq1wA_vnbJJqfnJ35UJ2yLhYcNMx0aG6OhwrvwAAddVKYXIh0V8Nuv8M` |

5. Go to the **KV** tab → **Add binding**:
   - Variable name: `PUSH_SCHEDULES`
   - KV namespace: Create a new one named `push-schedules`

6. Go to the **Triggers** tab → **Cron Triggers** → **Add Cron Trigger** → set to `* * * * *` (every minute)

7. Click **Save and Deploy**

## Update Config in PWA

In `src/modules/push/config.js`, replace `YOUR_SUBDOMAIN` with your Worker name:

```js
workerUrl: 'https://thingstodo-push.YOUR_SUBDOMAIN.workers.dev'
```

becomes:

```js
workerUrl: 'https://thingstodo-push.your-username.workers.dev'
```
