require('dotenv').config();

const express = require("express");
const webpush = require("web-push");
const cors = require("cors");
const cron = require("node-cron");
const { MongoClient } = require("mongodb");

// Environment variables
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI; // MongoDB bağlantı stringi
const VAPID_PUBLIC = process.env.VAPID_PUBLIC;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE;
const FRONTEND_URL = process.env.FRONTEND_URL || "https://dugune-kalan-sure.vercel.app";

const app = express();

// CORS
app.use(cors({ origin: FRONTEND_URL }));

app.use(express.json());

// MongoDB setup
const client = new MongoClient(MONGO_URI);
let subscriptionsCollection;

async function initDB() {
  await client.connect();
  const db = client.db("countdownDB");
  subscriptionsCollection = db.collection("subscriptions");
  console.log("MongoDB connected ✅");
}

initDB().catch(console.error);

// VAPID setup
webpush.setVapidDetails(
  'mailto:onurotles@gmail.com',
  VAPID_PUBLIC,
  VAPID_PRIVATE
);

// Target date
const startDate = new Date("2025-07-04T00:00:00");
const targetDate = new Date("2026-07-04T00:00:00");

function calculateProgress() {
  const now = new Date();
  const totalDuration = targetDate.getTime() - startDate.getTime();
  const elapsed = now.getTime() - startDate.getTime();
  return Math.min(Math.max((elapsed / totalDuration) * 100, 0), 100);
}

function calculateDaysLeft() {
  const now = new Date();
  const diff = targetDate.getTime() - now.getTime();
  return Math.max(Math.ceil(diff / (1000 * 60 * 60 * 24)), 0);
}

// Subscribe endpoint
app.post("/subscribe", async (req, res) => {
  try {
    const subscription = req.body;
    // Aynı abonelik varsa ekleme
    const exists = await subscriptionsCollection.findOne({ endpoint: subscription.endpoint });
    if (!exists) {
      await subscriptionsCollection.insertOne(subscription);
    }
    res.status(201).json({ message: "Abone kaydedildi ✅" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Abone kaydedilemedi ❌" });
  }
});

// Send push manually
app.post("/send", async (req, res) => {
  try {
    const allSubs = await subscriptionsCollection.find({}).toArray();
    const notificationPayload = JSON.stringify({
      title: "Merhaba!",
      body: "Bu bir test bildirimi 🎉",
    });

    const sendNotifications = allSubs.map(sub =>
      webpush.sendNotification(sub, notificationPayload).catch(console.error)
    );
    await Promise.all(sendNotifications);
    res.status(200).json({ message: "Push gönderildi ✅" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Push gönderilemedi ❌" });
  }
});

// 🔹 Her dakika push bildirimi göndermek için cron
cron.schedule("* * * * *", async () => {
  try {
    console.log("Dakikada bir push bildirimi gönderiliyor...");
    const progress = calculateProgress().toFixed(1);
    const daysLeft = calculateDaysLeft();

    const payload = JSON.stringify({
      title: "Dakikada Bir Countdown Bildirimi",
      body: `Şu an progress: %${progress}, hedef tarihe ${daysLeft} gün kaldı! 📅`,
    });

    const allSubs = await subscriptionsCollection.find({}).toArray();
    await Promise.all(allSubs.map(sub => webpush.sendNotification(sub, payload).catch(console.error)));

    console.log("Push bildirimi gönderildi ✅");
  } catch (err) {
    console.error("Cron push hatası:", err);
  }
});


app.listen(PORT, () => console.log(`Push server ${PORT} portunda çalışıyor 🚀`));
