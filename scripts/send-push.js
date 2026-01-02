const webpush = require('web-push');

// 1. Generate keys once (run `npx web-push generate-vapid-keys` in terminal)
// Replace these with your generated keys
const publicVapidKey = 'YOUR_PUBLIC_VAPID_KEY';
const privateVapidKey = 'YOUR_PRIVATE_VAPID_KEY';

webpush.setVapidDetails(
  'mailto:example@yourdomain.org',
  publicVapidKey,
  privateVapidKey
);

// 2. Get this subscription object from the client (console.log it in the browser after subscribing)
const subscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/....',
  keys: {
    p256dh: '...',
    auth: '...'
  }
};

// 3. Send the notification
const payload = JSON.stringify({
  title: 'ThingsToDo Reminder',
  body: 'You have a task due soon!',
  url: 'https://your-app-url.com/#inbox'
});

webpush.sendNotification(subscription, payload)
  .then(res => console.log('Sent successfully:', res.statusCode))
  .catch(err => console.error('Error sending:', err));
