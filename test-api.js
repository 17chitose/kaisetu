
// test-api.js
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

// 💡 テスト用音声ファイルのパス
const TEST_FILE_PATH = './test.mp3'; 

async function testMyApi() {
    console.log("🚀 テストスクリプト起動！APIにファイルを送信します...");

    if (!fs.existsSync(TEST_FILE_PATH)) {
        console.error(`❌ エラー: ${TEST_FILE_PATH} が見つかりません。`);
        return;
    }

    // パッケージのFormDataを使ってファイルをセット
    const form = new FormData();
    // ストリームとして安全に読み込む（これがフリーズしない秘訣です）
    form.append('audio', fs.createReadStream(TEST_FILE_PATH));

    try {
        console.log("📡 送信中...");
        
        // axiosを使って確実に送信！ (自動で完璧なヘッダーを作ってくれます)
        const response = await axios.post('http://localhost:8080/api/process-audio', form, {
            headers: form.getHeaders()
        });

        console.log("\n🎉 【大成功】APIから返事が来ました！\n");
        console.log("📝 文字起こし:", response.data.text);
        console.log("💡 解説:\n", response.data.explanation);

    } catch (error) {
        // エラーの理由を詳細に表示
        if (error.response) {
            console.error(`\n❌ サーバーエラー (Status: ${error.response.status}):`, error.response.data);
        } else {
            console.error("\n❌ 通信エラー:", error.message);
        }
    }
}

testMyApi();