// functions/api/line-webhook.js
// タイムアウト対策版

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict';

export async function onRequestPost({ request, env }) {
    try {
        const body = await request.json();
        const events = body.events || [];
        
        // イベント処理は待たずに即座に200を返す
        for (const event of events) {
            if (event.type === 'message' && event.message.type === 'text') {
                // 非同期で処理（await しない）
                handleTextMessage(event, env).catch(err => {
                    console.error('処理エラー:', err);
                });
            }
        }
        
        // すぐに200を返してWebhookを閉じる
        return new Response('OK', { status: 200 });
        
    } catch (error) {
        console.error('Webhook Error:', error);
        return new Response('Error', { status: 500 });
    }
}

async function handleTextMessage(event, env) {
    const userMessage = event.message.text.trim();
    const userId = event.source.userId;
    const replyToken = event.replyToken;
    
    // === チェックコマンド ===
    if (userMessage === 'チェック') {
        await sendReply(replyToken, {
            type: 'text',
            text: `環境変数チェック:\n\nGEMINI: ${env.GEMINI_API_KEY ? 'OK' : 'NG'}\nLINE: ${env.LINE_CHANNEL_ACCESS_TOKEN ? 'OK' : 'NG'}\nGAS: ${env.GOOGLE_DRIVE_GAS_URL ? 'OK' : 'NG'}\n\nURL: ${env.GOOGLE_DRIVE_GAS_URL || 'なし'}`
        }, env);
        return;
    }
    
    // === GASテストコマンド ===
    if (userMessage === 'GASテスト') {
        await sendReply(replyToken, {
            type: 'text',
            text: 'GASに接続中...'
        }, env);
        
        try {
            const response = await fetch(env.GOOGLE_DRIVE_GAS_URL);
            const result = await response.json();
            
            await pushMessage(userId, {
                type: 'text',
                text: `✅ GAS接続成功！\n\nステータス: ${result.status}`
            }, env);
        } catch (error) {
            await pushMessage(userId, {
                type: 'text',
                text: `❌ GAS接続失敗\n\n${error.message}`
            }, env);
        }
        return;
    }
    
    // === ダミーテストコマンド ===
    if (userMessage === 'ダミーテスト') {
        await sendReply(replyToken, {
            type: 'text',
            text: 'ダミー画像アップロード中...'
        }, env);
        
        const DUMMY = "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAIBAQIBAQICAgICAgICAwUDAwMDAwYEBAMFBwYHBwcGBwcICQsJCAgKCAcHCg0KCgsMDAwMBwkODw0MDgsMDAz/2wBDAQICAgMDAwYDAwYMCAcIDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAz/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwABmQA//Z";
        
        try {
            const result = await uploadToGoogleDrive(DUMMY, 'dummy', env);
            
            await pushMessage(userId, {
                type: 'text',
                text: result.success ? `✅ 成功！\n\nGoogle Driveを確認！` : `❌ 失敗\n\n${JSON.stringify(result)}`
            }, env);
        } catch (error) {
            await pushMessage(userId, {
                type: 'text',
                text: `❌ エラー\n\n${error.message}`
            }, env);
        }
        return;
    }
    
    // === 画像生成 ===
    // すぐに返信（Reply API使用）
    await sendReply(replyToken, {
        type: 'text',
        text: `🎨 「${userMessage}」\n生成開始します...`
    }, env);
    
    try {
        console.log('=== 画像生成開始 ===');
        console.time('total');
        
        // ステップ1: 画像生成
        console.time('imagen');
        const base64Image = await generateImage(userMessage, env);
        console.timeEnd('imagen');
        
        if (!base64Image) {
            throw new Error('画像生成失敗');
        }
        
        console.log('画像サイズ:', base64Image.length);
        
        // ステップ2: Driveアップロード
        console.time('drive');
        const driveResult = await uploadToGoogleDrive(base64Image, userMessage, env);
        console.timeEnd('drive');
        
        if (!driveResult.success) {
            throw new Error(`Drive失敗: ${driveResult.error}`);
        }
        
        console.log('Drive URL:', driveResult.publicUrl);
        
        // ステップ3: 画像送信
        console.time('line-push');
        await pushMessage(userId, {
            type: 'image',
            originalContentUrl: driveResult.publicUrl,
            previewImageUrl: driveResult.thumbnailUrl || driveResult.publicUrl
        }, env);
        console.timeEnd('line-push');
        
        // 完了通知
        await pushMessage(userId, {
            type: 'text',
            text: '✅ 完了！コスト: $0.04'
        }, env);
        
        console.timeEnd('total');
        console.log('=== 処理完了 ===');
        
    } catch (error) {
        console.error('=== エラー発生 ===');
        console.error(error);
        
        await pushMessage(userId, {
            type: 'text',
            text: `❌ エラー発生\n\n${error.message}\n\n「GASテスト」や「ダミーテスト」で確認してください`
        }, env);
    }
}

async function generateImage(prompt, env) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8秒でタイムアウト
    
    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${env.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                instances: [{ prompt: prompt }],
                parameters: { sampleCount: 1 }
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`Imagen API error: ${response.status}`);
        }
        
        const result = await response.json();
        return result.predictions?.[0]?.bytesBase64Encoded;
        
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('画像生成がタイムアウトしました（8秒超過）');
        }
        throw error;
    }
}

async function uploadToGoogleDrive(base64Image, prompt, env) {
    const GAS_URL = env.GOOGLE_DRIVE_GAS_URL;
    const timestamp = Date.now();
    const cleanPrompt = prompt.substring(0, 20).replace(/[^a-zA-Z0-9_\-]/g, '_');
    const filename = `${cleanPrompt}_${timestamp}.jpg`;
    
    console.log('GAS URL:', GAS_URL);
    console.log('Filename:', filename);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒でタイムアウト
    
    try {
        const response = await fetch(GAS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                base64Image: base64Image,
                filename: filename
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        const responseText = await response.text();
        console.log('GAS Response:', responseText.substring(0, 100));
        
        const result = JSON.parse(responseText);
        return result;
        
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            return {
                success: false,
                error: 'GASがタイムアウトしました（5秒超過）'
            };
        }
        return {
            success: false,
            error: error.message
        };
    }
}

async function sendReply(replyToken, message, env) {
    await fetch('https://api.line.me/v2/bot/message/reply', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`
        },
        body: JSON.stringify({
            replyToken: replyToken,
            messages: [message]
        })
    });
}

async function pushMessage(userId, message, env) {
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
        console.error('Push message failed:', response.status);
    }
}
