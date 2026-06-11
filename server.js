require('dotenv').config();
const Groq = require('groq-sdk');
const fs = require('fs');
const record = require('node-record-lpcm16');
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const port = 8080;
const app = express(); 

app.use(cors());

app.use(express.static('public'));

// APIクライアントの初期化
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const upload = multer({ dest: 'uploads/' });

//音声処理API
app.post("/api/process-audio", upload.single('audio'), async(req, res)=>{
    if (!req.file) {
        return res.status(400).json({ error: "音声ファイルが送信されていません。" });
    }


    //修正
    const originalPath = req.file.path;
    const originalName = req.file.originalname;
    
    // 送られてきたファイル名（test.mp3など）から拡張子を取り出す。無ければ安全のため mp3 にする
    const extension = originalName.includes('.') ? originalName.split('.').pop() : 'mp3';
    
    // ファイル名に拡張子をドッキング！（例：uploads/xxxxxx.mp3）
    const tempFilePath = `${originalPath}.${extension}`;
    
    // 実際にサーバー上のファイル名を変更する
    fs.renameSync(originalPath, tempFilePath);

    console.log(`📁 音声ファイルを一時保存しました: ${tempFilePath}`);

    try {
        // 1. Groq (Whisper) で文字起こし
        const transcription = await groq.audio.transcriptions.create({
            //fs.createReadStreamは少しずつファイルを読み込む
            file: fs.createReadStream(tempFilePath),
            model: "whisper-large-v3",
            language: "ja",
        });
        
        const text = transcription.text;
        console.log(`📝 【文字起こし】: ${text}`);

        if (!text || text.trim() === "") {
            return res.json({ text: "", explanation: "音声が検出されませんでした。" });
        }

        // 2. Gemini で専門用語・カタカナ語の解説
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `
        以下の文章にカタカナ語や専門用語が含まれていれば、その言葉の意味を簡潔に箇条書きで解説してください。
        もし一般的な言葉しかなく、解説が不要な場合は「解説が必要な用語はありません」とだけ出力してください。
        
        文章: ${text}
        `;

        const result = await model.generateContent(prompt);
        const explanation = result.response.text();
        console.log(`💡 【AI解説】:\n${explanation}`);

        // フロントエンド（ブラウザ）へ結果を返す
        res.json({
            text: text,
            explanation: explanation
        });

    } catch (error) {
        console.error("❌ エラーが発生しました:", error);
        res.status(500).json({ error: "サーバー内部でエラーが発生しました。" });
    } finally {
        // 【重要】処理が終わったら、成功・失敗に関わらず一時ファイルを削除する
        // fs.existsSyncは指定されたパスにファイルが存在するかfs.unlinkSyncは削除
        try {
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
                console.log(`🧹 一時ファイルを削除しました: ${tempFilePath}`);
            }
        } catch (cleanupError) {
            console.error("⚠️ 一時ファイルの削除に失敗しました:", cleanupError);
        }
    }
});

app.listen(port, '127.0.0.1', () => {
    console.log(`🚀 サーバーが起動しました！ http://localhost:${port}`);
});