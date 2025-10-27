// functions/api/line-webhook.js
// デバッグログ付きバージョン

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict';

export async function onRequestPost({ request, env }) {
    console.log('=== Webhook受信 ===');
    
    try {
        const body = await request.json();
        console.log('Body:', JSON.stringify(body));
        
        const events = body.events || [];
        console.log('Events数:', events.length);
        
        for (const event of events) {
            console.log('Event Type:', event.type);
            console.log('Message Type:', event.message?.type);
            
            if (event.type === 'message' && event.message.type === 'text') {
                console.log('テキストメッセージ処理開始');
                await handleTextMessage(event, env);
            }
        }
        
        return new Response('OK', { status: 200 });
        
    } catch (error) {
        console.error('❌ Webhook処理エラー:', error);
        console.error('エラー詳細:', error.message);
        console.error('スタック:', error.stack);
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
    
    console.log('ユーザーID:', userId);
    console.log('メッセージ:', userMessage);
    console.log('Reply Token:', replyToken);
    
    // 環境変数チェック
    console.log('GEMINI_API_KEY:', env.GEMINI_API_KEY ? 'あり' : '❌ なし');
    console.log('LINE_CHANNEL_ACCESS_TOKEN:', env.LINE_CHANNEL_ACCESS_TOKEN ? 'あり' : '❌ なし');
    console.log('GOOGLE_DRIVE_GAS_URL:', env.GOOGLE_DRIVE_GAS_URL ? 'あり' : '❌ なし');
    
    // ヘルプコマンド
    if (userMessage === 'ヘルプ' || userMessage === 'help' || userMessage === 'テスト') {
        console.log('ヘルプメッセージ送信');
        await sendReply(replyToken, {
            type: 'text',
            text: '🎨 magimagiボット\n\n動作確認OK！\n\nメッセージを送るだけで画像生成できます。\n例：「かわいい猫」'
        }, env);
        return;
    }
    
    // 通常メッセージ = プロンプトとして処理
    console.log('画像生成処理開始');
    await generateAndSendImage(userMessage, event, env);
}

async function generateAndSendImage(prompt, event, env) {
    const replyToken = event.replyToken;
    const userId = event.source.userId;
    
    console.log('1. 処理中メッセージ送信');
    
    try {
        await sendReply(replyToken, {
            type: 'text',
            text: `🎨 「${prompt}」を生成中...\n⏱ 約10秒お待ちください`
        }, env);
        
        console.log('2. 画像生成開始');
        const base64Image = await generateImage(prompt, env);
        
        if (!base64Image) {
            throw new Error('画像生成失敗：base64Imageがnull');
        }
        
        console.log('3. 画像生成成功（サイズ:', base64Image.length, '文字）');
        console.log('4. Google Driveにアップロード開始');
        
        const driveResult = await uploadToGoogleDrive(base64Image, prompt, env);
        
        console.log('5. Driveアップロード結果:', JSON.stringify(driveResult));
        
        if (!driveResult.success) {
            throw new Error('Google Driveアップロード失敗');
        }
        
        console.log('6. LINEに画像送信');
        console.log('   URL:', driveResult.publicUrl);
        
        await pushMessage(userId, {
            type: 'image',
            originalContentUrl: driveResult.publicUrl,
            previewImageUrl: driveResult.thumbnailUrl || driveResult.publicUrl
        }, env);
        
        console.log('7. 完了メッセージ送信');
        
        await pushMessage(userId, {
            type: 'text',
            text: '✅ 生成完了！\nコスト: $0.04 (¥6)'
        }, env);
        
        console.log('✅ 全処理完了');
        
    } catch (error) {
        console.error('❌ エラー発生:', error);
        console.error('エラーメッセージ:', error.message);
        console.error('スタック:', error.stack);
        
        await pushMessage(userId, {
            type: 'text',
            text: `❌ エラーが発生しました\n\n詳細: ${error.message}\n\nもう一度お試しください。`
        }, env);
    }
}

async function generateImage(prompt, env) {
    const API_KEY = env.GEMINI_API_KEY;
    
    console.log('   Gemini API呼び出し');
    
    const payload = {
        instances: [{ prompt: prompt }],
        parameters: { sampleCount: 1 }
    };
    
    const response = await fetch(`${GEMINI_API_URL}?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    
    console.log('   Gemini APIレスポンス:', response.status);
    
    const result = await response.json();
    
    if (!response.ok) {
        console.error('   Gemini APIエラー:', result);
        return null;
    }
    
    return result.predictions?.[0]?.bytesBase64Encoded;
}

async function uploadToGoogleDrive(base64Image, prompt, env) {
    const GAS_URL = env.GOOGLE_DRIVE_GAS_URL;
    
    console.log('   GAS URL:', GAS_URL);
    
    const timestamp = Date.now();
    const cleanPrompt = prompt.substring(0, 30).replace(/[^a-zA-Z0-9_\-]/g, '_');
    const filename = `${cleanPrompt}_${timestamp}.jpg`;
    
    console.log('   ファイル名:', filename);
    
    const response = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            base64Image: base64Image,
            filename: filename
        })
    });
    
    console.log('   GASレスポンス:', response.status);
    
    const result = await response.json();
    
    console.log('   GAS結果:', JSON.stringify(result).substring(0, 200));
    
    if (!response.ok || result.error) {
        console.error('   GASエラー:', result);
        throw new Error(result.error || 'アップロード失敗');
    }
    
    return result;
}

async function sendReply(replyToken, message, env) {
    const LINE_CHANNEL_TOKEN = env.LINE_CHANNEL_ACCESS_TOKEN;
    
    console.log('   Reply送信:', message.text?.substring(0, 30));
    
    const response = await fetch('https://api.line.me/v2/bot/message/reply', {
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
    
    console.log('   Reply結果:', response.status);
    
    if (!response.ok) {
        const error = await response.text();
        console.error('   Reply エラー:', error);
    }
}

async function pushMessage(userId, message, env) {
    const LINE_CHANNEL_TOKEN = env.LINE_CHANNEL_ACCESS_TOKEN;
    
    console.log('   Push送信 to', userId);
    
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
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
    
    console.log('   Push結果:', response.status);
    
    if (!response.ok) {
        const error = await response.text();
        console.error('   Push エラー:', error);
    }
}
