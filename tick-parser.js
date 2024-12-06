const WebSocket = require('ws')
const {Agent} = require("https")
const EventEmitter = require('events')
const _ = require("lodash")
const moment = require("moment")
const crypto = require('crypto')

class WebSocketClient extends EventEmitter {
    constructor(url, ssid) {
        super();
        this.url = url;
        this.ssid = ssid
        this.websocket = null;
        this.pendingRequests = {}; // Хранилище для обработки ответов
        this.updateStream = false
        this.serverTime = null

        this.tickStorage = {}
        this.interval = 60
    }

    connect() {
        this.websocket = new WebSocket(this.url, {
            headers: {
                Origin: 'https://pocketoption.com',
                'Cache-Control': 'no-cache',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                "Upgrade": "websocket",
                "Connection": "upgrade",
                "Sec-Websocket-Key": crypto.randomBytes(16).toString('base64'),
                "Sec-Websocket-Version": '13',
                "Host": 'demo-api-eu.po.market'
            },
            agent: new Agent({
                rejectUnauthorized: false, // Отключить проверку сертификатов
                requestCert: true,
            }),
        });

        this.websocket.on('open', () => {
            console.log('WebSocket connected.')
        });

        this.websocket.on('message', (message) => {
            this.handleMessage(message)
        });

        this.websocket.on('close', (err) => {
             console.log({
                message: 'WebSocket closed. Reconnecting...',
                error: err
            })
            setTimeout(() => this.connect(), 1000)
        });

        this.websocket.on('error', (err) => {
             console.log({
                message: 'WebSocket error',
                error: err
            })
        });
    }

    sendMessage(message){
        this.websocket.send(message)
        // console.log('Отправили: ' + message)
    }

    handleTick(asset, timestamp, price){
        const currentTime = moment.unix(Math.floor(timestamp / this.interval) * this.interval).utc().format("YYYY-MM-DD HH:mm") // Начало текущей минуты

        // Если свечи ещё нет или наступил новый интервал
        if (!this.tickStorage[asset] || this.tickStorage[asset].time !== currentTime) {
            if (this.tickStorage[asset]) {
                // Завершить предыдущую свечу
                console.log(`Candle for ${asset}:`, this.tickStorage[asset])
            }

            // Создать новую свечу
            this.tickStorage[asset] = {
                time: currentTime,
                open: price,
                high: price,
                low: price,
                close: price,
            };
        } else {
            // Обновить текущую свечу
            const candle = this.tickStorage[asset]
            candle.high = Math.max(candle.high, price) // Обновить максимум
            candle.low = Math.min(candle.low, price)  // Обновить минимум
            candle.close = price                     // Закрытие
        }
    }

    handleMessage(message) {
        try {
            if (Buffer.isBuffer(message)) {
                message = message.toString('utf-8').trim() // Декодируем Buffer в строку
            }

            // Получаем время ws сервера и производим синхронизация
            if(this.updateStream && message.startsWith('[[')) {
                const data = eval(message) // 1732927504.36
                const [asset, timestamp, price] = data[0]

                this.handleTick(asset, timestamp, price)
                this.updateStream = false
            }

            if (typeof message === "string") {
                if (message.startsWith('0{"sid":"')) {
                    this.sendMessage("40")
                } else if (message === "2") {
                    this.sendMessage("3")
                } else if (message.startsWith('40{"sid":"')) {
                    this.sendMessage(this.ssid)
                } else if (message.startsWith('451-[')) {
                    const jsonPart = message.split('-', 2)[1]
                    const jsonMessage = JSON.parse(jsonPart)


                    switch (jsonMessage[0]) {
                        case "successauth":
                            this.emit('authorized');
                            console.log('AUTH SUCCESS!!!');
                            break;
                        case "successupdateBalance":
                            // console.log("Balance updated successfully");
                            break;
                        case "successopenOrder":
                            // console.log("Order opened successfully");
                            break;
                        case "updateClosedDeals":
                            this.sendMessage(`42["changeSymbol",{"asset":"AUDNZD_otc","period":${this.interval}]`)
                            // this.sendMessage(`42["changeSymbol",{"asset":"EURJPY_otc","period":${this.interval}}]`);
                            // console.log("Update closed deals received");
                            break;
                        case "successcloseOrder":
                            // console.log("Order closed successfully");
                            break;
                        case "loadHistoryPeriod":
                            // console.log("History period data loaded");
                            break;
                        case "updateStream":
                            this.updateStream = true
                            // console.log("Stream updated");
                            break;
                        case "updateHistoryNew":
                            console.log(message)
                            // console.log("New history updated");
                            break;
                        case "NotAuthorized":
                            console.error("Ошибка авторизации: проверьте ключ сессии и другие параметры.")
                            break;
                        default:
                        // console.log(`Unhandled 451 message: ${JSON.stringify(jsonMessage)}`);
                    }

                }
            }
        } catch (err) {
            console.error('Error processing message:', err)
        }
    }
}

const ssid = `42["auth",{"session":"ukdgau9urq0em5ukspkcmej67n","isDemo":1,"uid":84894043,"platform":1}]`
const wsUrl = 'wss://demo-api-eu.po.market/socket.io/?EIO=4&transport=websocket'

const client = new WebSocketClient(wsUrl, ssid)

client.connect()

client.on('authorized', async () => {
    setInterval(async () => {
        client.sendMessage('42["ps"]')
    }, 20000)
})


