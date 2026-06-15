const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const premiumId = process.env.TELEGRAM_PREMIUM_CHAT_ID;

const bot = new TelegramBot(token, { polling: false });

function formatSignal({ symbol, action, price, tp, sl }) {
    return `🚀 RUSTEM HOCA V3 SİNYAL 🚀\n\nSembol: ${symbol}\nYön: ${action}\nEntry: ${price}\nTP: ${tp}\nSL: ${sl}\n\nRisk yönetimi size ait. YTD.`;
}

const express = require('express');
const app = express();
app.use(express.json());

app.get('/webhook', (req, res) => res.send('Webhook is active'));

// TradingView Webhook Endpoint
app.post('/webhook', async (req, res) => {
    const { symbol, action, price, tp, sl } = req.body;

    if (!symbol || !action || !price || !tp || !sl) {
        return res.status(400).send('Missing fields');
    }

    try {
        await bot.sendMessage(premiumId, formatSignal({ symbol, action, price, tp, sl }));
        console.log(`Signal sent: ${symbol} ${action} @ ${price}`);
        res.status(200).send('OK');
    } catch (err) {
        console.error('Telegram error:', err.message);
        res.status(500).send('Failed');
    }
});

// Test endpoint
app.get('/test-signal', async (req, res) => {
    const testSignal = {
        symbol: 'XAUUSD',
        action: 'BUY',
        price: '3385.50',
        tp: '3392.00',
        sl: '3381.00',
    };

    try {
        await bot.sendMessage(premiumId, formatSignal(testSignal));
        console.log('Test signal sent');
        res.send('Test signal sent to Telegram');
    } catch (err) {
        console.error('Telegram error:', err.message);
        res.status(500).send('Failed: ' + err.message);
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`RUSTEM HOCA V3 BOT started. Webhook server running on port: ${PORT}`);
});
