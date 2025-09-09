require('dotenv').config();

const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const webpush = require("web-push");
const bodyParser = require("body-parser");

dotenv.config();

const app = express();
app.use(bodyParser.json());

const cors = require("cors");

const FRONTEND_URLS = [
  "https://dugune-kalan-sure.vercel.app", // prod
  "http://localhost:3000",                
  "http://localhost:3001",                
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || FRONTEND_URLS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
}));


// MongoDB bağlantısı
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("DB bağlantısı başarılı ✅"))
  .catch((err) => console.error("DB bağlantı hatası ❌", err));

const subscriptionSchema = new mongoose.Schema({
  endpoint: String,
  keys: {
    p256dh: String,
    auth: String,
  },
});

const Subscription = mongoose.model("Subscription", subscriptionSchema);

// VAPID keys
webpush.setVapidDetails(
  "mailto:test@test.com",
  process.env.VAPID_PUBLIC,
  process.env.VAPID_PRIVATE
);

// Yeni abonelik kaydet
app.post("/subscribe", async (req, res) => {
  try {
    const subscription = req.body;
    await Subscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      subscription,
      { upsert: true }
    );
    console.log("Push aboneliği kaydedildi ✅");
    res.status(201).json({ message: "Abonelik kaydedildi" });
  } catch (err) {
    console.error("Abonelik kaydetme hatası ❌", err);
    res.status(500).json({ message: "Abonelik kaydedilemedi" });
  }
});

// Bildirim gönder
app.post("/sendNotification", async (req, res) => {
  const { title, body } = req.body;

  try {
    const subscriptions = await Subscription.find();

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          sub,
          JSON.stringify({ title, body })
        );
      } catch (error) {
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log("❌ Subscription expired, siliniyor:", sub.endpoint);
          await Subscription.deleteOne({ endpoint: sub.endpoint });
        } else {
          console.error("Push gönderim hatası:", error);
        }
      }
    }

    res.status(200).json({ message: "Bildirimler gönderildi" });
  } catch (err) {
    console.error("Bildirim gönderme hatası ❌", err);
    res.status(500).json({ message: "Bildirim gönderilemedi" });
  }
});

const PORT = process.env.PORT || 3000 || 3001;
app.listen(PORT, () => console.log(`Server ${PORT} portunda çalışıyor 🚀`));
