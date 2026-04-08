import webpush from "web-push";
import Subscription from "../models/Subscription.js";

// setup VAPID
webpush.setVapidDetails(
  "mailto:rahman_uwl@edenzil.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// function hantar notification ke semua subscriber
export const sendPushNotification = async (title, body, url) => {
  try {
    const subscriptions = await Subscription.find();

    subscriptions.forEach(async (sub) => {
      try {
        await webpush.sendNotification(
          sub.subscription,
          JSON.stringify({ title, body, url })
        );
      } catch (err) {
        console.error("Push failed for a subscription:", err);
      }
    });
  } catch (err) {
    console.error("Send push notification error:", err);
  }
};