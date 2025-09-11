// clearSubs.js
require('dotenv').config();
const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  endpoint: String,
  keys: {
    p256dh: String,
    auth: String
  }
});
const Subscription = mongoose.model('Subscription', subscriptionSchema);

mongoose.connect(process.env.MONGO_URI).then(async () => {
  await Subscription.deleteMany({});
  console.log("Tüm abonelikler silindi ✅");
  process.exit(0);
});
