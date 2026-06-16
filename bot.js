require('dotenv').config();
const express = require('express');
const { processSignal, detectAsset, detectMode } = require('./src/engine');
const { sendSignal, sendRejection, sendRaw } = require('./src/telegram');
const { runFilters } = require('./src/filterPool');
const { calcSLTP } = require('./src/sltp');
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

const app = express();
app.use(express.json());

// ─── HEALTH ───────────────────────────────────────────────────────────────────

app.get('/', (req, res) => res.json({ status: 'RUSTEM HOCA V4.5.2 FINAL', uptime: process.uptime() }));
app.get('/webhook', (req, res) => res.json({ status: 'ok', version: 'V4.5.2' }));

// ─── MAIN WEBHOOK ─────────────────────────────────────────────────────────────
// Expected body: { symbol, action, price, mode? }
// mode defaults to SCALP; pass "SWING" for swing trades

app.post('/webhook', async (req, res) => {
    const { symbol, action, price, mode } = req.body;

    if (!symbol || !action || !price) {
        return res.status(400).json({ error: 'Missing required fields: symbol, action, price' });
    }

    try {
        const result = await processSignal({ symbol, action, price, mode });

        if (!result.valid) {
            console.log(`[REJECT] ${symbol} ${action} — ${result.reason}`);
            await sendRejection({
                asset: result.asset || detectAsset(symbol),
                mode:  result.mode  || detectMode(mode),
                reason: result.reason,
                filters: result.filters,
            }).catch(() => {});
            return res.status(200).json({ status: 'rejected', reason: result.reason, filters: result.filters });
        }

        console.log(`[SIGNAL] ${result.asset} ${result.action} ${result.mode} @ ${result.entryPrice} TP:${result.tp} SL:${result.sl}`);
        await sendSignal(result);
        return res.status(200).json({ status: 'ok', signal: result });
    } catch (err) {
        console.error('[ERROR] webhook:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

// ─── TEST SIGNAL ──────────────────────────────────────────────────────────────

app.get('/test-signal', async (req, res) => {
  const symbol = req.query.symbol || 'XAUUSD';
  let msg = '';

  if (symbol === 'US30') {
    msg = `🏆 RUSTEM HOCA V4.5.2 FINAL
------------------------------
🟢 BUY | US30 | ⚡ SCALP
Entry : 44250.5
TP1 : 44350.5  | R:R 1:1
TP2 : 44450.5  | R:R 1:2
TP3 : 44550.5  | R:R 1:3
SL : 44150.5
------------------------------
⚠️ Risk yönetimi size ait. YTD.`;
  } else {
    msg = `🏆 RUSTEM HOCA V4.5.2 FINAL
------------------------------
🟢 BUY | XAUUSD | ⚡ SCALP
Entry : 3392.5
TP1 : 3397.5   | R:R 1:1
TP2 : 3402.5   | R:R 1:2
TP3 : 3407.5   | R:R 1:3
SL : 3390
------------------------------
⚠️ Risk yönetimi size ait. YTD.`;
  }

  try {
    await bot.sendMessage(process.env.TELEGRAM_PREMIUM_CHAT_ID, msg);
    return res.send('OK');
  } catch (err) {
    console.error('[ERROR] test-signal sendMessage:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── BACKTEST ─────────────────────────────────────────────────────────────────
// POST /backtest — run filter check on a batch of historical signals (dry-run, no Telegram)
// Body: { signals: [{ symbol, action, price, mode, timestamp? }] }
// Returns each signal with pass/fail and filter breakdown

app.post('/backtest', async (req, res) => {
    const { signals } = req.body;

    if (!Array.isArray(signals) || signals.length === 0) {
        return res.status(400).json({ error: 'Provide signals: [{ symbol, action, price, mode? }]' });
    }
    if (signals.length > 50) {
        return res.status(400).json({ error: 'Max 50 signals per backtest request' });
    }

    const results = [];

    for (const sig of signals) {
        const { symbol, action, price, mode: rawMode, timestamp } = sig;
        if (!symbol || !action || !price) {
            results.push({ input: sig, valid: false, reason: 'Missing symbol/action/price' });
            continue;
        }

        try {
            const asset = detectAsset(symbol);
            const mode  = detectMode(rawMode);
            if (!asset) {
                results.push({ input: sig, valid: false, reason: `Unknown symbol: ${symbol}` });
                continue;
            }

            const filterResults = await runFilters(asset, mode);
            const passed = filterResults.filter(f => f.pass).length;
            const allPass = passed === 4;

            let sltp = null;
            if (allPass) {
                // Use fixed SL/TP (no live ATR candles in backtest)
                const fakeCandles = Array(20).fill({ high: price, low: price, close: price });
                sltp = calcSLTP({ symbol: asset, action: action.toUpperCase(), entryPrice: parseFloat(price), mode, atrCandles: fakeCandles });
            }

            results.push({
                timestamp: timestamp || null,
                input: { symbol: asset, action, price: parseFloat(price), mode },
                valid: allPass,
                passedFilters: passed,
                filters: filterResults,
                sltp,
            });
        } catch (err) {
            results.push({ input: sig, valid: false, reason: `Error: ${err.message}` });
        }
    }

    const summary = {
        total:   results.length,
        passed:  results.filter(r => r.valid).length,
        rejected: results.filter(r => !r.valid).length,
        passRate: `${((results.filter(r => r.valid).length / results.length) * 100).toFixed(1)}%`,
    };

    return res.json({ summary, results });
});

// ─── FILTER STATUS ────────────────────────────────────────────────────────────
// GET /filters?symbol=XAUUSD&mode=SCALP — live filter check without sending signal

app.get('/filters', async (req, res) => {
    const symbol = (req.query.symbol || 'XAUUSD').toUpperCase();
    const mode   = (req.query.mode   || 'SCALP').toUpperCase();
    const asset  = detectAsset(symbol);
    if (!asset) return res.status(400).json({ error: `Unknown symbol: ${symbol}` });

    try {
        const filters = await runFilters(asset, mode);
        const passed = filters.filter(f => f.pass).length;
        return res.json({ asset, mode, passed: `${passed}/4`, filters });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ─── START ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`RUSTEM HOCA V4.5.2 FINAL started on port ${PORT}`);
    console.log('Endpoints: POST /webhook  GET /test-signal  POST /backtest  GET /filters');
});
