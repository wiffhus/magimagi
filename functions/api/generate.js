// functions/api/generate.js
// Cloudflare Pages Functions for Imagen API

/**
 * 画像生成リクエストを処理する Cloudflare Pages Functionsのエントリポイント
 */
export async function onRequestPost({ request, env }) { 
    try {
        // リクエストボディからプロンプトを取得
        const { prompt } = await request.json();
        const API_KEY = env.GEMINI_API_KEY; 

        if (!prompt) {
            return new Response(JSON.stringify({ 
                error: 'プロンプトが必要です。'
            }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!API_KEY) {
            return new Response(JSON.stringify({ 
                error: 'APIキーが設定されていません。'
            }), { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Imagen API の正しいエンドポイント
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate:predict?key=${API_KEY}`;
        
        // Imagen API の正しいペイロード形式
        const payload = {
            instances: [
                {
                    prompt: prompt
                }
            ],
            parameters: {
                sampleCount: 1
            }
        };

        console.log('Requesting Imagen API...');

        // Imagen APIを呼び出す
        const geminiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const responseText = await geminiResponse.text();
        
        // デバッグ情報
        const debugInfo = {
            status: geminiResponse.status,
            statusText: geminiResponse.statusText,
            responsePreview: responseText.substring(0, 1000)
        };

        let geminiResult;
        try {
            geminiResult = JSON.parse(responseText);
        } catch (e) {
            return new Response(JSON.stringify({ 
                error: 'APIからの応答が不正なJSON形式です。',
                debug: debugInfo
            }), { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!geminiResponse.ok || geminiResult.error) {
            return new Response(JSON.stringify({ 
                error: '画像生成リクエストが失敗しました。',
                geminiError: geminiResult.error,
                debug: debugInfo
            }), { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Imagen API のレスポンスから画像を抽出
        // predictions[0].bytesBase64Encoded 形式
        const base64Image = geminiResult.predictions?.[0]?.bytesBase64Encoded;

        if (base64Image) {
            return new Response(JSON.stringify({ 
                base64Image: base64Image,
                success: true
            }), {
                headers: { 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        // 画像が見つからない場合
        return new Response(JSON.stringify({ 
            error: '画像データが取得できませんでした。',
            fullResponse: geminiResult,
            debug: debugInfo
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ 
            error: '予期せぬエラーが発生しました。',
            errorMessage: error.message,
            errorStack: error.stack
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
