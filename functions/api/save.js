// functions/api/save.js
// Cloudflare Pages Functions - Google Apps Script プロキシ（セキュア）

/**
 * Google Driveへの画像保存をセキュアにプロキシする
 * GAS Web App URLを環境変数で管理し、クライアントに露出しない
 */
export async function onRequestPost({ request, env }) { 
    try {
        // 環境変数からGAS URLを取得
        const GAS_WEB_APP_URL = env.GAS_WEB_APP_URL;

        if (!GAS_WEB_APP_URL) {
            return new Response(JSON.stringify({ 
                success: false,
                error: 'GAS Web App URLが設定されていません。'
            }), { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // リクエストボディを取得
        const { prompt, base64Image, timestamp } = await request.json();

        if (!prompt || !base64Image) {
            return new Response(JSON.stringify({ 
                success: false,
                error: 'プロンプトまたは画像データが不足しています。'
            }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // GASにリクエストを転送
        const gasResponse = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: prompt,
                base64Image: base64Image,
                timestamp: timestamp || new Date().toISOString()
            }),
        });

        const gasResult = await gasResponse.json();

        // GASのレスポンスをそのまま返す
        return new Response(JSON.stringify(gasResult), {
            status: gasResponse.ok ? 200 : 500,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        return new Response(JSON.stringify({ 
            success: false,
            error: '保存処理中にエラーが発生しました。',
            errorMessage: error.message
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
