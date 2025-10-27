// functions/api/generate.js
// Cloudflare Pages Functionsは、Workersランタイムを使用します。

// Imagen 3.0のエンドポイント（修正版）
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict';

/**
 * 画像生成リクエストを処理する Cloudflare Pages Functionsのエントリポイント
 * @param {object} context - Cloudflare Functionsのコンテキスト。request, envなどを含む。
 * @returns {Response} - 生成された画像データを含むJSONレスポンス
 */
export async function onRequestPost({ request, env }) { 
    try {
        // リクエストボディからプロンプトを取得
        const { prompt } = await request.json();

        // Cloudflare環境変数からAPIキーを取得
        const API_KEY = env.GEMINI_API_KEY; 

        // デバッグ情報
        const debugInfo = {
            hasPrompt: !!prompt,
            hasApiKey: !!API_KEY,
            apiKeyLength: API_KEY ? API_KEY.length : 0,
            apiUrl: API_URL
        };

        if (!prompt) {
            return new Response(JSON.stringify({ 
                error: 'プロンプトが必要です。',
                debug: debugInfo
            }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!API_KEY) {
            return new Response(JSON.stringify({ 
                error: 'APIキーが設定されていません。',
                debug: debugInfo
            }), { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Gemini APIへのリクエストペイロード（修正版）
        const payload = {
            instances: [
                {
                    prompt: prompt
                }
            ],
            parameters: {
                sampleCount: 1,
                aspectRatio: "1:1",
                safetyFilterLevel: "block_some",
                personGeneration: "allow_adult"
            }
        };

        // Gemini APIを呼び出す
        const geminiResponse = await fetch(`${API_URL}?key=${API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        // レスポンステキストを取得
        const responseText = await geminiResponse.text();
        let geminiResult;
        
        try {
            geminiResult = JSON.parse(responseText);
        } catch (e) {
            return new Response(JSON.stringify({ 
                error: 'Gemini APIからの応答が不正なJSON形式です。',
                responseStatus: geminiResponse.status,
                responseText: responseText.substring(0, 1000), // 最初の1000文字
                debug: debugInfo
            }), { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!geminiResponse.ok || geminiResult.error) {
            return new Response(JSON.stringify({ 
                error: '画像生成リクエストがGemini API側で失敗しました。',
                geminiStatus: geminiResponse.status,
                geminiError: geminiResult.error,
                fullResponse: geminiResult,
                debug: debugInfo
            }), { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 成功した場合、Base64エンコードされた画像データを抽出
        // predictions形式の場合
        const base64Image = geminiResult.predictions?.[0]?.bytesBase64Encoded || 
                           geminiResult.predictions?.[0]?.image?.bytesBase64Encoded ||
                           geminiResult.generated_images?.[0]?.image?.image_bytes;

        if (base64Image) {
            return new Response(JSON.stringify({ 
                base64Image: base64Image,
                success: true
            }), {
                headers: { 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        return new Response(JSON.stringify({ 
            error: '画像データが取得できませんでした。',
            geminiResult: geminiResult,
            debug: debugInfo
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ 
            error: '予期せぬ内部エラーが発生しました。',
            errorMessage: error.message,
            errorStack: error.stack
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
