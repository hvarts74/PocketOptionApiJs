const moment = require("moment/moment");
const WebSocketClient = require("./src/ws");

const ssid = `42["auth",{"session":"knp5iga4ok9e5jj5psmp50hlrh","isDemo":1,"uid":89012109,"platform":1}]`
const wsUrl = 'wss://demo-api-eu.po.market/socket.io/?EIO=4&transport=websocket'
const client = new WebSocketClient(wsUrl, ssid);

client.connect();

function generateIndex() {
    const rand = Math.floor(Math.random() * 90) + 10; // Генерация случайного числа от 10 до 99
    const cu = Math.floor(Date.now() / 1000); // Текущее время в секундах
    const t = cu + (2 * 60 * 60); // Добавление 2 часов к текущему времени
    const index = parseInt(`${t}${rand}`); // Конкатенация и преобразование в число
    return index;
}
const fetchCandleData = async (asset, period, count, endTime) => {
    const timeSync = Math.floor(client.getServerTime());
    const timeRounded = Math.floor(timeSync / period) * period;

    const data = {
            asset: asset, // Название актива, например "AUDNZD_otc"
            index: generateIndex(), // Конечное время
            time: timeRounded, // Таймстамп
            offset: count, // Количество свечей
            period: period, // Интервал свечей в секундах (например, 60)
        }

    let result = await client.sendRequest('loadHistoryPeriod', data)

    const formattedData = result.data.map((item) => ({
        time: moment.unix(item.time).format('YYYY-MM-DD HH:mm:ss'),
        open: item.open,
        close: item.close,
        high: item.high,
        low: item.low,
    }));

    return formattedData
};


client.on('authorized', () => {
    console.log('AUTH SUCCESS!!!');

// Запускаем бесконечный цикл с паузой в 5 секунд
    setInterval(async () => {
        const candles = await fetchCandleData('EURJPY_otc', 60, 6000);
        console.log(candles)
    }, 5000);
})
