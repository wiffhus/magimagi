// functions/api/line-webhook.js
// 全メッセージに反応するテスト版

export async function onRequestPost({ request, env }) {
    console.log('=== Webhook受信 ===');
    
    try {
        const body = await request.json();
        console.log('Body:', JSON.stringify(body));
        
        const events = body.events || [];
        console.log('Events数:', events.length);
        
        for (const event of events) {
            console.log('Event:', JSON.stringify(event));
            
            if (event.type === 'message' && event.message.type === 'text') {
                const userMessage = event.message.text;
                const replyToken = event.replyToken;
                
                console.log('受信メッセージ:', userMessage);
                
                // とりあえず全部エコーバック
                await fetch('https://api.line.me/v2/bot/message/reply', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`
                    },
                    body: JSON.stringify({
                        replyToken: replyToken,
                        messages: [{
                            type: 'text',
                            text: `受信しました：「${userMessage}」`
                        }]
                    })
                });
                
                console.log('返信完了');
            }
        }
        
        return new Response('OK', { status: 200 });
        
    } catch (error) {
        console.error('エラー:', error);
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
