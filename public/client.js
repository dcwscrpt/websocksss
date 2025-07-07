const ws = new WebSocket(`ws://${location.host}`);
const messagesDiv = document.getElementById('messages');
const input = document.getElementById('input');
const sendBtn = document.getElementById('send');

function appendMessage(msgObj) {
  const div = document.createElement('div');
  const time = new Date(msgObj.time).toLocaleTimeString();
  div.textContent = `[${time}] ${msgObj.text}`;
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'history') {
    messagesDiv.innerHTML = '';
    data.messages.forEach(appendMessage);
  } else if (data.type === 'message') {
    appendMessage(data.message);
  }
};

sendBtn.onclick = send;
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') send();
});

function send() {
  const text = input.value.trim();
  if (text) {
    ws.send(text);
    input.value = '';
    input.focus();
  }
} 