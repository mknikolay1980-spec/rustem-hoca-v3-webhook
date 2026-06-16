const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
const premiumId = process.env.TELEGRAM_PREMIUM_CHAT_ID;

function formatSignal({ asset, mode, action, entryPrice, tp, sl, slPts, tpPts, rr, filters, trTime }) {
    const dir   = action === 'BUY' ? '🟢 BUY' : '🔴 SELL';
    const modeTag = mode === 'SWING' ? '📈 SWING' : '⚡ SCALP';
    const passed  = filters.filter(f => f.pass).length;
    const filterLines = filters.map(f => `  ${f.pass ? '✅' : '❌'} ${f.reason}`).join('\n');

    return (
        `🏆 RUSTEM HOCA V4.5.2 FINAL\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${dir} | ${asset} | ${modeTag}\n` +
        `Entry : ${entryPrice}\n` +
        `TP    : ${tp}  (+${tpPts})\n` +
        `SL    : ${sl}  (-${slPts})\n` +
        `RR    : ${rr}\n` +
        (trTime ? `TR    : ${trTime}\n` : '') +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `FILTERS ${passed}/4:\n` +
        filterLines + '\n' +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ Risk yönetimi size ait. YTD.`
    );
}

function formatRejection({ asset, mode, reason, filters }) {
    const filterLines = (filters || []).map(f => `  ${f.pass ? '✅' : '❌'} ${f.reason}`).join('\n');
    return (
        `🚫 RUSTEM HOCA V4.5.2 — SİNYAL REDDEDİLDİ\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Sembol : ${asset || '?'} | ${mode || '?'}\n` +
        `Neden  : ${reason}\n` +
        (filterLines ? `Filters:\n${filterLines}\n` : '') +
        `━━━━━━━━━━━━━━━━━━━━━━━━`
    );
}

async function sendSignal(signalData) {
    const text = formatSignal(signalData);
    await bot.sendMessage(premiumId, text);
    return text;
}

async function sendRejection(data) {
    const text = formatRejection(data);
    await bot.sendMessage(premiumId, text);
    return text;
}

async function sendRaw(text) {
    await bot.sendMessage(premiumId, text);
}

module.exports = { sendSignal, sendRejection, sendRaw, formatSignal, formatRejection };
