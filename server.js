require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

app.use(express.static('public'));

// HTTPサーバーの上にWebSocketサーバーを乗せる
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

io.on('connection', (socket) => {
    console.log('🟢 ブラウザとリアルタイム接続しました！');

    // ブラウザから「send_text」という名前でテキストが送られてきた時の処理
    socket.on('send_text', async (data) => {
        console.log(`🗣️ ユーザーの発言: ${data.text}`);
        
        try {
            // Geminiに爆速で解説をお願いする
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const prompt = `以下の文章にカタカナ語や専門用語が含まれていれば簡潔に解説してください。無ければ「解説不要」とだけ出力してください。\n\n文章: ${data.text}`;
            
            const result = await model.generateContent(prompt);
            const explanation = result.response.text();
            
            // できた解説を「receive_explanation」という名前でブラウザに送り返す！
            socket.emit('receive_explanation', { 
                originalText: data.text, 
                explanation: explanation 
            });

        } catch (error) {
            console.error("❌ エラー:", error);
            socket.emit('receive_explanation', { 
                originalText: data.text, 
                explanation: "⚠️ AIの処理中にエラーが発生しました。" 
            });
        }
    });

    socket.on('disconnect', () => {
        console.log('🔴 接続が切れました');
    });
});

const port = 8080;
server.listen(port, () => {
    console.log(`🚀 WebSocketサーバー起動！ http://localhost:${port}`);
});