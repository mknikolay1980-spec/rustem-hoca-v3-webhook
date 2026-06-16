const axios = require('axios');

const TWELVEDATA_BASE = 'https://api.twelvedata.com';

async function fetchTwelveData(symbol, interval = '1day', outputsize = 5) {
    const key = process.env.TWELVEDATA_API_KEY;
    if (!key) throw new Error('TWELVEDATA_API_KEY not set in .env');
    const { data } = await axios.get(`${TWELVEDATA_BASE}/time_series`, {
        params: { symbol, interval, outputsize, apikey: key },
        timeout: 8000,
    });
    if (data.status === 'error') throw new Error(`TwelveData [${symbol}]: ${data.message}`);
    return data.values; // newest-first array
}

async function getDXY(interval = '1h') {
    const values = await fetchTwelveData('DXY', interval, 3);
    const current = parseFloat(values[0].close);
    const prev = parseFloat(values[1].close);
    return { current, momentum: ((current - prev) / prev) * 100 };
}

async function getDXYDaily() {
    return getDXY('1day');
}

async function getVIX() {
    const values = await fetchTwelveData('VIX', '1h', 3);
    const current = parseFloat(values[0].close);
    const prev = parseFloat(values[1].close);
    return { current, momentum: ((current - prev) / prev) * 100 };
}

async function getTNX() {
    const values = await fetchTwelveData('TNX', '1day', 3);
    const current = parseFloat(values[0].close);
    const prev = parseFloat(values[1].close);
    return { current, momentum: ((current - prev) / prev) * 100 };
}

async function getForexFactoryNews() {
    try {
        const { data } = await axios.get('https://nfs.faireconomy.media/ff_calendar_thisweek.json', {
            timeout: 8000,
        });
        const now = Date.now();
        return data.filter(event => {
            const diff = Math.abs(new Date(event.date).getTime() - now) / 60000;
            return event.impact === 'High' && diff <= 30;
        });
    } catch {
        return [];
    }
}

async function getCandles(symbol, interval, outputsize = 20) {
    return fetchTwelveData(symbol, interval, outputsize);
}

module.exports = { getDXY, getDXYDaily, getVIX, getTNX, getForexFactoryNews, getCandles };
