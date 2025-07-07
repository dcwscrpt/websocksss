// Конфигурация сервера
// Измените эти настройки под ваш сервер

const config = {
    // IP адрес или домен вашего сервера
    serverHost: '87.249.54.192', // Замените на реальный IP вашего сервера
    
    // Порт WebSocket сервера
    serverPort: 3000,
    
    // Протокол (ws для HTTP, wss для HTTPS)
    protocol: 'wss', // Измените на 'wss' если используете HTTPS
    
    // Настройки для разработки
    development: {
        serverHost: 'localhost',
        serverPort: 3000,
        protocol: 'wss'
    },
    
    // Настройки для продакшена
    production: {
        serverHost: '87.249.54.192', // Замените на IP вашего сервера
        serverPort: 3000,
        protocol: 'wss  ' // или 'wss' для HTTPS
    }
};

// Определяем окружение
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const currentConfig = isDevelopment ? config.development : config.production;

// Экспортируем конфигурацию
window.serverConfig = {
    host: currentConfig.serverHost,
    port: currentConfig.serverPort,
    protocol: currentConfig.protocol
};

console.log('Конфигурация сервера:', window.serverConfig); 