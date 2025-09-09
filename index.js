require("dotenv").config();

const express = require("express");
const { MongoClient } = require("mongodb");
const webpush = require("web-push");
const cors = require("cors");

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI;
const VAPID_PUBLIC = process.env.VAPID_PUBLIC;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

const app = express();
app.use(express.json());
app.use(cors({ origin: FRONTEND_URL }));

// VAPID setup
webpush.setVapidDetails(
  "mailto:onurotles@gmail.com",
  VAPID_PUBLIC,
  VAPID_PRIVATE
);

let subscriptionsCollection;

// MongoDB başlat
async function initDB() {
  const client = new MongoClient(MONGO_URI);
  await client.connect({
  serverSelectionTimeoutMS: 5000,
  tls: true,
  tlsAllowInvalidCertificates: false
});

  const db = client.db("countdownDB");
  subscriptionsCollection = db.collection("subscriptions");
  console.log("MongoDB connected ✅");
}

// Subscribe endpoint
app.post("/subscribe", async (req, res) => {
  if (!subscriptionsCollection) {
    return res.status(503).json({ message: "DB henüz hazır değil" });
  }
  try {
    const subscription = req.body;
    const exists = await subscriptionsCollection.findOne({ endpoint: subscription.endpoint });
    if (!exists) {
      await subscriptionsCollection.insertOne(subscription);
    }
    console.log("Push aboneliği kaydedildi ✅");
    res.status(201).json({ message: "Abonelik kaydedildi ✅" });
  } catch (err) {
    console.error("Abonelik kaydetme hatası ❌", err);
    res.status(500).json({ message: "Abonelik kaydedilemedi ❌" });
  }
});

// Bildirim gönder endpoint (manuel test için)
app.post("/sendNotification", async (req, res) => {
  if (!subscriptionsCollection) {
    return res.status(503).json({ message: "DB henüz hazır değil" });
  }
  const { title, body } = req.body;
  try {
    const allSubs = await subscriptionsCollection.find({}).toArray();
    const payload = JSON.stringify({ title, body });
    await Promise.all(allSubs.map(sub => webpush.sendNotification(sub, payload).catch(console.error)));
    res.status(200).json({ message: "Bildirimler gönderildi ✅" });
  } catch (err) {
    console.error("Bildirim gönderme hatası ❌", err);
    res.status(500).json({ message: "Bildirim gönderilemedi ❌" });
  }
});

// 🔹 Sunucuyu DB hazır olunca başlat
async function startServer() {
  try {
    await initDB();
    app.listen(PORT, () => console.log(`Push server ${PORT} portunda çalışıyor 🚀`));
  } catch (err) {
    console.error("DB bağlantısı hatası ❌", err);
  }
}

startServer();
