const { getDXY, getDXYDaily, getVIX, getTNX, getForexFactoryNews, getCandles } = require('./api');

// ─── SHARED HELPERS ───────────────────────────────────────────────────────────

function avgVolume(candles) {
    const vols = candles.slice(1).map(c => parseFloat(c.volume || 0));
    const nonZero = vols.filter(v => v > 0);
    if (nonZero.length === 0) return 1;
    return nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
}

function swingHighLow(candles, start, count) {
    const slice = candles.slice(start, start + count);
    return {
        high: Math.max(...slice.map(c => parseFloat(c.high))),
        low:  Math.min(...slice.map(c => parseFloat(c.low))),
    };
}

// Liquidity sweep: prior swing pierced then price recovered back inside
function detectLiqSweep(candles, buffer = 0) {
    const { high: prevHigh, low: prevLow } = swingHighLow(candles, 2, 4);
    const currentHigh  = parseFloat(candles[1].high);
    const currentLow   = parseFloat(candles[1].low);
    const currentClose = parseFloat(candles[0].close);
    const bullSweep = currentLow < prevLow - buffer && currentClose > prevLow;
    const bearSweep = currentHigh > prevHigh + buffer && currentClose < prevHigh;
    return { detected: bullSweep || bearSweep, bullish: bullSweep };
}

// Structure break: close beyond prior swing high/low + buffer
function detectStructBreak(candles, buffer = 0) {
    const { high: swingHigh, low: swingLow } = swingHighLow(candles, 2, 4);
    const close = parseFloat(candles[0].close);
    const bullBreak = close > swingHigh + buffer;
    const bearBreak = close < swingLow  - buffer;
    return { detected: bullBreak || bearBreak, bullish: bullBreak };
}

// S/R retest: price within buffer of the broken structural level
function detectSRRetest(candles, buffer = 0) {
    const { high: swingHigh, low: swingLow } = swingHighLow(candles, 2, 4);
    const close = parseFloat(candles[0].close);
    const bullBreak = close > swingHigh;
    const bearBreak = close < swingLow;
    if (!bullBreak && !bearBreak) return { detected: false };
    const retestBull = bullBreak && Math.abs(close - swingHigh) <= buffer;
    const retestBear = bearBreak && Math.abs(close - swingLow)  <= buffer;
    return { detected: retestBull || retestBear, bullish: retestBull };
}

// ─── XAUUSD SCALP ─────────────────────────────────────────────────────────────

async function xauScalp_LiqSweepH1() {
    const candles = await getCandles('XAU/USD', '1h', 10);
    const sweep = detectLiqSweep(candles, 0);
    return {
        pass: sweep.detected,
        reason: sweep.detected
            ? `LIQ_SWEEP H1 ${sweep.bullish ? 'bullish' : 'bearish'} sweep confirmed`
            : 'LIQ_SWEEP H1: no sweep detected',
    };
}

async function xauScalp_Vol1_8X() {
    const candles = await getCandles('XAU/USD', '15min', 20);
    const vol = parseFloat(candles[0].volume || 0);
    const avg = avgVolume(candles);
    const ratio = avg > 0 ? vol / avg : 0;
    return {
        pass: ratio >= 1.8,
        reason: `VOL_1.8X: current ${ratio.toFixed(2)}x avg (need ≥1.8x)`,
    };
}

async function xauScalp_TrendPosH4() {
    // 75/25 rule: price in top 75% (bull) or bottom 25% (bear) of H4 range
    const candles = await getCandles('XAU/USD', '4h', 10);
    const { high, low } = swingHighLow(candles, 0, 5);
    const close = parseFloat(candles[0].close);
    const range = high - low;
    const pct = range > 0 ? (close - low) / range : 0.5;
    const bullZone = pct >= 0.75;
    const bearZone = pct <= 0.25;
    return {
        pass: bullZone || bearZone,
        reason: `TREND_POS H4: ${(pct * 100).toFixed(1)}% — ${bullZone ? 'BULL ≥75%' : bearZone ? 'BEAR ≤25%' : 'NEUTRAL (need 75/25)'}`,
    };
}

async function xauScalp_DXYMomentum() {
    const dxy = await getDXY('1h');
    const pass = dxy.momentum <= -0.1;
    return {
        pass,
        reason: `DXY_MOMENTUM: ${dxy.momentum.toFixed(3)}% (need ≤-0.1% for gold bullish)`,
    };
}

// ─── US30 SCALP ───────────────────────────────────────────────────────────────

async function us30Scalp_LiqSweepH4() {
    const candles = await getCandles('DJI', '4h', 10);
    const sweep = detectLiqSweep(candles, 10); // +10pt buffer
    return {
        pass: sweep.detected,
        reason: sweep.detected
            ? `LIQ_SWEEP H4 +10pts: ${sweep.bullish ? 'bullish' : 'bearish'} sweep confirmed`
            : 'LIQ_SWEEP H4 +10pts: no sweep detected',
    };
}

async function us30Scalp_Vol1_5X() {
    const candles = await getCandles('DJI', '15min', 20);
    const vol = parseFloat(candles[0].volume || 0);
    const avg = avgVolume(candles);
    const ratio = avg > 0 ? vol / avg : 0;
    return {
        pass: ratio >= 1.5,
        reason: `VOL_1.5X: current ${ratio.toFixed(2)}x avg (need ≥1.5x)`,
    };
}

async function us30Scalp_TrendPosH4() {
    // 80/20 rule
    const candles = await getCandles('DJI', '4h', 10);
    const { high, low } = swingHighLow(candles, 0, 5);
    const close = parseFloat(candles[0].close);
    const range = high - low;
    const pct = range > 0 ? (close - low) / range : 0.5;
    const bullZone = pct >= 0.80;
    const bearZone = pct <= 0.20;
    return {
        pass: bullZone || bearZone,
        reason: `TREND_POS H4: ${(pct * 100).toFixed(1)}% — ${bullZone ? 'BULL ≥80%' : bearZone ? 'BEAR ≤20%' : 'NEUTRAL (need 80/20)'}`,
    };
}

async function us30Scalp_VIXMomentum() {
    const vix = await getVIX();
    const pass = vix.momentum <= -2.0;
    return {
        pass,
        reason: `VIX_MOMENTUM: ${vix.momentum.toFixed(2)}% (need ≤-2% for US30 bullish)`,
    };
}

// ─── XAUUSD SWING ─────────────────────────────────────────────────────────────

async function xauSwing_StructBreakH4() {
    const candles = await getCandles('XAU/USD', '4h', 10);
    const sb = detectStructBreak(candles, 2); // +2$ buffer
    return {
        pass: sb.detected,
        reason: sb.detected
            ? `STRUCT_BREAK H4 +2$: ${sb.bullish ? 'bullish' : 'bearish'} break confirmed`
            : 'STRUCT_BREAK H4 +2$: no structural break',
    };
}

async function xauSwing_DXYTrendAlignD1() {
    const dxy = await getDXYDaily();
    const pass = dxy.momentum < 0;
    return {
        pass,
        reason: `DXY_TREND D1: ${dxy.momentum.toFixed(3)}% — ${pass ? 'bearish DXY aligns gold long' : 'bullish DXY not aligned'}`,
    };
}

async function xauSwing_SRRetestD1() {
    const candles = await getCandles('XAU/USD', '1day', 10);
    const retest = detectSRRetest(candles, 1); // ±1$ tolerance
    return {
        pass: retest.detected,
        reason: retest.detected
            ? `SR_RETEST D1 +1$: ${retest.bullish ? 'support' : 'resistance'} retest confirmed`
            : 'SR_RETEST D1 +1$: no valid S/R retest',
    };
}

async function xauSwing_NewsBlackout() {
    const news = await getForexFactoryNews();
    const blocked = news.length > 0;
    return {
        pass: !blocked,
        reason: blocked
            ? `NEWS_BLACKOUT: ${news.length} high-impact event(s) within ±30min`
            : 'NEWS_BLACKOUT: clear — no high-impact news within 30min',
    };
}

// ─── US30 SWING ───────────────────────────────────────────────────────────────

async function us30Swing_StructBreakH4() {
    const candles = await getCandles('DJI', '4h', 10);
    const sb = detectStructBreak(candles, 50); // +50pt buffer
    return {
        pass: sb.detected,
        reason: sb.detected
            ? `STRUCT_BREAK H4 +50pts: ${sb.bullish ? 'bullish' : 'bearish'} break confirmed`
            : 'STRUCT_BREAK H4 +50pts: no structural break',
    };
}

async function us30Swing_MacroAlign() {
    const [vix, tnx, dxy] = await Promise.all([getVIX(), getTNX(), getDXY('1h')]);
    // Bullish macro: VIX falling, yields stable/falling, DXY weak
    const vixOk = vix.momentum <= 0;
    const tnxOk = tnx.momentum <= 0.5;
    const dxyOk = dxy.momentum <= 0.1;
    const pass = vixOk && tnxOk && dxyOk;
    return {
        pass,
        reason: `MACRO_ALIGN VIX${vix.momentum.toFixed(2)}% TNX${tnx.momentum.toFixed(2)}% DXY${dxy.momentum.toFixed(2)}% — ${pass ? 'all aligned' : 'not aligned'}`,
    };
}

async function us30Swing_SRRetestD1() {
    const candles = await getCandles('DJI', '1day', 10);
    const retest = detectSRRetest(candles, 20); // ±20pt tolerance
    return {
        pass: retest.detected,
        reason: retest.detected
            ? `SR_RETEST D1 +20pts: ${retest.bullish ? 'support' : 'resistance'} retest confirmed`
            : 'SR_RETEST D1 +20pts: no valid S/R retest',
    };
}

async function us30Swing_EarningsBlackout() {
    const news = await getForexFactoryNews();
    const usEvents = news.filter(e => (e.country || '').toUpperCase() === 'USD');
    const blocked = usEvents.length > 0;
    return {
        pass: !blocked,
        reason: blocked
            ? `EARNINGS_BLACKOUT: ${usEvents.length} USD high-impact event(s) within ±30min`
            : 'EARNINGS_BLACKOUT: clear — no USD events within 30min',
    };
}

// ─── REGISTRY ─────────────────────────────────────────────────────────────────

const FILTER_MAP = {
    XAUUSD: {
        SCALP: [xauScalp_LiqSweepH1, xauScalp_Vol1_8X, xauScalp_TrendPosH4, xauScalp_DXYMomentum],
        SWING: [xauSwing_StructBreakH4, xauSwing_DXYTrendAlignD1, xauSwing_SRRetestD1, xauSwing_NewsBlackout],
    },
    US30: {
        SCALP: [us30Scalp_LiqSweepH4, us30Scalp_Vol1_5X, us30Scalp_TrendPosH4, us30Scalp_VIXMomentum],
        SWING: [us30Swing_StructBreakH4, us30Swing_MacroAlign, us30Swing_SRRetestD1, us30Swing_EarningsBlackout],
    },
};

async function runFilters(symbol, mode) {
    const filters = FILTER_MAP[symbol]?.[mode];
    if (!filters) throw new Error(`No filter set for ${symbol} ${mode}`);
    const settled = await Promise.allSettled(filters.map(fn => fn()));
    return settled.map((r, i) => {
        if (r.status === 'rejected') {
            return { name: filters[i].name, pass: false, reason: `Error: ${r.reason?.message}` };
        }
        return { name: filters[i].name, ...r.value };
    });
}

module.exports = { runFilters, FILTER_MAP };
