const http = require('http');
const fs = require('fs');
const path = require('path');

// メッセージ履歴を保存する配列
const messageHistory = [];
const MESSAGE_LIFETIME = 24 * 60 * 60 * 1000; // 24時間 (ミリ秒)

const clients = new Set(); // WebSocketではないが、クライアント数を把握するために残しておく

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // CORSヘッダーの設定
  res.setHeader('Access-Control-Allow-Origin', '*'); // すべてのオリジンを許可
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONSリクエストの処理 (CORSプリフライト)
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname === '/messages' && req.method === 'GET') {
    // メッセージ履歴を返すAPI
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(messageHistory));
  } else if (pathname === '/send' && req.method === 'POST') {
    // メッセージを受信するAPI
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (data.user && data.text) {
          const messageData = {
            type: 'message',
            user: data.user,
            text: data.text,
            timestamp: new Date().getTime()
          };
          messageHistory.push(messageData);
          console.log(`メッセージ受信 from ${data.user}: ${data.text}`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'success' }));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'error', message: 'Invalid message format' }));
        }
      } catch (error) {
        console.error('メッセージ処理エラー:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', message: 'Invalid JSON' }));
      }
    });
  } else if (pathname === '/join' && req.method === 'POST') {
    // 入室通知API (WebSocketではないので、クライアント側で通知を生成する)
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (data.user) {
          console.log(`${data.user}さんが入室しました。`);
          // 実際にはクライアント側で通知を生成するため、サーバーは履歴を返すのみ
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'success' }));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'error', message: 'Invalid user format' }));
        }
      } catch (error) {
        console.error('入室処理エラー:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', message: 'Invalid JSON' }));
      }
    });
  } else {
    // 静的ファイルの配信
    let filePath = '.' + pathname;
    if (pathname === '/') {
      filePath = './index.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'text/javascript',
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
        if (error.code == 'ENOENT') {
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end('<h1>404 Not Found</h1>', 'utf-8');
        } else {
          res.writeHead(500);
          res.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
        }
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
      }
    });
  }
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`HTTPサーバーがポート${PORT}で起動しました。`);
});

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
}

// 1分ごとにメッセージ履歴をクリーンアップ
setInterval(cleanupMessageHistory, 60 * 1000);