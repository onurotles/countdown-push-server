const express = require("express");
const webpush = require("web-push");
const cors = require("cors");
const cron = require("node-cron");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 4000;

// 1. VAPID key üret
webpush.setVapidDetails(
  'mailto:onurotles@gmail.com',
  'BJdmdS87qYiSR-beG-ugV7PwZx5LMVo0tsGbKxRtpKR-GuB57LcIYogZQQpCVfjNEGj1ozBnou9z5pYlmPDHgn8',
  '-HP1acqoSxtqEuGuhBQnr448A5Iv3912csUff-l78JM'
);

// Abonelikleri saklamak için basit array (prod’da DB kullan)
let subscriptions = [];

// Hedef ve başlangıç tarih
const startDate = new Date("2025-07-04T00:00:00");
const targetDate = new Date("2026-07-04T00:00:00");

// Fonksiyonlar
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

// Abonelik alma endpoint
app.post("/subscribe", (req, res) => {
  const subscription = req.body;
  subscriptions.push(subscription);
  res.status(201).json({ message: "Abone kaydedildi ✅" });
});

// Test bildirimi endpoint
app.post("/send", async (req, res) => {
  const notificationPayload = JSON.stringify({
    title: "Merhaba!",
    body: "Bu bir test bildirimi 🎉",
  });

  const sendNotifications = subscriptions.map((sub) =>
    webpush.sendNotification(sub, notificationPayload).catch((err) => {
      console.error("Push gönderilemedi:", err);
    })
  );

  await Promise.all(sendNotifications);
  res.status(200).json({ message: "OK" });
});

// 🔹 Günlük otomatik push (cron)
cron.schedule("0 9 * * *", async () => {
  console.log("Günlük push bildirimi gönderiliyor...");

  const progress = calculateProgress().toFixed(1);
  const daysLeft = calculateDaysLeft();

  const notificationPayload = JSON.stringify({
    title: "Günlük Countdown Bildirimi",
    body: `Şu an progress: %${progress}, hedef tarihe ${daysLeft} gün kaldı! 📅`,
  });

  const sendNotifications = subscriptions.map((sub) =>
    webpush.sendNotification(sub, notificationPayload).catch((err) => {
      console.error("Push gönderilemedi:", err);
    })
  );

  await Promise.all(sendNotifications);
  console.log("Push bildirimi gönderildi ✅");
});

app.listen(PORT, () => console.log(`Push server ${PORT} portunda çalışıyor 🚀`));
