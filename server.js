require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());

app.use(express.static('public'));

// 音声の一時保存先（ローカルなのでuploadsに戻します）
const upload = multer({ dest: 'uploads/' });

// 💡 ここにあなたのGemini APIキーを直接貼るか、環境変数を使ってください
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.get('/ping', (req, res) => {
    res.send('🎉 Gemini特化サーバー生きてます！');
});

app.post('/api/process-audio', upload.single('audio'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "音声がありません。" });

    const tempFilePath = req.file.path;
    // ブラウザから送られてくる音声の形式（audio/webmなど）を取得
    const mimeType = req.file.mimetype || 'audio/webm';

    try {
        console.log(`📥 音声データを受信しました！Geminiに丸投げします...`);

        // 最新のGemini 2.5 Flashを呼び出し、返事を「JSON形式」に強制する
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" } 
        });

        const prompt = `
        添付された音声ファイルを聞き取って、以下の2つを行ってください。
        1. 音声の「文字起こし」
        2. その中の「専門用語・カタカナ語の解説」（無ければ「解説不要」と記載）

        必ず以下のJSON形式のフォーマットで出力してください：
        {
            "text": "文字起こしの結果をここに入れる",
            "explanation": "用語解説の結果をここに入れる"
        }
        `;

        // 音声データをGeminiが読める形式（Base64）に変換
        const audioPart = {
            inlineData: {
                data: Buffer.from(fs.readFileSync(tempFilePath)).toString("base64"),
                mimeType: mimeType
            }
        };

        // プロンプトと音声データを一緒にGeminiへドーン！
        const result = await model.generateContent([prompt, audioPart]);
        const responseText = result.response.text();
        
        // Geminiが作ってくれたJSONをプログラム用に変換して、フロントエンドへ返す
        const parsedResult = JSON.parse(responseText);
        
        console.log(`📝 文字起こし: ${parsedResult.text}`);
        console.log(`💡 解説: ${parsedResult.explanation}`);

        res.json(parsedResult);

    } catch (error) {
        console.error("❌ エラーが発生しました:", error);
        res.status(500).json({ error: "サーバー内部でエラーが発生しました。" });
    } finally {
        // お掃除
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    }
});

// ポート8080で起動
const port = 8080;
app.listen(port, () => {
    console.log(`🚀 Gemini丸投げサーバーが起動しました！ http://localhost:${port}`);
});