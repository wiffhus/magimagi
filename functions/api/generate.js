// functions/api/generate.js
// Cloudflare Pages Functions for Imagen 3.0 API & Gemini Flash Preview Image
// [変更] 編集モード（Gemini 2.5 Flash Preview Image）を追加

/**
 * Gemini API（Flash）を呼び出してプロンプトを翻訳（最適化）する
 */
async function translateProPrompt(prompt, apiKey) {
    const flashApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    // 論文に基づいた「翻訳AI」への指示
    const translatorPrompt = `
You are an expert AI prompt engineer specializing in advanced image generation.
Your task is to rewrite the user's prompt based on the following rules to achieve a specific artistic, suggestive, and sensual style, while strictly avoiding explicit or policy-violating terms.

Rules:
1.  DO NOT use direct sexual, nude, or explicit keywords (e.g., "nude", "pornographic", "cleavage", "nipples", "ass").
2.  DO use metaphorical and abstract language. Use concepts from nature, geology, or art (e.g., "organic shapes", "flowing lines", "layers of sedimentary rock", "narrow gorge", "liquid mercury").
3.  DO use advanced lighting and shadow techniques. Specify dramatic mood (e.g., "chiaroscuro", "rim lighting", "volumetric light", "soft shadows", "golden hour").
4.  DO use professional photography and composition terms (e.g., "shallow depth of field", "bokeh", "extreme close-up", "cinematic macro shot").
5.  DO use texture and material descriptions (e.g., "glistening", "soft silk drapery", "polished marble", "calm water reflection").
6.  The output MUST be only the rewritten prompt string, without any preamble or explanation.

User's Prompt: "${prompt}"

Rewritten Prompt:
`;

    const payload = {
        contents: [
            {
                parts: [{ text: translatorPrompt }]
            }
        ],
        // 安全設定を低くして、翻訳AI自体が指示を拒否しにくくする（実験的）
        safetySettings: [
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
        ],
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024
        }
    };

    try {
        const response = await fetch(flashApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok || result.error) {
            throw new Error(JSON.stringify(result.error || 'Gemini Flash API error'));
        }

        const translatedPrompt = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!translatedPrompt) {
            // プロンプト自体がGemini Flashのフィルターにブロックされた場合
            if (result.candidates?.[0]?.finishReason === 'SAFETY') {
                throw new Error('Pro-mode optimization prompt was blocked for safety reasons.');
            }
            throw new Error('Failed to get translated prompt from Gemini Flash.');
        }

        return translatedPrompt.trim();

    } catch (error) {
        console.error('translateProPrompt Error:', error.message);
        throw error;
    }
}

/**
 * Gemini Flash Preview Image APIを使用して画像を編集する
 * @param {string} prompt - 編集指示のプロンプト
 * @param {string} inputImage - Base64エンコードされた入力画像
 * @param {string} apiKey - Gemini API Key for Edit
 */
async function editImageWithGemini(prompt, inputImage, apiKey) {
    const editApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-image:generateContent?key=${apiKey}`;

    const payload = {
        contents: [
            {
                parts: [
                    { text: prompt },
                    {
                        inline_data: {
                            mime_type: "image/png",
                            data: inputImage
                        }
                    }
                ]
            }
        ],
        generationConfig: {
            response_mime_type: "image/png",
            temperature: 0.7
        },
        safetySettings: [
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
        ]
    };

    try {
        const response = await fetch(editApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok || result.error) {
            throw new Error(JSON.stringify(result.error || 'Gemini Flash Image API error'));
        }

        // Gemini Flashの画像レスポンスを取得
        const editedImage = result.candidates?.[0]?.content?.parts?.[0]?.inline_data?.data;

        if (!editedImage) {
            if (result.candidates?.[0]?.finishReason === 'SAFETY') {
                throw new Error('Image editing request was blocked for safety reasons.');
            }
            throw new Error('Failed to get edited image from Gemini Flash.');
        }

        return editedImage;

    } catch (error) {
        console.error('editImageWithGemini Error:', error.message);
        throw error;
    }
}

/**
 * 画像生成リクエストを処理するエントリポイント
 */
export async function onRequestPost({ request, env }) {
    try {
        // [変更] prompt, mode, inputImage を受け取る
        const { prompt, mode, inputImage } = await request.json();
        const API_KEY = env.GEMINI_API_KEY;
        const API_KEY_EDIT = env.GEMINI_API_KEY_EDIT; // [追加] 編集用APIキー

        if (!prompt) {
            return new Response(JSON.stringify({ error: 'プロンプトが必要です。' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // [追加] 編集モードの処理
        if (mode === 'edit') {
            if (!inputImage) {
                return new Response(JSON.stringify({ error: '編集モードでは入力画像が必要です。' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            if (!API_KEY_EDIT) {
                return new Response(JSON.stringify({ error: '編集用APIキーが設定されていません。' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            try {
                // Gemini Flash Preview Imageで画像編集
                const editedImageBase64 = await editImageWithGemini(prompt, inputImage, API_KEY_EDIT);
                
                return new Response(JSON.stringify({ 
                    base64Image: editedImageBase64,
                    success: true,
                    finalPrompt: prompt,
                    mode: 'edit'
                }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200,
                });
            } catch (editError) {
                return new Response(JSON.stringify({
                    error: '画像編集に失敗しました。',
                    editError: editError.message
                }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        // 通常の画像生成モード処理（既存のコード）
        if (!API_KEY) {
            return new Response(JSON.stringify({ error: 'APIキーが設定されていません。' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        let finalPrompt = prompt;

        // [ここから変更] モードに応じたプロンプト処理
        try {
            switch (mode) {
                case 'capa':
                    finalPrompt = `${prompt}, monochrome, high contrast, grainy film photo, 35mm, photojournalism style inspired by Robert Capa, dramatic shadows`;
                    break;
                case 'mummy':
                    // 日付スタンプはAIが苦手な場合があるので、雰囲気を重視
                    finalPrompt = `${prompt}, snapshot photo from the Heisei era, 1990s Japanese film photo, slight motion blur, date stamp in bottom right corner, taken by a mom with a point-and-shoot camera, slightly faded colors`;
                    break;
                case 'pri':
                    finalPrompt = `${prompt}, Japanese Purikura style, bright high-key lighting, cute stickers and sparkles overlay, animated glitter text, big cartoon eyes, smooth flawless skin, decorated border, peace sign pose`;
                    break;
                case 'pro':
                    // Gemini Flashを呼び出してプロンプトを翻訳
                    finalPrompt = await translateProPrompt(prompt, API_KEY);
                    break;
                case 'default':
                default:
                    finalPrompt = prompt;
                    break;
            }
        } catch (proError) {
            // Proモードの翻訳が失敗した場合
            return new Response(JSON.stringify({
                error: 'Proモードのプロンプト最適化に失敗しました。',
                proTranslateError: proError.message
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        // [ここまで変更]

        
        // 正しいImagen 3.0のエンドポイント
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${API_KEY}`;
        
        // Imagen API の正しいペイロード形式
        const payload = {
            instances: [
                {
                    // [変更] 元の prompt の代わりに finalPrompt を使用
                    prompt: finalPrompt 
                }
            ],
            parameters: {
                sampleCount: 1
            }
        };

        // Imagen APIを呼び出す
        const geminiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const responseText = await geminiResponse.text();
        
        let geminiResult;
        try {
            geminiResult = JSON.parse(responseText);
        } catch (e) {
            return new Response(JSON.stringify({ 
                error: 'APIからの応答が不正なJSON形式です。',
                responseText: responseText.substring(0, 500)
            }), { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!geminiResponse.ok || geminiResult.error) {
            return new Response(JSON.stringify({ 
                error: '画像生成リクエストが失敗しました。',
                geminiError: geminiResult.error
            }), { 
                status: geminiResponse.status,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Imagen API のレスポンスから画像を抽出
        const base64Image = geminiResult.predictions?.[0]?.bytesBase64Encoded;

        if (base64Image) {
            return new Response(JSON.stringify({ 
                base64Image: base64Image,
                success: true,
                finalPrompt: finalPrompt // [変更] 履歴保存用に、最終的に使ったプロンプトを返す
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
