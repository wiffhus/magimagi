// functions/api/generate.js
// Cloudflare Pages Functions for Imagen 3.0 API

/**
 * 画像生成リクエストを処理する Cloudflare Pages Functionsのエントリポイント
 */
export async function onRequestPost({ request, env }) { 
    try {
        // リクエストボディからプロンプトとseedを取得
        const { prompt, seed } = await request.json();
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

        // 正しいImagen 3.0のエンドポイント（Vertex AI形式）
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict`;
        
        // Imagen API の正しいペイロード形式（Vertex AI predict形式）
        const payload = {
            instances: [
                {
                    prompt: prompt
                }
            ],
            parameters: {
                sampleCount: 1,
                seed: seed || Math.floor(Math.random() * 2147483647),
                addWatermark: false
            }
        };

        // Imagen APIを呼び出す
        const geminiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'x-goog-api-key': API_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const responseText = await geminiResponse.text();
        
        // デバッグ用：レスポンスをログ出力
        console.log('Status:', geminiResponse.status);
        console.log('Response:', responseText);
        
        let geminiResult;
        try {
            geminiResult = JSON.parse(responseText);
        } catch (e) {
            return new Response(JSON.stringify({ 
                error: 'APIからの応答が不正なJSON形式です。',
                responseText: responseText.substring(0, 500),
                status: geminiResponse.status
            }), { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!geminiResponse.ok || geminiResult.error) {
            return new Response(JSON.stringify({ 
                error: '画像生成リクエストが失敗しました。',
                geminiError: geminiResult.error || geminiResult,
                status: geminiResponse.status,
                fullResponse: geminiResult
            }), { 
                status: geminiResponse.status,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Imagen API のレスポンスから画像を抽出（Vertex AI predict形式）
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
            fullResponse: geminiResult
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ 
            error: '予期せぬエラーが発生しました。',
            errorMessage: error.message
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
