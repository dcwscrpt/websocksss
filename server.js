const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  let filePath = './public' + (req.url === '/' ? '/client.html' : req.url);
  const extname = String(path.extname(filePath)).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
  };
  const contentType = mimeTypes[extname] || 'application/octet-stream';
  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      res.end('Not found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

const wss = new WebSocket.Server({ server });
let messageHistory = [];

wss.on('connection', (ws) => {
  // Отправляем историю сообщений новому клиенту
  ws.send(JSON.stringify({ type: 'history', messages: messageHistory }));

  ws.on('message', (message) => {
    // Сохраняем сообщение и рассылаем всем клиентам
    const msgObj = { text: message.toString(), time: new Date().toISOString() };
    messageHistory.push(msgObj);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'message', message: msgObj }));
      }
    });
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
}); 