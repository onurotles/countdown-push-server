require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const webpush = require('web-push');
const cors = require('cors');
const cron = require('node-cron');
const sendgrid = require('@sendgrid/mail');

const app = express();
app.use(express.json());

// ✅ CORS ayarı
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.LOCAL_URL,
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (!allowedOrigins.includes(origin)) {
      return callback(new Error('CORS izinli değil'), false);
    }
    return callback(null, true);
  }
}));

// ✅ Abonelik schema
const subscriptionSchema = new mongoose.Schema({
  endpoint: { type: String, required: true, unique: true },
  keys: {
    p256dh: String,
    auth: String
  }
});
const Subscription = mongoose.model('Subscription', subscriptionSchema);

// ✅ VAPID key setup
webpush.setVapidDetails(
  'mailto:onurotles@gmail.com',
  process.env.PUBLIC_KEY,
  process.env.PRIVATE_KEY
);

// ✅ SendGrid setup
sendgrid.setApiKey(process.env.SENDGRID_API_KEY);

// ✅ Mail gönderme fonksiyonu
async function sendMail(to, subject, text) {
  try {
    const msg = {
      to,
      from: process.env.MAIL_FROM, // SendGrid'de onaylı bir adres olmalı
      subject,
      text,
    };
    await sendgrid.send(msg);
    console.log(`📧 Mail başarıyla gönderildi: ${to}`);
  } catch (err) {
    console.error("❌ Mail gönderme hatası:", err);
  }
}

// ✅ Subscribe endpoint
app.post('/subscribe', async (req, res) => {
  try {
    const subscription = req.body;
    await Subscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      subscription,
      { upsert: true, new: true }
    );
    console.log("Push aboneliği kaydedildi ✅");
    res.status(201).json({ message: "Abonelik kaydedildi" });
  } catch (err) {
    console.error("Abonelik kaydetme hatası ❌", err);
    res.status(500).json({ message: "Abonelik kaydedilemedi" });
  }
});

// ✅ Manuel push ve mail gönderme
app.post('/sendNotification', async (req, res) => {
  const { title, body, mailTo } = req.body;

  try {
    const subscriptions = await Subscription.find();
    const payload = JSON.stringify({ title, body });

    // 🔹 Push bildirimleri
    await Promise.all(subscriptions.map(sub =>
      webpush.sendNotification(sub, payload).catch(async err => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log("❌ Geçersiz abonelik siliniyor:", sub.endpoint);
          await Subscription.deleteOne({ endpoint: sub.endpoint });
        } else {
          console.error("Push gönderim hatası:", err);
        }
      })
    ));

    // 🔹 Mail gönderimi (opsiyonel)
    if (mailTo) {
      await sendMail(mailTo, title, body);
    }

    res.status(200).json({ message: "Bildirimler gönderildi ✅" });
  } catch (err) {
    console.error("Bildirim gönderme hatası ❌", err);
    res.status(500).json({ message: "Bildirim gönderilemedi" });
  }
});

// ✅ CRON: Her dakika tetiklenir
cron.schedule('* * * * *', async () => {
  try {
    console.log("⏰ Cron tetiklendi — Günlük push bildirimi gönderiliyor...");
    const subscriptions = await Subscription.find();
    if (!subscriptions.length) {
      console.log("⚠️ Hiç abone yok, bildirim gönderilmedi.");
      return;
    }

    const payload = JSON.stringify({
      title: "Günlük Countdown",
      body: "Hedef tarihe kalan günleri kontrol et! 📅"
    });

    await Promise.all(subscriptions.map(sub =>
      webpush.sendNotification(sub, payload).catch(async err => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log("❌ Geçersiz abonelik siliniyor:", sub.endpoint);
          await Subscription.deleteOne({ endpoint: sub.endpoint });
        } else {
          console.error("Cron push hatası:", err);
        }
      })
    ));

    // 🔹 Cron mail gönderimi (opsiyonel)
    // Örnek: tek mail göndermek istersen
    // await sendMail('mail@example.com', 'Günlük Countdown', 'Hedef tarihe kalan günleri kontrol et! 📅');

    console.log("✅ Günlük push bildirimi gönderildi");
  } catch (err) {
    console.error("Cron push hatası:", err);
  }
});

// ✅ MongoDB bağlantısından sonra server başlat
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB bağlantısı başarılı ✅");
    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => console.log(`Server ${PORT} portunda çalışıyor 🚀`));
  })
  .catch(err => {
    console.error("MongoDB bağlantı hatası ❌", err);
    process.exit(1);
  });
