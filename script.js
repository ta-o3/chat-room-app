document.addEventListener('DOMContentLoaded', () => {
    const joinModal = document.getElementById('join-modal');
    const usernameInput = document.getElementById('username-input');
    const joinButton = document.getElementById('join-button');
    const chatContainer = document.getElementById('chat-container');
    const messagesContainer = document.getElementById('chat-messages');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');

    let username = '';
    let lastMessageTimestamp = 0; // 最後に取得したメッセージのタイムスタンプ
    let messagePollingInterval; // ポーリングのインターバルID

    // --- APIエンドポイント --- //
    const API_BASE_URL = window.location.origin; // 現在のホストを使用

    // --- UIへのメッセージ追加 --- //

    function addMessageToUI(data, isHistory = false) {
        const { type, user, text, message, timestamp } = data;

        // 既に表示されているメッセージはスキップ
        if (!isHistory && timestamp <= lastMessageTimestamp) {
            return;
        }

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

        // タイムスタンプを更新
        if (timestamp > lastMessageTimestamp) {
            lastMessageTimestamp = timestamp;
        }
    }

    // --- メッセージのポーリング --- //

    async function fetchMessages() {
        try {
            const response = await fetch(`${API_BASE_URL}/messages`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const messages = await response.json();

            // 履歴メッセージを一度クリアして再描画（簡易的な方法）
            // より高度な実装では差分更新を行う
            messagesContainer.innerHTML = ''; 
            messages.forEach(msg => addMessageToUI(msg, true));

            // 最新のメッセージのタイムスタンプを更新
            if (messages.length > 0) {
                lastMessageTimestamp = messages[messages.length - 1].timestamp;
            }

            // 入室通知をクライアント側で生成
            // サーバーは入室をログするだけなので、クライアント側で通知を生成
            // ただし、これは簡易的な実装であり、正確な入退室通知には限界がある
            // サーバー側で入退室イベントを管理し、それをポーリングで取得する方が正確

        } catch (error) {
            console.error('メッセージの取得に失敗しました:', error);
            // エラー通知は表示しない（頻繁に表示されるのを避けるため）
        }
    }

    // --- イベントハンドラ --- //

    // 入室処理
    async function joinChat() {
        const name = usernameInput.value.trim();
        if (name) {
            username = name;
            joinModal.classList.remove('active');
            chatContainer.classList.remove('hidden');
            messageInput.focus();

            // サーバーに入室を通知（ログ用）
            try {
                await fetch(`${API_BASE_URL}/join`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user: username })
                });
                // クライアント側で入室通知を表示
                addMessageToUI({ type: 'notification', message: `${username}さんが入室しました。` });
            } catch (error) {
                console.error('入室通知の送信に失敗しました:', error);
            }

            // メッセージのポーリングを開始
            fetchMessages(); // 初回取得
            messagePollingInterval = setInterval(fetchMessages, 3000); // 3秒ごとにポーリング

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
    async function sendMessage() {
        const text = messageInput.value.trim();
        if (text) {
            try {
                const response = await fetch(`${API_BASE_URL}/send`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user: username, text: text })
                });
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                messageInput.value = '';
                messageInput.focus();
                fetchMessages(); // 送信後すぐにメッセージを再取得
            } catch (error) {
                console.error('メッセージの送信に失敗しました:', error);
                alert('メッセージの送信に失敗しました。');
            }
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