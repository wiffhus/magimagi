// functions/api/line-webhook.js
// Cloudflareは受付だけ、処理はGASに丸投げ

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
                
                console.log('受信:', message);
                
                // すぐに返信（3秒以内）
                await sendReply(replyToken, `🎨 受付完了！\n「${message}」を生成します`, env);
                
                // === コマンド処理 ===
                if (message === 'チェック') {
                    await pushText(userId, 
                        `環境変数:\nGEMINI: ${env.GEMINI_API_KEY ? 'OK' : 'NG'}\n` +
                        `LINE: ${env.LINE_CHANNEL_ACCESS_TOKEN ? 'OK' : 'NG'}\n` +
                        `GAS: ${env.GOOGLE_DRIVE_GAS_URL ? 'OK' : 'NG'}`
                    , env);
                    continue;
                }
                
                if (message === 'ダミーテスト') {
                    const DUMMY = "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAIBAQIBAQICAgICAgICAwUDAwMDAwYEBAMFBwYHBwcGBwcICQsJCAgKCAcHCg0KCgsMDAwMBwkODw0MDgsMDAz/2wBDAQICAgMDAwYDAwYMCAcIDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAz/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwABmQA//Z";
                    
                    // GASに投げる（従来通り）
                    const result = await fetch(env.GOOGLE_DRIVE_GAS_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            base64Image: DUMMY,
                            filename: 'test_' + Date.now() + '.jpg'
                        })
                    });
                    
                    const data = await result.json();
                    await pushText(userId, data.success ? '✅ 成功！' : '❌ 失敗', env);
                    continue;
                }
                
                // === 画像生成 ===
                // GASに丸投げ（画像生成もGASでやる）
                console.log('GASに画像生成リクエスト送信');
                
                fetch(env.GOOGLE_DRIVE_GAS_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        generateImage: true,
                        prompt: message,
                        userId: userId
                    })
                }).catch(err => {
                    console.error('GASリクエスト失敗:', err);
                });
                
                // Cloudflareの仕事はここまで！
                // あとはGASが勝手にやる
            }
        }
        
        return new Response('OK', { status: 200 });
        
    } catch (error) {
        console.error('エラー:', error);
        return new Response('Error', { status: 500 });
    }
}

async function sendReply(replyToken, text, env) {
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

async function pushText(userId, text, env) {
    await fetch('https://api.line.me/v2/bot/message/push', {
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
}
