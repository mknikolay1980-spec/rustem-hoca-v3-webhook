const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const premiumId = process.env.TELEGRAM_PREMIUM_CHAT_ID;

const bot = new TelegramBot(token, {polling: false});

function generateSignal() {
    const now = new Date();
    const hour = now.getHours();
    
    if (hour < 10 || hour > 22) {
        console.log('Off session. Signal skipped.');
        return null;
    }
    
    const direction = Math.random() > 0.5 ? 'BUY' : 'SELL';
    const basePrice = 3385.50;
    const entry = (basePrice + (Math.random() * 10 - 5)).toFixed(2);
    
    let tp1, tp2, tp3, sl;
    
    if (direction === 'BUY') {
        tp1 = (parseFloat(entry) + 2.50).toFixed(2);
        tp2 = (parseFloat(entry) + 5.00).toFixed(2); 
        tp3 = (parseFloat(entry) + 8.00).toFixed(2);
        sl = (parseFloat(entry) - 3.00).toFixed(2);
    } else {
        tp1 = (parseFloat(entry) - 2.50).toFixed(2);
        tp2 = (parseFloat(entry) - 5.00).toFixed(2);
        tp3 = (parseFloat(entry) - 8.00).toFixed(2);
        sl = (parseFloat(entry) + 3.00).toFixed(2);
    }
    
    return {
        pair: 'XAUUSD',
        direction, entry, tp1, tp2, tp3, sl,
        time: now.toLocaleTimeString('en-GB', {hour: '2-digit', minute:'2-digit'})
    };
}

function formatSignal(s) {
    return `**RUSTEM HOCA V3 SIGNAL**

${s.pair} ${s.direction}
Entry: \`${s.entry}\`

TP1: \`${s.tp1}\` 
TP2: \`${s.tp2}\`
TP3: \`${s.tp3}\`

SL: \`${s.sl}\` | 3$ Risk

Time: ${s.time} 
_Risk management required. NFA._`;
}

async function sendSignal() {
    const signal = generateSignal();
    if (!signal) return;
    
    try {
        await bot.sendMessage(premiumId, formatSignal(signal), {parse_mode: 'Markdown'});
        console.log(`[${signal.time}] Signal sent: ${signal.direction} @ ${signal.entry}`);
    } catch (err) {
        console.error('ERROR:', err.message);
    }
}

console.log('RUSTEM HOCA V3 BOT started...');
console.log('Premium Channel ID:', premiumId);

// Old auto-signal system disabled. Using TradingView Webhook now.
// setTimeout(sendSignal, 10000);
// setInterval(sendSignal, 4 * 60 * 60 * 1000);

const express = require('express');
const app = express();
app.use(express.json());

// TradingView Webhook Endpoint
app.post('/webhook', (req, res) => {
    const data = req.body;
    
    const message = `🚨 XAUUSD ${data.direction} SIGNAL #${data.id}

Entry: ${data.entry}
SL1: ${data.sl1} [Close 50%] | SL2: ${data.sl2} [Close 50%]
TP1: ${data.tp1} | TP2: ${data.tp2}

Risk Management: Adjust lot size to not exceed 1% of your account.
Reason: ${data.reasons}

🎯 Bot: 10-Year Rule Set V2`;
    
    bot.sendMessage(premiumId, message);
    res.status(200).send('OK');
});

// Start Express Server for Render
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Webhook server running on port: ${PORT}`);
});