import webpush from "web-push";
import Subscription from "../models/Subscription.js";

// ===================== VAPID SETUP (ONLY ONCE) =====================
webpush.setVapidDetails(
  "mailto:rahman_uwl@edenzil.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// ===================== SEND PUSH =====================
export const sendPushNotification = async (title, body, url = "/") => {
  try {
    if (
      !process.env.VAPID_PUBLIC_KEY ||
      !process.env.VAPID_PRIVATE_KEY
    ) {
      console.error("❌ VAPID keys missing");
      return;
    }

    const subscriptions = await Subscription.find();

    console.log(`🔔 Push start → total subs: ${subscriptions.length}`);

    for (const sub of subscriptions) {
      // ===================== VALIDATION =====================
      if (!sub?.subscription?.endpoint) {
        console.log("⚠️ Invalid subscription skipped:", sub._id);
        continue;
      }

      const payload = JSON.stringify({
        title,
        body,
        url,
      });

      try {
        await webpush.sendNotification(sub.subscription, payload);

        console.log("✅ Push sent →", sub._id);

      } catch (err) {
        console.error("❌ Push failed →", sub._id, err.message);

        // ===================== CLEAN INVALID SUB =====================
        if (err.statusCode === 410 || err.statusCode === 404) {
          await Subscription.deleteOne({ _id: sub._id });
          console.log("🧹 Removed expired subscription:", sub._id);
        }
      }
    }

    console.log("🚀 Push batch completed");

  } catch (err) {
    console.error("❌ sendPushNotification error:", err.message);
  }
};
