const WebSocket = require('ws')
const {Agent} = require("https")
const isJSON = require('is-json')
const EventEmitter = require('events')
const _ = require("lodash")
const moment = require("moment")
const crypto = require('crypto');
const fs = require('fs'); // Подключаем модуль fs

class WebSocketClient extends EventEmitter {
    constructor(url, ssid) {
        super();
        this.url = url;
        this.ssid = ssid
        this.websocket = null;
        this.pendingRequests = {}; // Хранилище для обработки ответов
        this.updateStream = false
        this.serverTime = null
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
            console.log('WebSocket connected.');
        });

        this.websocket.on('message', (message) => {
            this.handleMessage(message);
        });

        this.websocket.on('close', () => {
            console.log('WebSocket closed. Reconnecting...');
            setTimeout(() => this.connect(), 1000);
        });

        this.websocket.on('error', (err) => {
            console.error('WebSocket error:', err);
        });
    }

    generateUniqueIndex() {
        // Генерация случайного числа в диапазоне от 10 до 99
        const rand = Math.floor(Math.random() * (99 - 10 + 1)) + 10;

        // Получение текущего времени + 2 часа, преобразование в Unix Timestamp
        const time = Math.floor((Date.now() + 2 * 60 * 60 * 1000) / 1000);

        // Конкатенация времени и случайного числа, преобразование в BigInt
        return parseInt(`${time}${rand}`);
    }

    getCandles(active, period, offset){
        // const time =  moment().unix()
        const time = Math.floor(this.serverTime / period) * period;

        const index = this.generateUniqueIndex()

        const data = {
            asset: active, // Название актива, например "AUDNZD_otc"
            index: index, // Конечное время
            time: time, // Таймстамп
            offset: offset, // Количество свечей
            period: period, // Интервал свечей в секундах (например, 60)
        }

        return new Promise((resolve, reject) => {
            this.pendingRequests[index] = { resolve, reject };
            try{
                this.sendMessage(`42["loadHistoryPeriod", ${JSON.stringify(data)}]`)
            }catch (err){
                reject(err);
            }
        })
    }

    sendMessage(message){
        this.websocket.send(message)
        // console.log('Отправили: ' + message)
    }

    handleMessage(message) {
        try {
            if (Buffer.isBuffer(message)) {
                message = message.toString('utf-8').trim(); // Декодируем Buffer в строку
            }



            // Получаем время ws сервера и производим синхронизация
            if(this.updateStream && message.startsWith('[[')) {
                const data = eval(message) // 1732927504.36
                const [asset, timestamp, price] = data[0];

                this.serverTime = Math.floor(timestamp);

                this.updateStream = false
            }


            if (isJSON(message.trim())) {
                const parsedMessage = JSON.parse(message)


                const { index, asset, period, data } = parsedMessage;

                if (index && this.pendingRequests[index]) {
                    const { resolve } = this.pendingRequests[index];
                    delete this.pendingRequests[index]; // Удаляем обработанный запрос

                    if (asset && data) {
                        resolve({ asset, period, data }); // Результат ответа
                    } else {
                        resolve(parsedMessage); // В случае других данных
                    }
                }
            }

            if (typeof message === "string") {
                if (message.startsWith('0{"sid":"')) {
                    this.sendMessage("40");
                } else if (message === "2") {
                    this.sendMessage("3");
                } else if (message.startsWith('40{"sid":"')) {
                    this.sendMessage(this.ssid);
                } else if (message.startsWith('451-[')) {
                    const jsonPart = message.split('-', 2)[1];
                    const jsonMessage = JSON.parse(jsonPart);


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
                            this.sendMessage('42["changeSymbol",{"asset":"AUDNZD_otc","period":60}]');
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
                            console.error("Ошибка авторизации: проверьте ключ сессии и другие параметры.");
                            break;
                        default:
                        // console.log(`Unhandled 451 message: ${JSON.stringify(jsonMessage)}`);
                    }

                }
            }
        } catch (err) {
            console.error('Error processing message:', err);
        }
    }
}

module.exports = WebSocketClient;



