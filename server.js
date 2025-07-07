const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const http = require('http');

// Конфигурация
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Хранилище подключенных клиентов
const clients = new Map();
let messageHistory = [];

// Создаем HTTP сервер
const server = http.createServer((req, res) => {
    // Настройка CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Обработка OPTIONS запросов
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    let filePath = './public' + (req.url === '/' ? '/client.html' : req.url);
    
    // Проверяем, существует ли файл
    if (!fs.existsSync(filePath)) {
        // Если файл не найден, возвращаем client.html
        filePath = './public/client.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.wav': 'audio/wav',
        '.mp4': 'video/mp4',
        '.woff': 'application/font-woff',
        '.ttf': 'application/font-ttf',
        '.eot': 'application/vnd.ms-fontobject',
        '.otf': 'application/font-otf',
        '.wasm': 'application/wasm'
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                // Файл не найден, возвращаем 404
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - Файл не найден</h1>', 'utf-8');
            } else {
                // Ошибка сервера
                res.writeHead(500);
                res.end(`Ошибка сервера: ${error.code}`, 'utf-8');
            }
        } else {
            // Успешный ответ
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// Создаем WebSocket сервер на основе HTTP сервера
const wss = new WebSocket.Server({ server });

// Логирование
function log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    
    if (NODE_ENV === 'production') {
        console.log(logMessage);
    } else {
        console.log(`\x1b[36m${logMessage}\x1b[0m`);
    }
}

wss.on('connection', (ws, req) => {
  const clientId = generateId();
  const clientInfo = {
    id: clientId,
    ws: ws,
    username: `Пользователь_${clientId.slice(0, 6)}`,
    isInCall: false,
    ip: req.socket.remoteAddress
  };
  
  clients.set(clientId, clientInfo);
  
  log(`Новое подключение! ID: ${clientId}, IP: ${clientInfo.ip}`);
  
  // Отправляем приветствие и информацию о клиенте
  ws.send(JSON.stringify({
    type: 'welcome',
    message: 'Добро пожаловать в WebSocket!',
    clientId: clientId,
    username: clientInfo.username,
    history: messageHistory
  }));
  
  // Уведомляем всех о новом пользователе
  broadcastToAll({
    type: 'userJoined',
    userId: clientId,
    username: clientInfo.username,
    timestamp: new Date().toISOString()
  }, clientId);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      handleMessage(clientId, data);
    } catch (error) {
      log(`Получено текстовое сообщение от ${clientId}: ${message.toString()}`);
      // Обработка простых текстовых сообщений
      handleTextMessage(clientId, message.toString());
    }
  });

  ws.on('close', () => {
    const client = clients.get(clientId);
    if (client) {
      log(`Клиент ${client.username} отключился`);
      clients.delete(clientId);
      
      // Уведомляем всех об отключении пользователя
      broadcastToAll({
        type: 'userLeft',
        userId: clientId,
        username: client.username,
        timestamp: new Date().toISOString()
      });
    }
  });

  ws.on('error', (error) => {
    log(`Ошибка WebSocket для клиента ${clientId}: ${error.message}`, 'error');
  });
});

function handleMessage(clientId, data) {
  const client = clients.get(clientId);
  if (!client) return;

  switch (data.type) {
    case 'message':
      handleTextMessage(clientId, data.content);
      break;
    case 'media':
      handleMediaMessage(clientId, data);
      break;
    case 'call':
      handleCall(clientId, data);
      break;
    case 'username':
      updateUsername(clientId, data.username);
      break;
    case 'typing':
      broadcastToAll({
        type: 'typing',
        userId: clientId,
        username: client.username,
        isTyping: data.isTyping
      }, clientId);
      break;
  }
}

function handleTextMessage(clientId, content) {
  const client = clients.get(clientId);
  if (!client) return;

  const messageObj = {
    id: generateId(),
    type: 'message',
    userId: clientId,
    username: client.username,
    content: content,
    timestamp: new Date().toISOString()
  };

  messageHistory.push(messageObj);
  if (messageHistory.length > 100) {
    messageHistory = messageHistory.slice(-100);
  }

  log(`Сообщение от ${client.username}: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`);
  broadcastToAll(messageObj);
}

function handleMediaMessage(clientId, data) {
  const client = clients.get(clientId);
  if (!client) return;

  const mediaObj = {
    id: generateId(),
    type: 'media',
    userId: clientId,
    username: client.username,
    mediaType: data.mediaType, // 'image', 'video', 'audio', 'file'
    mediaData: data.mediaData,
    fileName: data.fileName,
    fileSize: data.fileSize,
    timestamp: new Date().toISOString()
  };

  messageHistory.push(mediaObj);
  log(`Медиа от ${client.username}: ${data.mediaType} - ${data.fileName}`);
  broadcastToAll(mediaObj);
}

function handleCall(clientId, data) {
  const client = clients.get(clientId);
  if (!client) return;

  switch (data.action) {
    case 'start':
      client.isInCall = true;
      log(`Звонок начат пользователем ${client.username}`);
      broadcastToAll({
        type: 'callStarted',
        userId: clientId,
        username: client.username,
        timestamp: new Date().toISOString()
      });
      break;
    case 'end':
      client.isInCall = false;
      log(`Звонок завершен пользователем ${client.username}`);
      broadcastToAll({
        type: 'callEnded',
        userId: clientId,
        username: client.username,
        timestamp: new Date().toISOString()
      });
      break;
    case 'offer':
    case 'answer':
    case 'ice-candidate':
      // Пересылаем WebRTC сигналы конкретному пользователю
      if (data.targetUserId && clients.has(data.targetUserId)) {
        clients.get(data.targetUserId).ws.send(JSON.stringify({
          type: 'webrtc',
          action: data.action,
          data: data.data,
          fromUserId: clientId
        }));
      }
      break;
  }
}

function updateUsername(clientId, newUsername) {
  const client = clients.get(clientId);
  if (!client) return;

  const oldUsername = client.username;
  client.username = newUsername;

  log(`Пользователь ${oldUsername} изменил имя на ${newUsername}`);
  broadcastToAll({
    type: 'usernameChanged',
    userId: clientId,
    oldUsername: oldUsername,
    newUsername: newUsername,
    timestamp: new Date().toISOString()
  });
}

function broadcastToAll(message, excludeUserId = null) {
  let sentCount = 0;
  wss.clients.forEach((client) => {
    if (client.readyState === require('ws').OPEN) {
      const clientId = Array.from(clients.entries())
        .find(([id, info]) => info.ws === client)?.[0];
      
      if (clientId !== excludeUserId) {
        try {
          client.send(JSON.stringify(message));
          sentCount++;
        } catch (error) {
          log(`Ошибка отправки сообщения клиенту ${clientId}: ${error.message}`, 'error');
        }
      }
    }
  });
  
  if (NODE_ENV === 'development') {
    log(`Сообщение отправлено ${sentCount} клиентам`);
  }
}

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

// Обработка завершения процесса
process.on('SIGINT', () => {
  log('Получен сигнал SIGINT, завершение работы...');
  server.close(() => {
    log('HTTP сервер закрыт');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  log('Получен сигнал SIGTERM, завершение работы...');
  server.close(() => {
    log('HTTP сервер закрыт');
    process.exit(0);
  });
});

// Обработка необработанных ошибок
process.on('uncaughtException', (error) => {
  log(`Необработанная ошибка: ${error.message}`, 'error');
  log(error.stack, 'error');
});

process.on('unhandledRejection', (reason, promise) => {
  log(`Необработанное отклонение промиса: ${reason}`, 'error');
});

// Запуск сервера
server.listen(PORT, () => {
  log(`HTTP сервер запущен на порту ${PORT} в режиме ${NODE_ENV}`);
  log(`WebSocket сервер готов к подключениям`);
  log(`Доступ к приложению: http://localhost:${PORT}`);
  log(`Всего подключений: ${clients.size}`);
}); 