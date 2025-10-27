// functions/api/generate.js
// Cloudflare Pages Functionsは、Workersランタイムを使用します。

// Cloudflare環境変数からAPIキーを取得
// Cloudflare Pagesの設定画面で「GEMINI_API_KEY」として設定してください。
const API_KEY = process.env.GEMINI_API_KEY; 
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:generateImages';

export async function onRequestPost({ request }) {
    try {
        const { prompt } = await request.json();

        if (!prompt) {
            return new Response(JSON.stringify({ error: 'プロンプトが必要です。' }), { status: 400 });
        }

        if (!API_KEY) {
            return new Response(JSON.stringify({ error: 'APIキーが設定されていません。' }), { status: 500 });
        }

        // Gemini APIへのリクエストペイロード
        const payload = {
            prompt: prompt,
            config: {
                // 画像生成の設定 (必要に応じて変更してください)
                number_of_images: 1,
                output_mime_type: "image/jpeg",
                aspect_ratio: "1:1", // 1:1, 4:3, 3:4, 16:9, 9:16など
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
            }), { status: 500 });
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

        return new Response(JSON.stringify({ error: '画像データが取得できませんでした。' }), { status: 500 });

    } catch (error) {
        console.error('サーバーレス関数エラー:', error);
        return new Response(JSON.stringify({ error: '予期せぬ内部エラーが発生しました。' }), { status: 500 });
    }
}
