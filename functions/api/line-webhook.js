// functions/api/line-webhook.js
// Google Drive連携版 LINE Bot

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict';

export async function onRequestPost({ request, env }) {
    try {
        const body = await request.json();
        const events = body.events || [];
        
        for (const event of events) {
            if (event.type === 'message' && event.message.type === 'text') {
                await handleTextMessage(event, env);
            }
        }
        
        return new Response('OK', { status: 200 });
        
    } catch (error) {
        console.error('Webhook処理エラー:', error);
        return new Response('Error', { status: 500 });
    }
}

async function handleTextMessage(event, env) {
    const userMessage = event.message.text.trim();
    const userId = event.source.userId;
    const replyToken = event.replyToken;
    
    // ヘルプコマンド
    if (userMessage === 'ヘルプ' || userMessage === 'help') {
        await sendReply(replyToken, {
            type: 'text',
            text: '🎨 使い方\n\nメッセージを送るだけで画像生成！\n例：「かわいい猫」\n\nコスト：1枚 $0.04（約¥6）'
        }, env);
        return;
    }
    
    // 通常メッセージ = プロンプトとして処理
    await generateAndSendImage(userMessage, event, env);
}

async function generateAndSendImage(prompt, event, env) {
    const replyToken = event.replyToken;
    const userId = event.source.userId;
    
    // 処理中メッセージ
    await sendReply(replyToken, {
        type: 'text',
        text: `🎨 「${prompt}」を生成中...\n⏱ 約10秒お待ちください`
    }, env);
    
    try {
        // 1. Imagen APIで画像生成
        console.log('画像生成開始...');
        const base64Image = await generateImage(prompt, env);
        
        if (!base64Image) {
            throw new Error('画像生成失敗');
        }
        
        // 2. Google Driveに保存
        console.log('Google Driveにアップロード中...');
        const driveResult = await uploadToGoogleDrive(base64Image, prompt, env);
        
        if (!driveResult.success) {
            throw new Error('Google Driveアップロード失敗');
        }
        
        // 3. LINEで画像を送信
        console.log('LINEに画像送信...');
        await pushMessage(userId, {
            type: 'image',
            originalContentUrl: driveResult.publicUrl,
            previewImageUrl: driveResult.thumbnailUrl || driveResult.publicUrl
        }, env);
        
        // 4. 完了メッセージ
        await pushMessage(userId, {
            type: 'text',
            text: '✅ 生成完了！\nコスト: $0.04 (¥6)'
        }, env);
        
    } catch (error) {
        console.error('エラー:', error);
        await pushMessage(userId, {
            type: 'text',
            text: `❌ エラーが発生しました\n${error.message}\n\nもう一度お試しください。`
        }, env);
    }
}

/**
 * Imagen APIで画像生成
 */
async function generateImage(prompt, env) {
    const API_KEY = env.GEMINI_API_KEY;
    
    const payload = {
        instances: [{ prompt: prompt }],
        parameters: { sampleCount: 1 }
    };
    
    const response = await fetch(`${GEMINI_API_URL}?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    
    if (!response.ok) {
        console.error('Imagen APIエラー:', result);
        return null;
    }
    
    return result.predictions?.[0]?.bytesBase64Encoded;
}

/**
 * Google Driveに画像をアップロード
 */
async function uploadToGoogleDrive(base64Image, prompt, env) {
    const GAS_URL = env.GOOGLE_DRIVE_GAS_URL; // GASのWebアプリURL
    
    // ファイル名を生成（プロンプトの一部を使用）
    const timestamp = Date.now();
    const cleanPrompt = prompt.substring(0, 30).replace(/[^a-zA-Z0-9_\-]/g, '_');
    const filename = `${cleanPrompt}_${timestamp}.jpg`;
    
    const response = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            base64Image: base64Image,
            filename: filename
        })
    });
    
    const result = await response.json();
    
    if (!response.ok || result.error) {
        console.error('Google Driveアップロードエラー:', result);
        throw new Error(result.error || 'アップロード失敗');
    }
    
    return result;
}

/**
 * LINE Reply API
 */
async function sendReply(replyToken, message, env) {
    const LINE_CHANNEL_TOKEN = env.LINE_CHANNEL_ACCESS_TOKEN;
    
    await fetch('https://api.line.me/v2/bot/message/reply', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${LINE_CHANNEL_TOKEN}`
        },
        body: JSON.stringify({
            replyToken: replyToken,
            messages: [message]
        })
    });
}

/**
 * LINE Push API
 */
async function pushMessage(userId, message, env) {
    const LINE_CHANNEL_TOKEN = env.LINE_CHANNEL_ACCESS_TOKEN;
    
    await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${LINE_CHANNEL_TOKEN}`
        },
        body: JSON.stringify({
            to: userId,
            messages: [message]
        })
    });
}
