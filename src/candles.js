import axios from "axios";
import { RSI, SMA, CrossUp, CrossDown } from "technicalindicators";
import { Bot } from "grammy";
import { batchCandlesJSON } from "candlestick-convert";

const bot = new Bot("7800246635:AAGAt1KVZD2ABruE8Bpv8KFono5j2ajEnDg");

// Массив валютных пар
const currencyPairs = [
    'OTC-AUDCAD', 'OTC-AUDCHF', 'OTC-AUDNZD', 'OTC-AUDUSD',
    'OTC-CADCHF', 'OTC-CADJPY', 'OTC-CHFJPY', 'OTC-CHFNOK',
    'OTC-EURCHF', 'OTC-EURGBP', 'OTC-EURJPY', 'OTC-EURNZD',
    'OTC-EURRUB', 'OTC-EURTRY', 'OTC-EURUSD', 'OTC-NZDJPY',
    'OTC-USDBDT', 'OTC-USDCAD', 'OTC-USDCLP', 'OTC-USDIDR',
    'OTC-USDINR', 'OTC-USDMYR', 'OTC-USDPHP', 'OTC-USDRUB',
    'OTC-USDPKR', 'OTC-USDJPY', 'OTC-GBPJPY', 'OTC-USDVND',
    'OTC-USDTHB', 'OTC-USDCHF', 'OTC-USDCOP', 'OTC-USDCNH',
    'OTC-GBPAUD', 'OTC-AUDJPY'
];

// Функция для получения и обработки данных
async function analyzeCurrencyPair(pair) {
    try {
        const response = await axios.get(`http://136.244.70.24/candles/?terminal=MT5&user=demo&limit=6000&broker=pko&asset=${pair}&period=60`, {

        });

        const dataString = response.data;
        const records = dataString.split('$');
        const parsedData = [];

        // Парсинг данных свечей
        for (const record of records) {
            if (record.trim()) {
                const fields = record.split('|');
                if (fields.length === 7) {
                    parsedData.push({
                        symbol: fields[0],
                        time: parseInt(fields[1], 10) * 1000,
                        open: parseFloat(fields[2]),
                        high: parseFloat(fields[3]),
                        low: parseFloat(fields[4]),
                        close: parseFloat(fields[5]),
                        volume: parseInt(fields[6], 10),
                    });
                }
            }
        }
        const twoMinuteCandles = batchCandlesJSON(parsedData, 60, 120);

        const data = await addIndicators(twoMinuteCandles)

        // Генерация сигналов
        const signal = await generateSignal(data, pair);

        console.log(`Пара: ${pair}, Сигнал: ${signal}`);

    } catch (error) {
        console.error(`Ошибка при анализе пары ${pair}:`, error.message);
    }
}


async function addIndicators(data){
    const closePrices = data.map(item => item.close);

    const rsi = RSI.calculate({ period: 13, values: closePrices });
    const sma2 = SMA.calculate({ period: 2, values: closePrices });
    const sma5 = SMA.calculate({period : 5, values : closePrices})

    const crossUp = CrossUp.calculate({
        lineA: sma2,
        lineB: sma5
    })

    const crossDown = CrossDown.calculate({
        lineA: sma2,
        lineB: sma5
    })

    // Синхронизация результатов с данными
    const results = data.map((item, index) => ({
        ...item,
        sma2: sma2[index - (2 - 1)] || null,
        sma5: sma5[index - (5 - 1)] || null,
        rsi: rsi[index - (14 - 1)] || null,
        crossUp: crossUp[index - (5 - 1)] || false,
        crossDown: crossDown[index - (5 - 1)] || false,
    }));

    // console.log(results.slice(-20)[0].symbol, results.slice(-20)[0].high);

    return results
}

function crossUp(current1, current2, prev1, prev2) {
    return prev1 <= prev2 && current1 > current2;
}

function crossDown(current1, current2, prev1, prev2) {
    return prev1 >= prev2 && current1 < current2;
}


// Функция для генерации сигнала
async function generateSignal(data, pair) {
    const lastIndex = data.length - 1;
    if (lastIndex <= 0) return "Нет сигнала";

    const current = data[lastIndex];
    const previous = data[lastIndex - 1];
    const fPair = formatPair(pair)

    if (current.sma2 && current.sma5 && previous.sma2 && previous.sma5) {
        // console.log(`current.sma2: ${current.sma2},\ncurrent.sma5: ${current.sma5},\nprevious.sma2: ${previous.sma2},\nprevious.sma5: ${previous.sma5},\ncurrent.rsi: ${current.rsi}`)

        if (current.crossUp && current.rsi >= 40 && current.rsi <= 60) {
            await bot.api.sendMessage('-1002331215393', `<code>${fPair}</code> OTC — 🟢\n\nClose: ${current.close}\nHigh: ${current.high}\nRSI: ${current.rsi}`, {
                parse_mode: 'HTML'
            })
            return "Покупка";
        }
        if (current.crossDown && current.rsi >= 40 && current.rsi <= 60) {
            await bot.api.sendMessage('-1002331215393', `<code>${fPair}</code> OTC — 🔴\n\nЦена: ${current.close}\nHigh: ${current.high}\nRSI: ${current.rsi}`, {
                parse_mode: 'HTML'
            })
            return "Продажа";
        }
    }
    return "Нет сигнала";
}

function formatPair(pair) {
    // Убираем префикс "OTC-" и разделяем валюты
    const [prefix, currencies] = pair.split('-');
    const formattedCurrencies = currencies.slice(0, 3) + '/' + currencies.slice(3); // AUD/CAD
    return `${formattedCurrencies}`; // AUD/CAD OTC
}

(async function analyzePairsInLoop() {
    while (true) {
        for (const pair of currencyPairs) {
            await analyzeCurrencyPair(pair);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Задержка 1 секунда между запросами
        }
        console.log('Цикл анализа завершен. Повтор через 60 секунд.');
        await new Promise(resolve => setTimeout(resolve, 60000)); // Задержка 60 секунд перед повторным циклом
    }
})();

