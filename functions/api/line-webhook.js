// functions/api/line-webhook.js
// エラー詳細をLINEに返すデバッグ版

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict';

export async function onRequestPost({ request, env }) {
    console.log('=== Webhook受信 ===');
    
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
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function handleTextMessage(event, env) {
    const userMessage = event.message.text.trim();
    const userId = event.source.userId;
    const replyToken = event.replyToken;
    
    // 環境変数チェック
    if (userMessage === 'チェック' || userMessage === 'check') {
        const status = `
🔍 環境変数チェック

GEMINI_API_KEY: ${env.GEMINI_API_KEY ? '✅ 設定済み' : '❌ 未設定'}
LINE_CHANNEL_ACCESS_TOKEN: ${env.LINE_CHANNEL_ACCESS_TOKEN ? '✅ 設定済み' : '❌ 未設定'}
GOOGLE_DRIVE_GAS_URL: ${env.GOOGLE_DRIVE_GAS_URL ? '✅ 設定済み' : '❌ 未設定'}

GAS URL: ${env.GOOGLE_DRIVE_GAS_URL ? env.GOOGLE_DRIVE_GAS_URL.substring(0, 50) + '...' : 'なし'}
        `.trim();
        
        await sendReply(replyToken, { type: 'text', text: status }, env);
        return;
    }
    
    if (userMessage === 'テスト' || userMessage === 'test') {
        await sendReply(replyToken, {
            type: 'text',
            text: '✅ 接続OK！\n\n「チェック」と送信すると環境変数を確認できます。'
        }, env);
        return;
    }
    
    // 画像生成
    await generateAndSendImage(userMessage, event, env);
}

async function generateAndSendImage(prompt, event, env) {
    const replyToken = event.replyToken;
    const userId = event.source.userId;
    
    let errorDetails = '';
    
    try {
        await sendReply(replyToken, {
            type: 'text',
            text: `🎨 「${prompt}」を生成中...\n⏱ 約10秒お待ちください`
        }, env);
        
        // ステップ1: 画像生成
        console.log('ステップ1: 画像生成開始');
        const base64Image = await generateImage(prompt, env);
        
        if (!base64Image) {
            errorDetails = 'ステップ1で失敗: Imagen APIから画像が返ってこない';
            throw new Error('画像生成失敗');
        }
        
        console.log('ステップ1: 成功（画像サイズ:', base64Image.length, '文字）');
        
        // ステップ2: Google Driveにアップロード
        console.log('ステップ2: Driveアップロード開始');
        console.log('GAS URL:', env.GOOGLE_DRIVE_GAS_URL);
        
        if (!env.GOOGLE_DRIVE_GAS_URL) {
            errorDetails = 'ステップ2で失敗: GOOGLE_DRIVE_GAS_URLが設定されていません';
            throw new Error('GAS URL未設定');
        }
        
        const driveResult = await uploadToGoogleDrive(base64Image, prompt, env);
        
        console.log('ステップ2: 結果=', JSON.stringify(driveResult));
        
        if (!driveResult.success) {
            errorDetails = `ステップ2で失敗: ${JSON.stringify(driveResult)}`;
            throw new Error('Driveアップロード失敗');
        }
        
        console.log('ステップ2: 成功');
        
        // ステップ3: LINEに画像送信
        console.log('ステップ3: LINE送信開始');
        console.log('画像URL:', driveResult.publicUrl);
        
        await pushMessage(userId, {
            type: 'image',
            originalContentUrl: driveResult.publicUrl,
            previewImageUrl: driveResult.thumbnailUrl || driveResult.publicUrl
        }, env);
        
        console.log('ステップ3: 成功');
        
        await pushMessage(userId, {
            type: 'text',
            text: '✅ 生成完了！\nコスト: $0.04 (¥6)'
        }, env);
        
    } catch (error) {
        console.error('エラー:', error);
        
        // 詳細なエラーメッセージをLINEに送信
        const errorMessage = `
❌ エラーが発生しました

エラー: ${error.message}

詳細: ${errorDetails || 'なし'}

【確認事項】
1. 環境変数が設定されているか
2. GAS URLが正しいか
3. GASが動作しているか

「チェック」と送信すると環境変数を確認できます。
        `.trim();
        
        await pushMessage(userId, {
            type: 'text',
            text: errorMessage
        }, env);
    }
}

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

async function uploadToGoogleDrive(base64Image, prompt, env) {
    const GAS_URL = env.GOOGLE_DRIVE_GAS_URL;
    
    const timestamp = Date.now();
    const cleanPrompt = prompt.substring(0, 30).replace(/[^a-zA-Z0-9_\-]/g, '_');
    const filename = `${cleanPrompt}_${timestamp}.jpg`;
    
    console.log('GASリクエスト送信:', GAS_URL);
    console.log('ファイル名:', filename);
    console.log('画像サイズ:', base64Image.length, '文字');
    
    try {
        const response = await fetch(GAS_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                base64Image: base64Image,
                filename: filename
            })
        });
        
        console.log('GASレスポンス ステータス:', response.status);
        
        const responseText = await response.text();
        console.log('GASレスポンス テキスト:', responseText.substring(0, 200));
        
        let result;
        try {
            result = JSON.parse(responseText);
        } catch (e) {
            console.error('JSONパースエラー:', e);
            return {
                success: false,
                error: 'GASからのレスポンスがJSONではありません',
                responseText: responseText
            };
        }
        
        if (!response.ok || result.error) {
            console.error('GASエラー:', result);
            return {
                success: false,
                error: result.error || `HTTPエラー: ${response.status}`,
                result: result
            };
        }
        
        return result;
        
    } catch (error) {
        console.error('GAS通信エラー:', error);
        return {
            success: false,
            error: `通信エラー: ${error.message}`
        };
    }
}

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
