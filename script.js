document.addEventListener('DOMContentLoaded', () => {
    const joinModal = document.getElementById('join-modal');
    const usernameInput = document.getElementById('username-input');
    const joinButton = document.getElementById('join-button');
    const chatContainer = document.getElementById('chat-container');
    const messagesContainer = document.getElementById('chat-messages');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');

    let username = '';
    let ws;

    // --- WebSocket接続とイベントリスナー --- //

    function connectWebSocket() {
        // WebSocketサーバーのURL（localhost）
        // デプロイ時には 'wss://your-deploy-url.onrender.com' のように変更
        ws = new WebSocket('ws://localhost:8080');

        ws.onopen = () => {
            console.log('WebSocketサーバーに接続しました。');
            // サーバーに参加を通知
            ws.send(JSON.stringify({ type: 'join', user: username }));
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'history') {
                data.messages.forEach(msg => addMessageToUI(msg));
            } else {
                addMessageToUI(data);
            }
        };

        ws.onclose = () => {
            console.log('WebSocketサーバーから切断されました。');
            // 予期せぬ切断の際に通知を表示
            addMessageToUI({ 
                type: 'notification', 
                message: 'サーバーとの接続が切れました。リロードしてください。' 
            });
        };

        ws.onerror = (error) => {
            console.error('WebSocketエラー:', error);
            addMessageToUI({ 
                type: 'notification', 
                message: 'エラーが発生しました。接続を確認してください。' 
            });
        };
    }

    // --- UIへのメッセージ追加 --- //

    function addMessageToUI(data) {
        const { type, user, text, message, timestamp } = data;

        const messageWrapper = document.createElement('div');
        messageWrapper.classList.add('message-wrapper');

        // メッセージのタイムスタンプをdata属性として保持
        if (timestamp) {
            messageWrapper.dataset.timestamp = timestamp;
        }

        if (type === 'message') {
            const messageContent = document.createElement('div');
            messageContent.classList.add('message-content');

            const messageUser = document.createElement('div');
            messageUser.classList.add('message-user');
            messageUser.textContent = user;

            const messageText = document.createElement('div');
            messageText.classList.add('message-text');
            messageText.textContent = text;

            const messageTime = document.createElement('div');
            messageTime.classList.add('message-time');
            messageTime.textContent = new Date(timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

            if (user === username) {
                messageWrapper.classList.add('my-message');
            } else {
                messageWrapper.classList.add('other-message');
                messageContent.appendChild(messageUser);
            }
            
            messageContent.appendChild(messageText);
            messageContent.appendChild(messageTime);
            messageWrapper.appendChild(messageContent);

        } else if (type === 'notification') {
            messageWrapper.classList.add('notification');
            messageWrapper.textContent = message;
        }

        messagesContainer.appendChild(messageWrapper);

        // 自動スクロール
        scrollToBottom();
    }

    // --- イベントハンドラ --- //

    // 入室処理
    function joinChat() {
        const name = usernameInput.value.trim();
        if (name) {
            username = name;
            joinModal.classList.remove('active');
            chatContainer.classList.remove('hidden');
            messageInput.focus();
            connectWebSocket();
        } else {
            alert('名前を入力してください。');
        }
    }

    joinButton.addEventListener('click', joinChat);
    usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            joinChat();
        }
    });

    // メッセージ送信処理
    function sendMessage() {
        const text = messageInput.value.trim();
        if (text && ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'message', user: username, text: text }));
            messageInput.value = '';
            messageInput.focus();
        }
    }

    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // --- ユーティリティ関数 --- //

    // 自動スクロール
    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // 古いメッセージを削除する処理
    function clearOldMessages() {
        const now = new Date().getTime();
        const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);

        const messages = messagesContainer.querySelectorAll('[data-timestamp]');
        messages.forEach(msg => {
            const timestamp = parseInt(msg.dataset.timestamp, 10);
            if (timestamp < twentyFourHoursAgo) {
                msg.remove();
            }
        });
    }

    // 1分ごとに古いメッセージをチェック
    setInterval(clearOldMessages, 60 * 1000);

    // 初期表示時にモーダルをアクティブにする
    joinModal.classList.add('active');
});
