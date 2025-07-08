const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

// Конфигурация
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Хранилище подключенных клиентов
const clients = new Map();
let messageHistory = [];

// Хранилище активных звонков
const activeCalls = new Map();

// === HTTPS CONFIGURATION ===
let httpsServer;
let wss;

try {
    const httpsOptions = {
        key: fs.readFileSync('key.pem'),
        cert: fs.readFileSync('cert.pem')
    };
    
    httpsServer = https.createServer(httpsOptions, (req, res) => {
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

    wss = new WebSocket.Server({ server: httpsServer });
    httpsServer.listen(443, () => {
        console.log('HTTPS server running on port 443');
    });
} catch (e) {
    console.error('Не удалось запустить HTTPS сервер:', e);
}

// (Опционально) HTTP сервер для редиректа на HTTPS
const httpServer = http.createServer((req, res) => {
    // Редирект на https
    res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
    res.end();
});
httpServer.listen(80, () => {
    console.log('HTTP server (redirect) running on port 80');
});

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
    currentCallId: null,
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
    history: messageHistory,
    onlineUsers: Array.from(clients.values()).map(c => ({
      id: c.id,
      username: c.username,
      isInCall: c.isInCall
    }))
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
      
      // Если клиент был в звонке, завершаем его
      if (client.currentCallId && activeCalls.has(client.currentCallId)) {
        endCall(client.currentCallId, clientId);
      }
      
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
      startCall(clientId, data.targetUserId);
      break;
    case 'accept':
      acceptCall(clientId, data.callId);
      break;
    case 'reject':
      rejectCall(clientId, data.callId);
      break;
    case 'end':
      endCall(client.currentCallId, clientId);
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

function startCall(callerId, targetUserId) {
  const caller = clients.get(callerId);
  const target = clients.get(targetUserId);
  
  if (!caller || !target) {
    log(`Ошибка: пользователь не найден для звонка`, 'error');
    return;
  }

  if (target.isInCall) {
    // Отправляем уведомление, что пользователь занят
    caller.ws.send(JSON.stringify({
      type: 'callBusy',
      targetUserId: targetUserId,
      message: 'Пользователь занят в другом звонке'
    }));
    return;
  }

  const callId = generateId();
  const callInfo = {
    id: callId,
    caller: callerId,
    target: targetUserId,
    status: 'ringing',
    startTime: new Date().toISOString()
  };

  activeCalls.set(callId, callInfo);
  caller.currentCallId = callId;
  caller.isInCall = true;

  log(`Звонок ${callId} начат: ${caller.username} → ${target.username}`);

  // Отправляем входящий звонок целевому пользователю
  target.ws.send(JSON.stringify({
    type: 'incomingCall',
    callId: callId,
    callerId: callerId,
    callerName: caller.username,
    timestamp: new Date().toISOString()
  }));

  // Уведомляем всех о начале звонка
  broadcastToAll({
    type: 'callStarted',
    callId: callId,
    callerId: callerId,
    callerName: caller.username,
    targetId: targetUserId,
    targetName: target.username,
    timestamp: new Date().toISOString()
  });
}

function acceptCall(accepterId, callId) {
  const call = activeCalls.get(callId);
  if (!call) {
    log(`Звонок ${callId} не найден`, 'error');
    return;
  }

  const accepter = clients.get(accepterId);
  const caller = clients.get(call.caller);
  
  if (!accepter || !caller) {
    log(`Ошибка: пользователь не найден для принятия звонка`, 'error');
    return;
  }

  call.status = 'active';
  call.acceptTime = new Date().toISOString();
  accepter.currentCallId = callId;
  accepter.isInCall = true;

  log(`Звонок ${callId} принят: ${accepter.username}`);

  // Уведомляем звонящего о принятии звонка
  caller.ws.send(JSON.stringify({
    type: 'callAccepted',
    callId: callId,
    accepterId: accepterId,
    accepterName: accepter.username,
    timestamp: new Date().toISOString()
  }));

  // Уведомляем всех о принятии звонка
  broadcastToAll({
    type: 'callAccepted',
    callId: callId,
    callerId: call.caller,
    callerName: caller.username,
    accepterId: accepterId,
    accepterName: accepter.username,
    timestamp: new Date().toISOString()
  });
}

function rejectCall(rejecterId, callId) {
  const call = activeCalls.get(callId);
  if (!call) {
    log(`Звонок ${callId} не найден`, 'error');
    return;
  }

  const rejecter = clients.get(rejecterId);
  const caller = clients.get(call.caller);
  
  if (!rejecter || !caller) {
    log(`Ошибка: пользователь не найден для отклонения звонка`, 'error');
    return;
  }

  log(`Звонок ${callId} отклонен: ${rejecter.username}`);

  // Уведомляем звонящего об отклонении звонка
  caller.ws.send(JSON.stringify({
    type: 'callRejected',
    callId: callId,
    rejecterId: rejecterId,
    rejecterName: rejecter.username,
    timestamp: new Date().toISOString()
  }));

  // Сбрасываем состояние звонящего
  caller.currentCallId = null;
  caller.isInCall = false;

  // Удаляем звонок
  activeCalls.delete(callId);

  // Уведомляем всех об отклонении звонка
  broadcastToAll({
    type: 'callRejected',
    callId: callId,
    callerId: call.caller,
    callerName: caller.username,
    rejecterId: rejecterId,
    rejecterName: rejecter.username,
    timestamp: new Date().toISOString()
  });
}

function endCall(callId, userId) {
  const call = activeCalls.get(callId);
  if (!call) {
    log(`Звонок ${callId} не найден для завершения`, 'error');
    return;
  }

  const caller = clients.get(call.caller);
  const target = clients.get(call.target);
  
  log(`Звонок ${callId} завершен пользователем ${userId}`);

  // Сбрасываем состояние участников
  if (caller) {
    caller.currentCallId = null;
    caller.isInCall = false;
  }
  if (target) {
    target.currentCallId = null;
    target.isInCall = false;
  }

  // Уведомляем всех участников о завершении звонка
  const participants = [call.caller, call.target].filter(id => clients.has(id));
  participants.forEach(participantId => {
    const participant = clients.get(participantId);
    if (participant) {
      participant.ws.send(JSON.stringify({
        type: 'callEnded',
        callId: callId,
        endedBy: userId,
        timestamp: new Date().toISOString()
      }));
    }
  });

  // Удаляем звонок
  activeCalls.delete(callId);

  // Уведомляем всех о завершении звонка
  broadcastToAll({
    type: 'callEnded',
    callId: callId,
    callerId: call.caller,
    targetId: call.target,
    endedBy: userId,
    timestamp: new Date().toISOString()
  });
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

// Graceful shutdown с таймаутом
function gracefulShutdown(signal) {
  log(`Получен сигнал ${signal}, завершение работы...`);
  
  // Закрываем WebSocket соединения
  wss.clients.forEach(client => {
    try {
      client.close();
    } catch (error) {
      // Игнорируем ошибки при закрытии
    }
  });
  
  // Закрываем HTTPS сервер с таймаутом
  httpsServer.close(() => {
    log('HTTPS сервер закрыт');
    process.exit(0);
  });
  
  // Принудительное завершение через 3 секунды
  setTimeout(() => {
    log('Принудительное завершение работы');
    process.exit(0);
  }, 3000);
}

// Обработка завершения процесса
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Обработка необработанных ошибок
process.on('uncaughtException', (error) => {
  log(`Необработанная ошибка: ${error.message}`, 'error');
  log(error.stack, 'error');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log(`Необработанное отклонение промиса: ${reason}`, 'error');
  process.exit(1);
});

// Запуск сервера
server.listen(PORT, () => {
  log(`HTTPS сервер запущен на порту ${PORT} в режиме ${NODE_ENV}`);
  log(`WebSocket сервер готов к подключениям`);
  log(`Доступ к приложению: https://localhost:${PORT}`);
  log(`Всего подключений: ${clients.size}`);
}); 