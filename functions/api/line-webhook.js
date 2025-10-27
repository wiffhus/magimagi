// functions/api/line-webhook.js
// 段階的に機能を追加する安全版

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict';

export async function onRequestPost({ request, env }) {
    console.log('=== Webhook受信 ===');
    
    try {
        const body = await request.json();
        const events = body.events || [];
        
        for (const event of events) {
            if (event.type === 'message' && event.message.type === 'text') {
                const message = event.message.text.trim();
                const userId = event.source.userId;
                const replyToken = event.replyToken;
                
                console.log('受信メッセージ:', message);
                
                // === まず確実に返信する ===
                await sendReply(replyToken, `受信: ${message}`, env);
                
                // === コマンドチェック ===
                if (message === 'チェック') {
                    await pushText(userId, 
                        `環境変数:\n` +
                        `GEMINI: ${env.GEMINI_API_KEY ? 'OK' : 'NG'}\n` +
                        `LINE: ${env.LINE_CHANNEL_ACCESS_TOKEN ? 'OK' : 'NG'}\n` +
                        `GAS: ${env.GOOGLE_DRIVE_GAS_URL ? 'OK' : 'NG'}`
                    , env);
                    continue;
                }
                
                if (message === 'GASテスト') {
                    try {
                        const response = await fetch(env.GOOGLE_DRIVE_GAS_URL);
                        const result = await response.json();
                        await pushText(userId, `GAS OK: ${result.status}`, env);
                    } catch (error) {
                        await pushText(userId, `GAS NG: ${error.message}`, env);
                    }
                    continue;
                }
                
                if (message === 'ダミーテスト') {
                    const DUMMY = "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAIBAQIBAQICAgICAgICAwUDAwMDAwYEBAMFBwYHBwcGBwcICQsJCAgKCAcHCg0KCgsMDAwMBwkODw0MDgsMDAz/2wBDAQICAgMDAwYDAwYMCAcIDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAz/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwABmQA//Z";
                    
                    try {
                        console.log('ダミーテスト開始');
                        
                        const gasResponse = await fetch(env.GOOGLE_DRIVE_GAS_URL, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                base64Image: DUMMY,
                                filename: 'test_' + Date.now() + '.jpg'
                            })
                        });
                        
                        console.log('GAS Status:', gasResponse.status);
                        
                        const gasText = await gasResponse.text();
                        console.log('GAS Response:', gasText);
                        
                        const gasResult = JSON.parse(gasText);
                        
                        if (gasResult.success) {
                            await pushText(userId, `✅ アップロード成功！\nDriveを確認してください`, env);
                        } else {
                            await pushText(userId, `❌ 失敗: ${gasResult.error}`, env);
                        }
                    } catch (error) {
                        console.error('ダミーテストエラー:', error);
                        await pushText(userId, `❌ エラー: ${error.message}`, env);
                    }
                    continue;
                }
                
                // === 画像生成 ===
                if (message !== 'チェック' && message !== 'GASテスト' && message !== 'ダミーテスト') {
                    try {
                        console.log('画像生成開始');
                        
                        // ステップ1: 画像生成
                        await pushText(userId, 'ステップ1: 画像生成中...', env);
                        
                        const imgResponse = await fetch(`${GEMINI_API_URL}?key=${env.GEMINI_API_KEY}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                instances: [{ prompt: message }],
                                parameters: { sampleCount: 1 }
                            })
                        });
                        
                        console.log('Imagen Status:', imgResponse.status);
                        
                        const imgResult = await imgResponse.json();
                        const base64Image = imgResult.predictions?.[0]?.bytesBase64Encoded;
                        
                        if (!base64Image) {
                            throw new Error('画像データなし');
                        }
                        
                        console.log('画像サイズ:', base64Image.length);
                        await pushText(userId, 'ステップ2: Driveアップロード中...', env);
                        
                        // ステップ2: Driveアップロード
                        const gasResponse = await fetch(env.GOOGLE_DRIVE_GAS_URL, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                base64Image: base64Image,
                                filename: message.substring(0, 20) + '_' + Date.now() + '.jpg'
                            })
                        });
                        
                        console.log('GAS Status:', gasResponse.status);
                        
                        const gasText = await gasResponse.text();
                        const gasResult = JSON.parse(gasText);
                        
                        if (!gasResult.success) {
                            throw new Error(gasResult.error || 'アップロード失敗');
                        }
                        
                        console.log('URL:', gasResult.publicUrl);
                        await pushText(userId, 'ステップ3: LINEに送信中...', env);
                        
                        // ステップ3: 画像送信
                        await pushImage(userId, gasResult.publicUrl, env);
                        await pushText(userId, '✅ 完了！', env);
                        
                    } catch (error) {
                        console.error('画像生成エラー:', error);
                        await pushText(userId, `❌ エラー: ${error.message}`, env);
                    }
                }
            }
        }
        
        return new Response('OK', { status: 200 });
        
    } catch (error) {
        console.error('Webhookエラー:', error);
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Reply API（最初の返信）
async function sendReply(replyToken, text, env) {
    const response = await fetch('https://api.line.me/v2/bot/message/reply', {
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
    
    if (!response.ok) {
        console.error('Reply失敗:', response.status);
    }
}

// Push API（テキスト）
async function pushText(userId, text, env) {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`
        },
        body: JSON.stringify({
            to: userId,
            messages: [{ type: 'text', text: text }]
        })
    });
    
    if (!response.ok) {
        console.error('Push失敗:', response.status);
    }
}

// Push API（画像）
async function pushImage(userId, imageUrl, env) {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`
        },
        body: JSON.stringify({
            to: userId,
            messages: [{
                type: 'image',
                originalContentUrl: imageUrl,
                previewImageUrl: imageUrl
            }]
        })
    });
    
    if (!response.ok) {
        console.error('画像Push失敗:', response.status);
    }
}
