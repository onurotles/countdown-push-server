require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const webpush = require('web-push');
const cors = require('cors');
const cron = require('node-cron');

const app = express();
app.use(express.json());

// ✅ CORS ayarı
const allowedOrigins = [process.env.FRONTEND_URL, process.env.LOCAL_URL, 3000];
app.use(cors({
    origin: function(origin, callback){
        if(!origin) return callback(null, true);
        if(allowedOrigins.indexOf(origin) === -1){
            return callback(new Error('CORS izinli değil'), false);
        }
        return callback(null, true);
    }
}));

// ✅ Abonelik schema
const subscriptionSchema = new mongoose.Schema({
    endpoint: String,
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

// ✅ Subscribe endpoint
app.post('/subscribe', async (req, res) => {
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

// ✅ Send push manually
app.post('/sendNotification', async (req, res) => {
    const { title, body } = req.body;
    try {
        const subscriptions = await Subscription.find();
        const payload = JSON.stringify({ title, body });

        await Promise.all(subscriptions.map(sub => 
            webpush.sendNotification(sub, payload).catch(err => {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    console.log("❌ Subscription expired, siliniyor:", sub.endpoint);
                    return Subscription.deleteOne({ endpoint: sub.endpoint });
                } else {
                    console.error("Push gönderim hatası:", err);
                }
            })
        ));

        res.status(200).json({ message: "Bildirimler gönderildi ✅" });
    } catch (err) {
        console.error("Bildirim gönderme hatası ❌", err);
        res.status(500).json({ message: "Bildirim gönderilemedi" });
    }
});

// 🔹 Cron: Günlük bildirim (sabah 09:00)
cron.schedule('* * * * *', async () => {
    try {
        console.log("Günlük push bildirimi gönderiliyor...");
        const subscriptions = await Subscription.find();
        const payload = JSON.stringify({
            title: "Günlük Countdown",
            body: "Hedef tarihe kalan günleri kontrol et! 📅"
        });
        await Promise.all(subscriptions.map(sub =>
            webpush.sendNotification(sub, payload).catch(err => console.error(err))
        ));
        console.log("Günlük push bildirimi gönderildi ✅");
    } catch (err) {
        console.error("Cron push hatası:", err);
    }
});

// ✅ MongoDB bağlandıktan sonra server başlat
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB bağlantısı başarılı ✅");
        const PORT = process.env.PORT || 4000;
        app.listen(PORT, () => console.log(`Server ${PORT} portunda çalışıyor 🚀`));
    })
    .catch(err => {
        console.error("MongoDB bağlantı hatası ❌", err);
        process.exit(1); // Bağlanamazsa server başlatılmasın
    });
