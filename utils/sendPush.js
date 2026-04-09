import webpush from "web-push";
import Subscription from "../models/Subscription.js";

// function hantar notification ke semua subscriber
export const sendPushNotification = async (title, body, url) => {
  try {
    // ✅ log env VAPID key
    console.log("🔹 Backend VAPID PUBLIC KEY:", process.env.VAPID_PUBLIC_KEY);
    console.log("🔹 Backend VAPID PRIVATE KEY:", process.env.VAPID_PRIVATE_KEY);

    // ✅ check key sebelum set
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      console.error("❌ VAPID key missing! Push notifications disabled.");
      return;
    }

    // setup VAPID (safe, masa function dipanggil)
    webpush.setVapidDetails(
      "mailto:rahman_uwl@edenzil.com",
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    // ambil semua subscription
    const subscriptions = await Subscription.find();
    console.log(`🔹 Found ${subscriptions.length} subscriptions`);

    // loop setiap subscription
    for (const sub of subscriptions) {
      try {
        console.log("🔹 Sending push to subscription:", sub._id);
        await webpush.sendNotification(
          sub.subscription,
          JSON.stringify({ title, body, url })
        );
        console.log("✅ Push sent successfully:", sub._id);
      } catch (err) {
        console.error("❌ Push failed for subscription:", sub._id, err.message);
      }
    }
  } catch (err) {
    console.error("❌ Send push notification error:", err.message);
  }
};
