class WebSocketChat {
    constructor() {
        this.ws = null;
        this.clientId = null;
        this.username = null;
        this.isConnected = false;
        this.users = new Map();
        this.typingTimeout = null;
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        
        // Используем конфигурацию из config.js
        this.serverConfig = window.serverConfig || {
            host: 'your-server-ip', // Замените на IP вашего сервера
            port: 3000,
            protocol: 'ws'
        };
        
        this.initializeElements();
        this.bindEvents();
        this.connect();
    }

    initializeElements() {
        this.elements = {
            messageInput: document.getElementById('messageInput'),
            sendBtn: document.getElementById('sendBtn'),
            messagesContainer: document.getElementById('messagesContainer'),
            usersList: document.getElementById('usersList'),
            username: document.getElementById('username'),
            userAvatar: document.getElementById('userAvatar'),
            connectionStatus: document.getElementById('connectionStatus'),
            statusIndicator: document.getElementById('statusIndicator'),
            statusText: document.getElementById('statusText'),
            fileInput: document.getElementById('fileInput'),
            emojiBtn: document.getElementById('emojiBtn'),
            callModal: document.getElementById('callModal'),
            callTitle: document.getElementById('callTitle'),
            callerName: document.getElementById('callerName'),
            acceptCall: document.getElementById('acceptCall'),
            rejectCall: document.getElementById('rejectCall')
        };
    }

    bindEvents() {
        // Отправка сообщений
        this.elements.sendBtn.addEventListener('click', () => this.sendMessage());
        this.elements.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Отправка файлов
        this.elements.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));

        // Звонки
        this.elements.acceptCall.addEventListener('click', () => this.acceptCall());
        this.elements.rejectCall.addEventListener('click', () => this.rejectCall());

        // Индикатор печати
        this.elements.messageInput.addEventListener('input', () => this.handleTyping());

        // Автоматическое изменение размера текстового поля
        this.elements.messageInput.addEventListener('input', () => {
            this.elements.messageInput.style.height = 'auto';
            this.elements.messageInput.style.height = this.elements.messageInput.scrollHeight + 'px';
        });
    }

    getWebSocketUrl() {
        // Статический URL для подключения к серверу
        return `${this.serverConfig.protocol}://${this.serverConfig.host}:${this.serverConfig.port}`;
    }

    connect() {
        const wsUrl = this.getWebSocketUrl();
        console.log('Подключение к WebSocket:', wsUrl);
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            this.isConnected = true;
            this.updateConnectionStatus('Подключено', true);
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (error) {
                console.error('Ошибка парсинга сообщения:', error);
            }
        };

        this.ws.onclose = () => {
            this.isConnected = false;
            this.updateConnectionStatus('Отключено', false);
            // Попытка переподключения через 3 секунды
            setTimeout(() => this.connect(), 3000);
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket ошибка:', error);
            this.updateConnectionStatus('Ошибка подключения', false);
        };
    }

    handleMessage(data) {
        switch (data.type) {
            case 'welcome':
                this.handleWelcome(data);
                break;
            case 'message':
                this.displayMessage(data);
                break;
            case 'media':
                this.displayMediaMessage(data);
                break;
            case 'userJoined':
                this.handleUserJoined(data);
                break;
            case 'userLeft':
                this.handleUserLeft(data);
                break;
            case 'usernameChanged':
                this.handleUsernameChanged(data);
                break;
            case 'typing':
                this.handleUserTyping(data);
                break;
            case 'callStarted':
                this.handleCallStarted(data);
                break;
            case 'callEnded':
                this.handleCallEnded(data);
                break;
            case 'webrtc':
                this.handleWebRTC(data);
                break;
        }
    }

    handleWelcome(data) {
        this.clientId = data.clientId;
        this.username = data.username;
        this.elements.username.textContent = this.username;
        this.elements.userAvatar.innerHTML = `<i class="fas fa-user"></i>`;
        
        // Отображаем историю сообщений
        if (data.history) {
            data.history.forEach(msg => {
                if (msg.type === 'message') {
                    this.displayMessage(msg);
                } else if (msg.type === 'media') {
                    this.displayMediaMessage(msg);
                }
            });
        }
    }

    displayMessage(data) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${data.userId === this.clientId ? 'own' : ''}`;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = `<i class="fas fa-user"></i>`;
        
        const content = document.createElement('div');
        content.className = 'message-content';
        
        const header = document.createElement('div');
        header.className = 'message-header';
        header.innerHTML = `
            <span class="message-username">${data.username}</span>
            <span class="message-time">${this.formatTime(data.timestamp)}</span>
        `;
        
        const text = document.createElement('div');
        text.className = 'message-text';
        text.textContent = data.content;
        
        content.appendChild(header);
        content.appendChild(text);
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(content);
        
        this.elements.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
        
        // Уведомление для новых сообщений (если не свое)
        if (data.userId !== this.clientId) {
            this.showNotification(`Новое сообщение от ${data.username}`);
        }
    }

    displayMediaMessage(data) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${data.userId === this.clientId ? 'own' : ''}`;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = `<i class="fas fa-user"></i>`;
        
        const content = document.createElement('div');
        content.className = 'message-content';
        
        const header = document.createElement('div');
        header.className = 'message-header';
        header.innerHTML = `
            <span class="message-username">${data.username}</span>
            <span class="message-time">${this.formatTime(data.timestamp)}</span>
        `;
        
        const mediaDiv = document.createElement('div');
        mediaDiv.className = 'media-message';
        
        switch (data.mediaType) {
            case 'image':
                const img = document.createElement('img');
                img.src = data.mediaData;
                img.className = 'media-image';
                img.onclick = () => this.openMediaModal(data.mediaData, 'image');
                mediaDiv.appendChild(img);
                break;
            case 'video':
                const video = document.createElement('video');
                video.src = data.mediaData;
                video.className = 'media-video';
                video.controls = true;
                video.autoplay = false;
                mediaDiv.appendChild(video);
                break;
            case 'audio':
                const audio = document.createElement('audio');
                audio.src = data.mediaData;
                audio.controls = true;
                mediaDiv.appendChild(audio);
                break;
            case 'file':
                const fileDiv = document.createElement('div');
                fileDiv.className = 'media-file';
                fileDiv.innerHTML = `
                    <i class="fas fa-file"></i>
                    <span>${data.fileName}</span>
                    <span>(${this.formatFileSize(data.fileSize)})</span>
                `;
                fileDiv.onclick = () => this.downloadFile(data.mediaData, data.fileName);
                mediaDiv.appendChild(fileDiv);
                break;
        }
        
        content.appendChild(header);
        content.appendChild(mediaDiv);
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(content);
        
        this.elements.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    handleUserJoined(data) {
        this.users.set(data.userId, {
            id: data.userId,
            username: data.username,
            isTyping: false
        });
        this.updateUsersList();
        this.showSystemMessage(`${data.username} присоединился к чату`);
    }

    handleUserLeft(data) {
        this.users.delete(data.userId);
        this.updateUsersList();
        this.showSystemMessage(`${data.username} покинул чат`);
    }

    handleUsernameChanged(data) {
        if (this.users.has(data.userId)) {
            this.users.get(data.userId).username = data.newUsername;
        }
        this.updateUsersList();
        this.showSystemMessage(`${data.oldUsername} изменил имя на ${data.newUsername}`);
    }

    handleUserTyping(data) {
        // Показываем индикатор печати
        let typingIndicator = document.querySelector('.typing-indicator');
        if (!typingIndicator) {
            typingIndicator = document.createElement('div');
            typingIndicator.className = 'typing-indicator';
            this.elements.messagesContainer.appendChild(typingIndicator);
        }
        
        if (data.isTyping) {
            typingIndicator.textContent = `${data.username} печатает...`;
            typingIndicator.style.display = 'block';
        } else {
            typingIndicator.style.display = 'none';
        }
    }

    handleCallStarted(data) {
        this.showSystemMessage(`${data.username} начал звонок`);
    }

    handleCallEnded(data) {
        this.showSystemMessage(`${data.username} завершил звонок`);
        this.endCall();
    }

    handleWebRTC(data) {
        if (!this.peerConnection) return;
        
        switch (data.action) {
            case 'offer':
                this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.data));
                this.peerConnection.createAnswer().then(answer => {
                    this.peerConnection.setLocalDescription(answer);
                    this.sendWebRTCMessage('answer', answer, data.fromUserId);
                });
                break;
            case 'answer':
                this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.data));
                break;
            case 'ice-candidate':
                this.peerConnection.addIceCandidate(new RTCIceCandidate(data.data));
                break;
        }
    }

    sendMessage() {
        const content = this.elements.messageInput.value.trim();
        if (!content || !this.isConnected) return;

        this.ws.send(JSON.stringify({
            type: 'message',
            content: content
        }));

        this.elements.messageInput.value = '';
        this.elements.messageInput.style.height = 'auto';
    }

    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const mediaData = e.target.result;
            let mediaType = 'file';
            
            if (file.type.startsWith('image/')) {
                mediaType = 'image';
            } else if (file.type.startsWith('video/')) {
                mediaType = 'video';
            } else if (file.type.startsWith('audio/')) {
                mediaType = 'audio';
            }

            this.ws.send(JSON.stringify({
                type: 'media',
                mediaType: mediaType,
                mediaData: mediaData,
                fileName: file.name,
                fileSize: file.size
            }));
        };

        reader.readAsDataURL(file);
        event.target.value = '';
    }

    handleTyping() {
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }

        this.ws.send(JSON.stringify({
            type: 'typing',
            isTyping: true
        }));

        this.typingTimeout = setTimeout(() => {
            this.ws.send(JSON.stringify({
                type: 'typing',
                isTyping: false
            }));
        }, 1000);
    }

    startCall(targetUserId) {
        this.showCallModal('Исходящий звонок', 'Вызов...');
        
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(stream => {
                this.localStream = stream;
                this.initializePeerConnection();
                
                this.ws.send(JSON.stringify({
                    type: 'call',
                    action: 'start',
                    targetUserId: targetUserId
                }));
            })
            .catch(error => {
                console.error('Ошибка получения медиа:', error);
                this.hideCallModal();
            });
    }

    acceptCall() {
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(stream => {
                this.localStream = stream;
                this.initializePeerConnection();
                this.hideCallModal();
            })
            .catch(error => {
                console.error('Ошибка получения медиа:', error);
            });
    }

    rejectCall() {
        this.hideCallModal();
        this.ws.send(JSON.stringify({
            type: 'call',
            action: 'end'
        }));
    }

    endCall() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        this.hideCallModal();
    }

    initializePeerConnection() {
        this.peerConnection = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        this.localStream.getTracks().forEach(track => {
            this.peerConnection.addTrack(track, this.localStream);
        });

        this.peerConnection.ontrack = (event) => {
            this.remoteStream = event.streams[0];
            // Здесь можно добавить отображение удаленного видео
        };

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendWebRTCMessage('ice-candidate', event.candidate);
            }
        };
    }

    sendWebRTCMessage(action, data, targetUserId = null) {
        this.ws.send(JSON.stringify({
            type: 'call',
            action: action,
            data: data,
            targetUserId: targetUserId
        }));
    }

    showCallModal(title, caller) {
        this.elements.callTitle.textContent = title;
        this.elements.callerName.textContent = caller;
        this.elements.callModal.style.display = 'flex';
    }

    hideCallModal() {
        this.elements.callModal.style.display = 'none';
    }

    updateUsersList() {
        this.elements.usersList.innerHTML = '';
        
        this.users.forEach(user => {
            const userDiv = document.createElement('div');
            userDiv.className = 'user-item';
            
            userDiv.innerHTML = `
                <div class="user-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="user-info">
                    <div class="user-name">${user.username}</div>
                    <div class="user-status">${user.isTyping ? 'Печатает...' : 'Онлайн'}</div>
                </div>
                <button class="call-btn" onclick="chat.startCall('${user.id}')" title="Позвонить">
                    <i class="fas fa-phone"></i>
                </button>
            `;
            
            this.elements.usersList.appendChild(userDiv);
        });
    }

    showSystemMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'system-message';
        messageDiv.textContent = message;
        
        this.elements.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    updateConnectionStatus(status, connected) {
        this.elements.connectionStatus.textContent = status;
        this.elements.statusText.textContent = status;
        
        if (connected) {
            this.elements.statusIndicator.classList.add('connected');
        } else {
            this.elements.statusIndicator.classList.remove('connected');
        }
    }

    scrollToBottom() {
        this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Б';
        const k = 1024;
        const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    openMediaModal(src, type) {
        // Простое модальное окно для просмотра медиа
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            cursor: pointer;
        `;
        
        const content = type === 'image' ? 
            `<img src="${src}" style="max-width: 90%; max-height: 90%; object-fit: contain;">` :
            `<video src="${src}" controls style="max-width: 90%; max-height: 90%;"></video>`;
        
        modal.innerHTML = content;
        modal.onclick = () => modal.remove();
        
        document.body.appendChild(modal);
    }

    downloadFile(dataUrl, fileName) {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = fileName;
        link.click();
    }
}

// Инициализация чата при загрузке страницы
let chat;
document.addEventListener('DOMContentLoaded', () => {
    chat = new WebSocketChat();
}); 