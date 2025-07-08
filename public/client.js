class WebSocketChat {
    constructor() {
        this.ws = null;
        this.clientId = null;
        this.username = null;
        this.isConnected = false;
        this.users = new Map();
        this.typingTimeout = null;
        
        // WebRTC для звонков
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.currentCallId = null;
        this.isInCall = false;
        this.callState = 'idle'; // idle, calling, ringing, connected, ended
        
        // Конфигурация WebRTC
        this.rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        
        // Используем конфигурацию из config.js
        this.serverConfig = window.serverConfig || {
            host: '87.249.54.192',
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
            rejectCall: document.getElementById('rejectCall'),
            endCallBtn: document.getElementById('endCallBtn'),
            requestMediaBtn: document.getElementById('requestMediaBtn')
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
        this.elements.endCallBtn.addEventListener('click', () => this.endCall());

        // Запрос доступа к медиа
        this.elements.requestMediaBtn.addEventListener('click', () => this.requestMediaAccess());

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
            // Запрашиваем доступ к медиа после подключения
            this.requestMediaAccess();
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

    // Запрос доступа к медиа устройствам
    async requestMediaAccess() {
        const getUserMedia = this.checkMediaSupport();
        if (!getUserMedia) {
            this.showNotification('Ваш браузер не поддерживает видеозвонки');
            return;
        }

        // Обновляем состояние кнопки
        this.elements.requestMediaBtn.disabled = true;
        this.elements.requestMediaBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Запрос...';

        try {
            // Запрашиваем доступ к медиа
            this.localStream = await getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });

            // Создаем предварительный просмотр
            this.createVideoPreview();
            this.showNotification('Доступ к камере и микрофону получен');

            // Обновляем кнопку
            this.elements.requestMediaBtn.innerHTML = '<i class="fas fa-check"></i> Доступ получен';
            this.elements.requestMediaBtn.style.background = 'linear-gradient(45deg, #4ecdc4, #45b7aa)';

        } catch (error) {
            console.error('Ошибка получения медиа:', error);
            
            let errorMessage = 'Ошибка доступа к камере/микрофону';
            
            if (error.name === 'NotAllowedError') {
                errorMessage = 'Доступ к камере/микрофону запрещен. Разрешите доступ в настройках браузера.';
            } else if (error.name === 'NotFoundError') {
                errorMessage = 'Камера или микрофон не найдены. Проверьте подключение устройств.';
            } else if (error.name === 'NotSupportedError') {
                errorMessage = 'Ваш браузер не поддерживает видеозвонки. Попробуйте Chrome или Firefox.';
            } else if (error.name === 'NotReadableError') {
                errorMessage = 'Камера или микрофон уже используются другим приложением.';
            }
            
            this.showNotification(errorMessage);

            // Возвращаем кнопку в исходное состояние
            this.elements.requestMediaBtn.disabled = false;
            this.elements.requestMediaBtn.innerHTML = '<i class="fas fa-video"></i> Разрешить камеру';
        }
    }

    // Создание предварительного просмотра видео
    createVideoPreview() {
        // Удаляем существующий предварительный просмотр
        const existingPreview = document.getElementById('videoPreview');
        if (existingPreview) {
            existingPreview.remove();
        }

        // Создаем контейнер для предварительного просмотра
        const previewContainer = document.createElement('div');
        previewContainer.id = 'videoPreview';
        previewContainer.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            width: 200px;
            height: 150px;
            background: #000;
            border-radius: 10px;
            overflow: hidden;
            z-index: 999;
            border: 2px solid #4ecdc4;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;

        // Создаем видео элемент
        const video = document.createElement('video');
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;
        video.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: cover;
        `;

        // Добавляем индикатор состояния
        const statusIndicator = document.createElement('div');
        statusIndicator.style.cssText = `
            position: absolute;
            top: 5px;
            right: 5px;
            width: 12px;
            height: 12px;
            background: #4ecdc4;
            border-radius: 50%;
            border: 2px solid #fff;
        `;

        // Добавляем кнопку закрытия
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = `
            position: absolute;
            top: 5px;
            left: 5px;
            width: 20px;
            height: 20px;
            background: rgba(255, 107, 107, 0.8);
            color: white;
            border: none;
            border-radius: 50%;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        closeBtn.onclick = () => {
            previewContainer.remove();
        };

        // Добавляем элементы в контейнер
        previewContainer.appendChild(video);
        previewContainer.appendChild(statusIndicator);
        previewContainer.appendChild(closeBtn);

        // Добавляем в документ
        document.body.appendChild(previewContainer);

        // Подключаем поток к видео
        video.srcObject = this.localStream;

        // Добавляем hover эффект
        previewContainer.addEventListener('mouseenter', () => {
            previewContainer.style.transform = 'scale(1.05)';
            previewContainer.style.transition = 'transform 0.2s ease';
        });

        previewContainer.addEventListener('mouseleave', () => {
            previewContainer.style.transform = 'scale(1)';
        });
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
            case 'incomingCall':
                this.handleIncomingCall(data);
                break;
            case 'callAccepted':
                this.handleCallAccepted(data);
                break;
            case 'callRejected':
                this.handleCallRejected(data);
                break;
            case 'callEnded':
                this.handleCallEnded(data);
                break;
            case 'callBusy':
                this.handleCallBusy(data);
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

        // Обновляем список пользователей
        if (data.onlineUsers) {
            data.onlineUsers.forEach(user => {
                this.users.set(user.id, user);
            });
            this.updateUsersList();
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
            isInCall: false
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

    // ===== ФУНКЦИИ ЗВОНКОВ =====

    // Проверка поддержки getUserMedia
    checkMediaSupport() {
        // Проверяем HTTPS для локальной разработки
        if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
            console.warn('getUserMedia требует HTTPS в продакшене');
        }

        if (!navigator.mediaDevices) {
            // Fallback для старых браузеров
            navigator.mediaDevices = {};
        }

        if (!navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia = function(constraints) {
                const getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

                if (!getUserMedia) {
                    return Promise.reject(new Error('getUserMedia не поддерживается в этом браузере'));
                }

                return new Promise(function(resolve, reject) {
                    getUserMedia.call(navigator, constraints, resolve, reject);
                });
            }
        }

        return navigator.mediaDevices.getUserMedia;
    }

    async startCall(targetUserId) {
        if (this.isInCall) {
            this.showNotification('Вы уже в звонке');
            return;
        }

        // Проверяем, есть ли уже доступ к медиа
        if (!this.localStream) {
            this.showNotification('Сначала разрешите доступ к камере и микрофону');
            return;
        }

        this.callState = 'calling';
        this.currentCallId = this.generateId();

        // Отправляем запрос на звонок
        this.ws.send(JSON.stringify({
            type: 'call',
            action: 'start',
            targetUserId: targetUserId
        }));

        this.showCallModal('Исходящий звонок', 'Вызов...');
        this.showNotification('Начинаем звонок...');
    }

    handleIncomingCall(data) {
        this.currentCallId = data.callId;
        this.callState = 'ringing';
        
        this.showCallModal('Входящий звонок', `От: ${data.callerName}`);
        this.showNotification(`Входящий звонок от ${data.callerName}`);
        
        // Автоматически скрываем модальное окно через 30 секунд
        setTimeout(() => {
            if (this.callState === 'ringing') {
                this.rejectCall();
            }
        }, 30000);
    }

    async acceptCall() {
        if (this.callState !== 'ringing') return;

        // Проверяем, есть ли уже доступ к медиа
        if (!this.localStream) {
            this.showNotification('Сначала разрешите доступ к камере и микрофону');
            this.rejectCall();
            return;
        }

        this.callState = 'connected';
        this.isInCall = true;

        // Отправляем принятие звонка
        this.ws.send(JSON.stringify({
            type: 'call',
            action: 'accept',
            callId: this.currentCallId
        }));

        this.hideCallModal();
        this.initializePeerConnection();
        this.showEndCallButton();
        this.showNotification('Звонок принят');
    }

    rejectCall() {
        if (this.callState === 'ringing') {
            this.ws.send(JSON.stringify({
                type: 'call',
                action: 'reject',
                callId: this.currentCallId
            }));
        }
        
        this.endCall();
    }

    handleCallAccepted(data) {
        this.callState = 'connected';
        this.isInCall = true;
        this.hideCallModal();
        this.initializePeerConnection();
        this.showEndCallButton();
        this.showNotification('Звонок принят');
    }

    handleCallRejected(data) {
        this.callState = 'ended';
        this.hideCallModal();
        this.hideEndCallButton();
        this.endCall();
        this.showNotification('Звонок отклонен');
    }

    handleCallEnded(data) {
        this.callState = 'ended';
        this.hideCallModal();
        this.hideEndCallButton();
        this.endCall();
        this.showNotification('Звонок завершен');
    }

    handleCallBusy(data) {
        this.callState = 'ended';
        this.hideCallModal();
        this.hideEndCallButton();
        this.endCall();
        this.showNotification('Пользователь занят');
    }

    endCall() {
        if (this.currentCallId) {
            this.ws.send(JSON.stringify({
                type: 'call',
                action: 'end',
                callId: this.currentCallId
            }));
        }

        this.callState = 'idle';
        this.isInCall = false;
        this.currentCallId = null;
        this.hideCallModal();
        this.hideEndCallButton();

        // Останавливаем медиа потоки
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        // Закрываем WebRTC соединение
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        // Удаляем удаленное видео
        const remoteVideo = document.getElementById('remoteVideo');
        if (remoteVideo) {
            remoteVideo.remove();
        }

        this.updateUsersList();
    }

    initializePeerConnection() {
        this.peerConnection = new RTCPeerConnection(this.rtcConfig);

        // Добавляем локальный поток
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });
        }

        // Обработка входящих потоков
        this.peerConnection.ontrack = (event) => {
            this.remoteStream = event.streams[0];
            this.displayRemoteVideo();
        };

        // Обработка ICE кандидатов
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendWebRTCMessage('ice-candidate', event.candidate);
            }
        };

        // Обработка изменения состояния соединения
        this.peerConnection.onconnectionstatechange = () => {
            console.log('WebRTC состояние:', this.peerConnection.connectionState);
            if (this.peerConnection.connectionState === 'failed') {
                this.showNotification('Ошибка соединения');
                this.endCall();
            }
        };
    }

    async handleWebRTC(data) {
        if (!this.peerConnection) return;

        try {
            switch (data.action) {
                case 'offer':
                    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.data));
                    const answer = await this.peerConnection.createAnswer();
                    await this.peerConnection.setLocalDescription(answer);
                    this.sendWebRTCMessage('answer', answer, data.fromUserId);
                    break;

                case 'answer':
                    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.data));
                    break;

                case 'ice-candidate':
                    await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.data));
                    break;
            }
        } catch (error) {
            console.error('WebRTC ошибка:', error);
        }
    }

    sendWebRTCMessage(action, data, targetUserId = null) {
        this.ws.send(JSON.stringify({
            type: 'call',
            action: action,
            data: data,
            targetUserId: targetUserId
        }));
    }

    displayRemoteVideo() {
        // Создаем элемент для отображения удаленного видео
        let remoteVideo = document.getElementById('remoteVideo');
        if (!remoteVideo) {
            remoteVideo = document.createElement('video');
            remoteVideo.id = 'remoteVideo';
            remoteVideo.autoplay = true;
            remoteVideo.playsInline = true;
            remoteVideo.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                width: 200px;
                height: 150px;
                background: #000;
                border-radius: 10px;
                z-index: 1000;
            `;
            document.body.appendChild(remoteVideo);
        }
        remoteVideo.srcObject = this.remoteStream;
    }

    showCallModal(title, caller) {
        this.elements.callTitle.textContent = title;
        this.elements.callerName.textContent = caller;
        this.elements.callModal.style.display = 'flex';
    }

    hideCallModal() {
        this.elements.callModal.style.display = 'none';
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

    updateUsersList() {
        this.elements.usersList.innerHTML = '';
        
        this.users.forEach(user => {
            const userDiv = document.createElement('div');
            userDiv.className = 'user-item';
            
            const callButton = user.isInCall ? 
                '<button class="call-btn" disabled title="Пользователь в звонке"><i class="fas fa-phone-slash"></i></button>' :
                `<button class="call-btn" onclick="chat.startCall('${user.id}')" title="Позвонить"><i class="fas fa-phone"></i></button>`;
            
            userDiv.innerHTML = `
                <div class="user-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="user-info">
                    <div class="user-name">${user.username}</div>
                    <div class="user-status">${user.isInCall ? 'В звонке' : 'Онлайн'}</div>
                </div>
                ${callButton}
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

    generateId() {
        return Math.random().toString(36).substr(2, 9);
    }

    showEndCallButton() {
        this.elements.endCallBtn.style.display = 'block';
    }

    hideEndCallButton() {
        this.elements.endCallBtn.style.display = 'none';
    }
}

// Инициализация чата при загрузке страницы
let chat;
document.addEventListener('DOMContentLoaded', () => {
    chat = new WebSocketChat();
}); 