const { runFilters } = require('./filterPool');
const { calcSLTP } = require('./sltp');
const { getCandles } = require('./api');

// Turkey stays on UTC+3 year-round (no DST since 2016)
const TR_OFFSET_MIN = 3 * 60;

function toTRMinutes() {
    const now = new Date();
    return now.getUTCHours() * 60 + now.getUTCMinutes() + TR_OFFSET_MIN;
}

function inTRWindow(startH, startM, endH, endM) {
    const current = toTRMinutes() % (24 * 60);
    const start = startH * 60 + startM;
    const end   = endH   * 60 + endM;
    return current >= start && current <= end;
}

function trTimeString() {
    const mins = toTRMinutes() % (24 * 60);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function detectAsset(raw) {
    const s = (raw || '').toUpperCase().replace(/\s/g, '');
    if (s.includes('XAU') || s === 'GOLD')                        return 'XAUUSD';
    if (s.includes('US30') || s.includes('DJI') || s === 'DOW')   return 'US30';
    return null;
}

function detectMode(raw) {
    return (raw || '').toUpperCase() === 'SWING' ? 'SWING' : 'SCALP';
}

// TwelveData symbols for candle fetches
const CANDLE_SYMBOL = { XAUUSD: 'XAU/USD', US30: 'DJI' };

async function processSignal({ symbol, action, price, mode: rawMode }) {
    const asset = detectAsset(symbol);
    if (!asset) {
        return { valid: false, reason: `Unrecognised symbol: "${symbol}". Supported: XAUUSD, US30` };
    }

    const mode = detectMode(rawMode);
    const act  = (action || '').toUpperCase();
    if (act !== 'BUY' && act !== 'SELL') {
        return { valid: false, reason: `Invalid action "${action}". Must be BUY or SELL` };
    }

    // US30 session gate: 16:30–23:00 TR time
    if (asset === 'US30' && !inTRWindow(16, 30, 23, 0)) {
        return {
            valid: false,
            reason: `US30 session closed. TR time is ${trTimeString()} (window: 16:30–23:00)`,
        };
    }

    const entryPrice = parseFloat(price);
    if (isNaN(entryPrice)) {
        return { valid: false, reason: `Invalid price: "${price}"` };
    }

    // Run all 4 filters concurrently
    const filterResults = await runFilters(asset, mode);
    const passed = filterResults.filter(f => f.pass).length;
    const allPass = passed === 4;

    if (!allPass) {
        return { valid: false, reason: `${passed}/4 filters passed`, filters: filterResults };
    }

    // Fetch H4 candles for ATR-based swing SL/TP
    const atrCandles = await getCandles(CANDLE_SYMBOL[asset], '4h', 20);
    const sltp = calcSLTP({ symbol: asset, action: act, entryPrice, mode, atrCandles });

    return {
        valid: true,
        asset,
        mode,
        action: act,
        entryPrice,
        ...sltp,
        filters: filterResults,
        trTime: trTimeString(),
    };
}

module.exports = { processSignal, detectAsset, detectMode };
