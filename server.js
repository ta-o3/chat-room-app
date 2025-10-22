const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

// 接続されているクライアントを管理するSet
const clients = new Set();
// メッセージ履歴を保存する配列
const messageHistory = [];
const MESSAGE_LIFETIME = 24 * 60 * 60 * 1000; // 24時間 (ミリ秒)

console.log('WebSocketサーバーがポート8080で起動しました。');

wss.on('connection', (ws) => {
  console.log('クライアントが接続しました。');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      // タイプに応じて処理を分岐
      if (data.type === 'join') {
        // 新しいクライアントにユーザー名を設定し、clients Setに追加
        ws.username = data.user;
        clients.add(ws);
        console.log(`${ws.username}さんが参加しました。`);

        // 接続してきたクライアントにメッセージ履歴を送信
        if (messageHistory.length > 0) {
          ws.send(JSON.stringify({ type: 'history', messages: messageHistory }));
        }

        // 全クライアントに参加を通知
        broadcast({
          type: 'notification',
          message: `${ws.username}さんが入室しました。`
        });
      } else if (data.type === 'message') {
        console.log(`メッセージ受信 from ${data.user}: ${data.text}`);
        const messageData = {
          type: 'message',
          user: data.user,
          text: data.text,
          timestamp: new Date().getTime()
        };
        // メッセージ履歴に追加
        messageHistory.push(messageData);
        // 全クライアントにメッセージを配信
        broadcast(messageData);
      }
    } catch (error) {
      console.error('無効なメッセージ形式:', error);
    }
  });

  ws.on('close', () => {
    if (ws.username) {
      console.log(`${ws.username}さんが切断しました。`);
      clients.delete(ws);
      // 全クライアントに退室を通知
      broadcast({
        type: 'notification',
        message: `${ws.username}さんが退室しました。`
      });
    } else {
      console.log('クライアントが切断しました。');
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocketエラー:', error);
  });
});

// 全クライアントにメッセージを送信する関数
function broadcast(data) {
  const message = JSON.stringify(data);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// 24時間以上経過したメッセージを履歴から削除する関数
function cleanupMessageHistory() {
  const now = new Date().getTime();
  // 古いメッセージをフィルタリングして削除
  for (let i = 0; i < messageHistory.length; i++) {
    if (now - messageHistory[i].timestamp > MESSAGE_LIFETIME) {
      messageHistory.splice(i, 1);
      i--; // 要素を削除したのでインデックスを調整
    } else {
      // 履歴は時系列順なので、これ以上古いメッセージはない
      break;
    }
  }
  // console.log('メッセージ履歴クリーンアップ後:', messageHistory.length);
}

// 1分ごとにメッセージ履歴をクリーンアップ
setInterval(cleanupMessageHistory, 60 * 1000);
