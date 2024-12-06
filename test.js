const moment = require("moment/moment");
const WebSocketClient = require("./src/client");

const ssid = `42["auth",{"session":"ukdgau9urq0em5ukspkcmej67n","isDemo":1,"uid":84894043,"platform":1}]`
const wsUrl = 'wss://demo-api-eu.po.market/socket.io/?EIO=4&transport=websocket'

const client = new WebSocketClient(wsUrl, ssid);

client.connect();

client.on('authorized', async () => {
    setInterval(async () => {
        const candles = await client.getCandles('EURJPY_otc', 60, 900);
        // console.log(candles)

        const formattedData = candles.data.map((item) => ({
            time: moment.unix(item.time).format('YYYY-MM-DD HH:mm:ss'),
            open: item.open,
            close: item.close,
            high: item.high,
            low: item.low,
        }));
        //
        console.log(formattedData)
    }, 5000);
})
