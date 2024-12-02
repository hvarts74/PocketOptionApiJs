class TimeSynchronizer {
    constructor() {
        this.serverTimeReference = null; // Время сервера
        this.localTimeReference = null;  // Локальное время
    }

    synchronize(serverTime) {
        // Сохраняем время сервера и текущее локальное время
        this.serverTimeReference = Math.floor(serverTime); // округляем серверное время до секунд
        this.localTimeReference = Math.floor(Date.now() / 1000); // текущее время в секундах
    }

    getSyncedTime() {
        if (!this.serverTimeReference || !this.localTimeReference) {
            throw new Error("Время не синхронизировано.");
        }

        // Рассчитываем прошедшее время с момента синхронизации
        const elapsedTime = Math.floor(Date.now() / 1000 - this.localTimeReference);
        // Возвращаем синхронизированное время в секундах
        return this.serverTimeReference + elapsedTime;
    }

    getSyncedDatetime() {
        // Возвращаем объект Date, соответствующий синхронизированному времени
        const syncedTime = this.getSyncedTime();
        return new Date(syncedTime * 1000); // Переводим в миллисекунды
    }

    updateSync(newServerTime) {
        // Обновляем синхронизацию
        this.synchronize(newServerTime);
    }
}

module.exports = TimeSynchronizer;
