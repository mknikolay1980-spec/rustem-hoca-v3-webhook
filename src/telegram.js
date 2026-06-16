const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
const premiumId = process.env.TELEGRAM_PREMIUM_CHAT_ID;

function formatSignal({ asset, mode, action, entryPrice, tp, sl, slPts, tpPts, rr, filters, trTime, reason }) {
    const dir       = (action || '').toUpperCase() === 'BUY' ? '🟢 BUY' : '🔴 SELL';
    const modeTag   = (mode  || '').toUpperCase() === 'SWING' ? '📈 SWING' : '⚡ SCALP';
    const safeFilters = Array.isArray(filters) ? filters : [];
    const passed    = safeFilters.filter(f => f.pass).length;
    const filterLines = safeFilters.length
        ? safeFilters.map(f => `  ${f.pass ? '✅' : '❌'} ${f.reason || f.name || '?'}`).join('\n')
        : '  (filtre bilgisi yok)';

    return (
        `🏆 RUSTEM HOCA V4.5.2 FINAL\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${dir} | ${asset || '?'} | ${modeTag}\n` +
        `Entry : ${entryPrice ?? '?'}\n` +
        `TP    : ${tp ?? '?'}  (+${tpPts})\n` +
        `SL    : ${sl ?? '?'}  (-${slPts})\n` +
        `RR    : ${rr}\n` +
        (trTime ? `TR    : ${trTime}\n` : '') +
        (reason ? `Not   : ${reason}\n` : '') +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `FILTERS ${passed}/${safeFilters.length || 4}:\n` +
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

function normalizeSignal(raw) {
    return {
        asset:      raw.asset      || raw.symbol                              || 'XAUUSD',
        mode:       raw.mode       || raw.type                                || 'SCALP',
        action:     raw.action     || raw.direction || raw.side               || 'BUY',
        entryPrice: raw.entryPrice || raw.entry     || raw.price              || 0,
        tp:         raw.tp                                                     || 0,
        sl:         raw.sl                                                     || 0,
        tpPts:      raw.tpPts      || (raw.tp && raw.entry ? (raw.tp - raw.entry).toFixed(2) : '—'),
        slPts:      raw.slPts      || (raw.entry && raw.sl ? (raw.entry - raw.sl).toFixed(2) : '—'),
        rr:         raw.rr                                                     || '—',
        filters:    raw.filters                                                || [],
        trTime:     raw.trTime                                                 || null,
        reason:     raw.reason                                                 || null,
    };
}

async function sendSignal(signalData) {
    const normalized = normalizeSignal(signalData);
    const text = formatSignal(normalized);
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
