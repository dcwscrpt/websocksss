const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 3000 });

// Хранилище подключенных клиентов
const clients = new Map();
let messageHistory = [];

wss.on('connection', (ws) => {
  const clientId = generateId();
  const clientInfo = {
    id: clientId,
    ws: ws,
    username: `Пользователь_${clientId.slice(0, 6)}`,
    isInCall: false
  };
  
  clients.set(clientId, clientInfo);
  
  console.log(`Новое подключение! ID: ${clientId}`);
  
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
      console.log('Получено текстовое сообщение:', message.toString());
      // Обработка простых текстовых сообщений
      handleTextMessage(clientId, message.toString());
    }
  });

  ws.on('close', () => {
    const client = clients.get(clientId);
    if (client) {
      console.log(`Клиент ${client.username} отключился`);
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
  broadcastToAll(mediaObj);
}

function handleCall(clientId, data) {
  const client = clients.get(clientId);
  if (!client) return;

  switch (data.action) {
    case 'start':
      client.isInCall = true;
      broadcastToAll({
        type: 'callStarted',
        userId: clientId,
        username: client.username,
        timestamp: new Date().toISOString()
      });
      break;
    case 'end':
      client.isInCall = false;
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

  broadcastToAll({
    type: 'usernameChanged',
    userId: clientId,
    oldUsername: oldUsername,
    newUsername: newUsername,
    timestamp: new Date().toISOString()
  });
}

function broadcastToAll(message, excludeUserId = null) {
  wss.clients.forEach((client) => {
    if (client.readyState === require('ws').OPEN) {
      const clientId = Array.from(clients.entries())
        .find(([id, info]) => info.ws === client)?.[0];
      
      if (clientId !== excludeUserId) {
        client.send(JSON.stringify(message));
      }
    }
  });
}

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

console.log('WebSocket сервер запущен на порту 3000'); 