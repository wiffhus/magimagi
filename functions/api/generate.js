// functions/api/generate.js

const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:generateImages';

// onRequestPost の引数を { request, env } に修正し、
// APIキーを env.GEMINI_API_KEY から取得します。
export async function onRequestPost({ request, env }) { // 修正ポイント: envを追加
    try {
        const { prompt } = await request.json();

        if (!prompt) {
            return new Response(JSON.stringify({ error: 'プロンプトが必要です。' }), { status: 400 });
        }

        // 修正ポイント: envオブジェクトから環境変数を取得
        const API_KEY = env.GEMINI_API_KEY; 

        if (!API_KEY) {
            return new Response(JSON.stringify({ error: 'APIキーが設定されていません。' }), { status: 500 });
        }

        // (中略) ペイロードとAPI呼び出しのロジックは変更なし

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

        // (中略) 応答処理のロジックは変更なし

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
