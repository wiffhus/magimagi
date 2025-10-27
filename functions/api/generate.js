// functions/api/generate.js
// Cloudflare Pages Functionsは、Workersランタイムを使用します。

// 画像生成API（代替形式）
const MODEL_NAME = 'imagen-3.0-generate-001';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

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

        // パターン1: generateContent形式を試す
        const apiUrl = `${API_BASE}/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
        
        const payload = {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                responseModalities: ["image"]
            }
        };

        // Gemini APIを呼び出す
        const geminiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        // レスポンステキストを取得
        const responseText = await geminiResponse.text();
        
        // デバッグ情報を含む応答
        const debugInfo = {
            status: geminiResponse.status,
            statusText: geminiResponse.statusText,
            responsePreview: responseText.substring(0, 1000),
            apiUrl: apiUrl.replace(API_KEY, 'API_KEY_HIDDEN')
        };

        let geminiResult;
        try {
            geminiResult = JSON.parse(responseText);
        } catch (e) {
            return new Response(JSON.stringify({ 
                error: 'Gemini APIからの応答が不正なJSON形式です。',
                debug: debugInfo
            }), { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!geminiResponse.ok || geminiResult.error) {
            return new Response(JSON.stringify({ 
                error: '画像生成リクエストがGemini API側で失敗しました。',
                geminiError: geminiResult.error,
                debug: debugInfo
            }), { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // レスポンスから画像データを抽出（複数パターン対応）
        let base64Image = null;

        // パターン1: candidates形式
        if (geminiResult.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
            base64Image = geminiResult.candidates[0].content.parts[0].inlineData.data;
        }
        // パターン2: predictions形式
        else if (geminiResult.predictions?.[0]) {
            base64Image = geminiResult.predictions[0].bytesBase64Encoded || 
                         geminiResult.predictions[0].image?.bytesBase64Encoded;
        }
        // パターン3: generated_images形式
        else if (geminiResult.generated_images?.[0]) {
            base64Image = geminiResult.generated_images[0].image?.image_bytes;
        }

        if (base64Image) {
            return new Response(JSON.stringify({ 
                base64Image: base64Image,
                success: true
            }), {
                headers: { 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        // 画像が見つからない場合、レスポンス全体を返す
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
            error: '予期せぬ内部エラーが発生しました。',
            errorMessage: error.message,
            errorStack: error.stack
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
