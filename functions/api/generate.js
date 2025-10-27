// functions/api/generate.js
// Cloudflare Pages Functionsは、Workersランタイムを使用します。

const API_URL = 'const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate:generateImages';

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
        // ここが修正されたポイントです。envオブジェクトを使用します。
        const API_KEY = env.GEMINI_API_KEY; 

        if (!prompt) {
            return new Response(JSON.stringify({ error: 'プロンプトが必要です。' }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!API_KEY) {
            return new Response(JSON.stringify({ error: 'APIキーが設定されていません。' }), { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Gemini APIへのリクエストペイロード
        const payload = {
            prompt: prompt,
            config: {
                // 画像生成の設定 (必要に応じて変更してください)
                number_of_images: 1,
                output_mime_type: "image/jpeg",
                aspect_ratio: "1:1",
            },
        };

        // Gemini APIを呼び出す
        const geminiResponse = await fetch(`${API_URL}?key=${API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const geminiResult = await geminiResponse.json();

        if (!geminiResponse.ok || geminiResult.error) {
            console.error('Gemini APIエラー:', geminiResult.error);
            return new Response(JSON.stringify({ 
                error: '画像生成リクエストがGemini API側で失敗しました。', 
                details: geminiResult.error?.message 
            }), { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 成功した場合、Base64エンコードされた画像データを抽出
        const base64Image = geminiResult.generated_images[0]?.image?.image_bytes;

        if (base64Image) {
            // クライアントにBase64画像を返す
            return new Response(JSON.stringify({ base64Image: base64Image }), {
                headers: { 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        return new Response(JSON.stringify({ error: '画像データが取得できませんでした。' }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('サーバーレス関数エラー:', error);
        return new Response(JSON.stringify({ error: '予期せぬ内部エラーが発生しました。' }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
