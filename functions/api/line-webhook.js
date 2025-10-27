// functions/api/line-webhook.js
// 完全版 LINE Bot

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict';

export async function onRequestPost({ request, env }) {
    console.log('=== Webhook受信 ===');
    
    try {
        const body = await request.json();
        const events = body.events || [];
        
        for (const event of events) {
            if (event.type === 'message' && event.message.type === 'text') {
                // 非同期処理（Webhookはすぐ閉じる）
                handleMessage(event, env).catch(err => {
                    console.error('処理エラー:', err);
                });
            }
        }
        
        // すぐに200を返す
        return new Response('OK', { status: 200 });
        
    } catch (error) {
        console.error('Webhookエラー:', error);
        return new Response('Error', { status: 500 });
    }
}

async function handleMessage(event, env) {
    const message = event.message.text.trim();
    const userId = event.source.userId;
    const replyToken = event.replyToken;
    
    console.log('受信:', message);
    
    // === コマンド処理 ===
    
    // チェックコマンド
    if (message === 'チェック' || message === 'check') {
        await replyMessage(replyToken, 
            `環境変数チェック:\n\n` +
            `GEMINI: ${env.GEMINI_API_KEY ? '✅' : '❌'}\n` +
            `LINE: ${env.LINE_CHANNEL_ACCESS_TOKEN ? '✅' : '❌'}\n` +
            `GAS: ${env.GOOGLE_DRIVE_GAS_URL ? '✅' : '❌'}\n\n` +
            `GAS URL:\n${env.GOOGLE_DRIVE_GAS_URL || 'なし'}`
        , env);
        return;
    }
    
    // GASテストコマンド
    if (message === 'GASテスト' || message === 'gastest') {
        await replyMessage(replyToken, 'GASに接続テスト中...', env);
        
        try {
            const response = await fetch(env.GOOGLE_DRIVE_GAS_URL);
            const result = await response.json();
            
            await pushMessage(userId, 
                `✅ GAS接続成功！\n\n` +
                `ステータス: ${result.status}\n` +
                `バージョン: ${result.version}\n` +
                `タイムスタンプ: ${result.timestamp}`
            , env);
        } catch (error) {
            await pushMessage(userId, `❌ GAS接続失敗\n\n${error.message}`, env);
        }
        return;
    }
    
    // ダミーテストコマンド
    if (message === 'ダミーテスト' || message === 'dummy') {
        await replyMessage(replyToken, 'ダミー画像をDriveにアップロード中...', env);
        
        // 1x1の赤いピクセル
        const DUMMY = "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAIBAQIBAQICAgICAgICAwUDAwMDAwYEBAMFBwYHBwcGBwcICQsJCAgKCAcHCg0KCgsMDAwMBwkODw0MDgsMDAz/2wBDAQICAgMDAwYDAwYMCAcIDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAz/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwABmQA//Z";
        
        try {
            const result = await uploadToDrive(DUMMY, 'dummy_test', env);
            
            if (result.success) {
                await pushMessage(userId, 
                    `✅ アップロード成功！\n\n` +
                    `ファイルID: ${result.fileId}\n\n` +
                    `Google Driveに「magimagi_images」フォルダができているはずです！`
                , env);
            } else {
                await pushMessage(userId, 
                    `❌ アップロード失敗\n\n${result.error || JSON.stringify(result)}`
                , env);
            }
        } catch (error) {
            await pushMessage(userId, `❌ エラー\n\n${error.message}`, env);
        }
        return;
    }
    
    // ヘルプコマンド
    if (message === 'ヘルプ' || message === 'help' || message === '？' || message === '?') {
        await replyMessage(replyToken, 
            `🎨 magimagiボット 使い方\n\n` +
            `【画像生成】\n` +
            `メッセージを送るだけ！\n` +
            `例：「かわいい猫」\n\n` +
            `【コマンド】\n` +
            `チェック - 環境変数確認\n` +
            `GASテスト - GAS接続確認\n` +
            `ダミーテスト - Drive接続確認\n` +
            `ヘルプ - この画面\n\n` +
            `【コスト】\n` +
            `1枚あたり $0.04（約¥6）`
        , env);
        return;
    }
    
    // === 画像生成処理 ===
    console.log('画像生成開始:', message);
    
    // すぐに返信
    await replyMessage(replyToken, 
        `🎨 「${message}」を生成中...\n⏱ 約10-15秒お待ちください`
    , env);
    
    try {
        console.time('画像生成');
        const base64Image = await generateImage(message, env);
        console.timeEnd('画像生成');
        
        if (!base64Image) {
            throw new Error('画像生成APIがnullを返しました');
        }
        
        console.log('画像サイズ:', base64Image.length, '文字');
        
        console.time('Driveアップロード');
        const driveResult = await uploadToDrive(base64Image, message, env);
        console.timeEnd('Driveアップロード');
        
        if (!driveResult.success) {
            throw new Error(driveResult.error || 'Driveアップロード失敗');
        }
        
        console.log('画像URL:', driveResult.publicUrl);
        
        // LINEに画像送信
        console.time('LINE送信');
        await pushMessage(userId, {
            type: 'image',
            originalContentUrl: driveResult.publicUrl,
            previewImageUrl: driveResult.thumbnailUrl || driveResult.publicUrl
        }, env);
        console.timeEnd('LINE送信');
        
        // 完了通知
        await pushMessage(userId, `✅ 生成完了！\nコスト: $0.04 (¥6)`, env);
        
        console.log('✅ 全処理完了');
        
    } catch (error) {
        console.error('❌ エラー:', error);
        
        await pushMessage(userId, 
            `❌ エラーが発生しました\n\n` +
            `エラー: ${error.message}\n\n` +
            `「GASテスト」「ダミーテスト」で\n接続確認してください`
        , env);
    }
}

async function generateImage(prompt, env) {
    const response = await fetch(`${GEMINI_API_URL}?key=${env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            instances: [{ prompt: prompt }],
            parameters: { sampleCount: 1 }
        })
    });
    
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Imagen API エラー (${response.status}): ${error}`);
    }
    
    const result = await response.json();
    return result.predictions?.[0]?.bytesBase64Encoded;
}

async function uploadToDrive(base64Image, prompt, env) {
    const timestamp = Date.now();
    const cleanPrompt = prompt.substring(0, 20).replace(/[^a-zA-Z0-9_\-]/g, '_');
    const filename = `${cleanPrompt}_${timestamp}.jpg`;
    
    console.log('GAS URL:', env.GOOGLE_DRIVE_GAS_URL);
    console.log('ファイル名:', filename);
    
    const response = await fetch(env.GOOGLE_DRIVE_GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            base64Image: base64Image,
            filename: filename
        })
    });
    
    const responseText = await response.text();
    console.log('GASレスポンス:', responseText.substring(0, 200));
    
    if (!response.ok) {
        throw new Error(`GAS HTTPエラー: ${response.status}`);
    }
    
    let result;
    try {
        result = JSON.parse(responseText);
    } catch (e) {
        throw new Error('GASのレスポンスがJSON形式ではありません');
    }
    
    return result;
}

// テキストメッセージを返信（Reply API）
async function replyMessage(replyToken, text, env) {
    await fetch('https://api.line.me/v2/bot/message/reply', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`
        },
        body: JSON.stringify({
            replyToken: replyToken,
            messages: [{ type: 'text', text: text }]
        })
    });
}

// メッセージを送信（Push API）
async function pushMessage(userId, messageOrText, env) {
    const message = typeof messageOrText === 'string' 
        ? { type: 'text', text: messageOrText }
        : messageOrText;
    
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`
        },
        body: JSON.stringify({
            to: userId,
            messages: [message]
        })
    });
    
    if (!response.ok) {
        const error = await response.text();
        console.error('Push失敗:', error);
        throw new Error(`LINEメッセージ送信失敗: ${response.status}`);
    }
}
