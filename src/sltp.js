function calcATR(candles, period = 14) {
    const trs = [];
    for (let i = 1; i < Math.min(candles.length, period + 1); i++) {
        const high = parseFloat(candles[i - 1].high);
        const low = parseFloat(candles[i - 1].low);
        const prevClose = parseFloat(candles[i].close);
        trs.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
    }
    if (trs.length === 0) return 0;
    return trs.reduce((a, b) => a + b, 0) / trs.length;
}

function buildResult(action, entryPrice, slPts, rrMultiplier, decimals) {
    const tpPts = slPts * rrMultiplier;
    const sign = action === 'BUY' ? 1 : -1;
    const fix = v => parseFloat(v.toFixed(decimals));
    return {
        sl: fix(entryPrice - sign * slPts),
        tp: fix(entryPrice + sign * tpPts),
        slPts: fix(slPts),
        tpPts: fix(tpPts),
        rr: `${rrMultiplier.toFixed(1)}R`,
    };
}

function calcXAUUSD(action, entryPrice, mode, atrCandles) {
    if (mode === 'SCALP') return buildResult(action, entryPrice, 5, 1.5, 2);   // midpoint of 4-6$
    const sl = calcATR(atrCandles, 14) * 2;
    return buildResult(action, entryPrice, sl, 2.0, 2);
}

function calcUS30(action, entryPrice, mode, atrCandles) {
    if (mode === 'SCALP') return buildResult(action, entryPrice, 50, 1.5, 0);  // midpoint of 40-60pts
    const sl = calcATR(atrCandles, 14) * 2;
    return buildResult(action, entryPrice, sl, 2.0, 0);
}

function calcSLTP({ symbol, action, entryPrice, mode, atrCandles }) {
    if (symbol === 'XAUUSD') return calcXAUUSD(action, entryPrice, mode, atrCandles);
    if (symbol === 'US30')   return calcUS30(action, entryPrice, mode, atrCandles);
    throw new Error(`Unknown symbol for SL/TP: ${symbol}`);
}

module.exports = { calcSLTP, calcATR };
