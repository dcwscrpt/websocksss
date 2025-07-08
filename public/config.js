// Конфигурация сервера
// Измените эти настройки под ваш сервер

const config = {
    // IP адрес или домен вашего сервера
    serverHost: '87.249.54.192', // Замените на реальный IP вашего сервера
    
    // Порт WebSocket сервера
    serverPort: 3000,
    
    // Настройки для разработки
    development: {
        serverHost: 'localhost',
        serverPort: 3000,
        protocol: 'ws'
    },
    
    // Настройки для продакшена
    production: {
        serverHost: '87.249.54.192', // Замените на IP вашего сервера
        serverPort: 3000,
        protocol: 'ws' // или 'wss' для HTTPS
    }
};

// Определяем окружение
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const currentConfig = isDevelopment ? config.development : config.production;

// Автоматически определяем протокол для WebSocket
const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';

// Экспортируем конфигурацию
window.serverConfig = {
    host: currentConfig.serverHost,
    port: currentConfig.serverPort,
    protocol: wsProtocol
};

console.log('Конфигурация сервера:', window.serverConfig); 