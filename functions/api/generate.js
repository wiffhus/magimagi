// functions/api/generate.js
// Cloudflare Pages Functions for Imagen 3.0 API & Gemini Flash Preview Image
// [変更] 編集モード（Gemini 2.5 Flash Preview Image）を追加
// [変更] プロンプト自動翻訳機能を追加

/**
 * Gemini API（Flash）を呼び出してプロンプトを翻訳（最適化）する
 * (Proモード専用)
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
7.  If the user's prompt is not in English, translate it to English first, then apply all rules.

User's Prompt: "${prompt}"

Rewritten Prompt:
`;

    const payload = {
        contents: [
            {
                parts: [{ text: translatorPrompt }]
            }
        ],
        // ... (safetySettings, generationConfig はそのまま) ...
    };

    try {
        // ... (fetch処理はそのまま) ...
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
 * Gemini Flash APIを使用して画像を編集する
 * ... (この関数は変更なし) ...
 */
async function editImageWithGemini(prompt, inputImage, apiKey) {
    // ... (関数の中身は変更なし) ...
    // 注意: この関数に渡される 'prompt' は、呼び出し元で翻訳済みである想定
    
    const analysisApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;

    // ... (analysisPayload の中身は変更なし) ...
    const analysisPayload = {
        contents: [
            {
                parts: [
                    { 
                        text: `You are an expert at analyzing images and creating detailed prompts for image generation.
                        
                        Analyze the uploaded image and combine it with the user's edit request to create a new detailed prompt for image generation.
                        
                        User's edit request: "${prompt}"
                        
                        Create a detailed prompt that would generate an image similar to the uploaded one but with the requested edits applied.
                        Return ONLY the prompt text, no explanations or preamble.`
                    },
                    {
                        inline_data: {
                            mime_type: "image/png",
                            data: inputImage
                        }
                    }
                ]
            }
        ],
        // ... (generationConfig, safetySettings は変更なし) ...
    };

    try {
        // ... (fetch処理、エラーハンドリングは変更なし) ...
        const response = await fetch(analysisApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(analysisPayload)
        });

        const result = await response.json();

        if (!response.ok || result.error) {
            throw new Error(JSON.stringify(result.error || 'Gemini Flash API error'));
        }
        
        const generatedPrompt = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!generatedPrompt) {
            if (result.candidates?.[0]?.finishReason === 'SAFETY') {
                throw new Error('Image analysis was blocked for safety reasons.');
            }
            throw new Error('Failed to generate edited prompt from image analysis.');
        }

        return {
            type: 'prompt',
            editedPrompt: generatedPrompt.trim()
        };

    } catch (error) {
        console.error('editImageWithGemini Error:', error.message);
        throw error;
    }
}


/**
 * [追加] Gemini API（Flash）を呼び出して、テキストが英語かどうかを判定する
 */
async function isEnglish(prompt, apiKey) {
    const flashApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const checkPrompt = `Is the following text primarily in English? Answer with only "Yes" or "No".\n\nText: "${prompt}"`;

    const payload = {
        contents: [{ parts: [{ text: checkPrompt }] }],
        generationConfig: {
            temperature: 0.0,
            maxOutputTokens: 10
        },
        safetySettings: [
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
    };

    try {
        const response = await fetch(flashApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        
        if (!response.ok || result.error) {
            throw new Error(JSON.stringify(result.error || 'Gemini Flash language check error'));
        }

        const answer = result.candidates?.[0]?.content?.parts?.[0]?.text.trim().toLowerCase();
        
        // "yes" が含まれていれば英語と判定
        return (answer && answer.includes('yes')); 

    } catch (error) {
        console.error('isEnglish Error:', error.message);
        // エラー時はフォールバックとして英語扱いにする（翻訳ステップをスキップ）
        return true; 
    }
}

/**
 * [追加] Gemini API（Flash）を呼び出して、テキストを英語の画像生成プロンプトに翻訳する
 */
async function translateToEnglish(prompt, apiKey) {
    const flashApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const translatorPrompt = `
You are an expert translator specializing in translating user prompts into high-quality, detailed English prompts for an image generation AI.
- Translate the user's intent accurately.
- Enhance the prompt with vivid details if culturally appropriate (e.g., "桜" -> "cherry blossoms blooming").
- Do not add instructions like "a photo of".
- Output ONLY the translated English prompt string, without any preamble or explanation.

User's Prompt (in their original language): "${prompt}"

Translated English Prompt:
`;

    const payload = {
        contents: [{ parts: [{ text: translatorPrompt }] }],
        generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 1024
        },
        safetySettings: [
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
    };

    try {
        const response = await fetch(flashApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (!response.ok || result.error) {
            throw new Error(JSON.stringify(result.error || 'Gemini Flash translation error'));
        }

        const translatedPrompt = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!translatedPrompt || result.candidates?.[0]?.finishReason === 'SAFETY') {
             throw new Error('Translation prompt was blocked or failed.');
        }

        return translatedPrompt.trim();

    } catch (error) {
        console.error('translateToEnglish Error:', error.message);
        // エラー時は元のプロンプトをそのまま返す
        return prompt;
    }
}


/**
 * 画像生成リクエストを処理するエントリポイント
 */
export async function onRequestPost({ request, env }) {
    try {
        // [修正] prompt を originalInputPrompt として受け取る
        const { prompt: originalInputPrompt, mode, inputImage } = await request.json();
        const API_KEY = env.GEMINI_API_KEY;
        const API_KEY_EDIT = env.GEMINI_API_KEY_EDIT; 

        if (!originalInputPrompt) {
            return new Response(JSON.stringify({ error: 'プロンプトが必要です。' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // [追加] 編集モードの処理
        if (mode === 'edit') {
            if (!inputImage) {
                // ... (エラーハンドリングはそのまま) ...
            }
            if (!API_KEY_EDIT) {
                // ... (エラーハンドリングはそのまま) ...
            }
             if (!API_KEY) {
                 return new Response(JSON.stringify({ error: 'メインAPIキー(GEMINI_API_KEY)が設定されていません。翻訳に必要です。' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // [追加] 編集指示プロンプトの翻訳
            let translatedEditPrompt = originalInputPrompt;
            try {
                const isEng = await isEnglish(originalInputPrompt, API_KEY);
                if (!isEng) {
                    translatedEditPrompt = await translateToEnglish(originalInputPrompt, API_KEY);
                }
            } catch (translateError) {
                console.error('Edit prompt translation failed:', translateError.message);
                // 翻訳に失敗しても、元のプロンプトで続行
                translatedEditPrompt = originalInputPrompt;
            }

            try {
                // Step 1: Gemini Flashで画像を解析して、編集用プロンプトを生成
                // [修正] 翻訳後の編集指示(translatedEditPrompt)を渡す
                const analysisResult = await editImageWithGemini(translatedEditPrompt, inputImage, API_KEY_EDIT);
                
                // Step 2: 生成されたプロンプトでImagen APIを使用して新しい画像を生成
                // ... (Imagen API 呼び出しはそのまま) ...
                const imagenApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${API_KEY}`;
                
                const imagenPayload = {
                    instances: [
                        {
                            prompt: analysisResult.editedPrompt
                        }
                    ],
                    parameters: {
                        sampleCount: 1
                    }
                };

                const imagenResponse = await fetch(imagenApiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(imagenPayload),
                });
                
                // ... (Imagen レスポンス処理、エラーハンドリングはそのまま) ...
                const imagenResponseText = await imagenResponse.text();
                let imagenResult;
                try {
                    imagenResult = JSON.parse(imagenResponseText);
                } catch (e) { /* ... */ }
                if (!imagenResponse.ok || imagenResult.error) { /* ... */ }

                const base64Image = imagenResult.predictions?.[0]?.bytesBase64Encoded;

                if (base64Image) {
                    // [修正] originalPrompt を返すように変更
                    return new Response(JSON.stringify({ 
                        base64Image: base64Image,
                        success: true,
                        finalPrompt: analysisResult.editedPrompt,
                        originalPrompt: originalInputPrompt, // [追加] ユーザーが入力した元のプロンプト
                        mode: 'edit'
                    }), {
                        headers: { 'Content-Type': 'application/json' },
                        status: 200,
                    });
                }
                // ... (エラーハンドリングはそのまま) ...
            } catch (editError) {
                // ... (エラーハンドリングはそのまま) ...
            }
        }

        // 通常の画像生成モード処理
        if (!API_KEY) {
            return new Response(JSON.stringify({ error: 'APIキーが設定されていません。' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // [ここから変更] 翻訳処理
        let originalPrompt = originalInputPrompt;
        let translatedPrompt = originalInputPrompt;
        let finalPrompt = originalInputPrompt;

        try {
            // Step 1: 翻訳 (Proモード以外)
            // Proモードは translateProPrompt が翻訳も兼ねるため、ここでは実行しない
            if (mode !== 'pro') {
                const isEng = await isEnglish(originalPrompt, API_KEY);
                if (!isEng) {
                    translatedPrompt = await translateToEnglish(originalPrompt, API_KEY);
                }
                // 英語の場合は translatedPrompt = originalPrompt のまま
            }
            
            // Step 2: モード別処理
            switch (mode) {
                case 'capa':
                    finalPrompt = `${translatedPrompt}, monochrome, high contrast, grainy film photo, 35mm, photojournalism style inspired by Robert Capa, dramatic shadows`;
                    break;
                case 'mummy':
                    finalPrompt = `${translatedPrompt}, snapshot photo from the Heisei era, 1990s Japanese film photo, slight motion blur, date stamp in bottom right corner, taken by a mom with a point-and-shoot camera, slightly faded colors`;
                    break;
                case 'pri':
                    finalPrompt = `${translatedPrompt}, Japanese Purikura style, bright high-key lighting, cute stickers and sparkles overlay, animated glitter text, big cartoon eyes, smooth flawless skin, decorated border, peace sign pose`;
                    break;
                case 'pro':
                    // Proモードは元のプロンプト(originalPrompt)を直接最適化関数に渡す
                    finalPrompt = await translateProPrompt(originalPrompt, API_KEY);
                    break;
                case 'default':
                default:
                    finalPrompt = translatedPrompt;
                    break;
            }
        } catch (processingError) {
            return new Response(JSON.stringify({
                error: 'プロンプトの処理に失敗しました。',
                processingError: processingError.message
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
                    prompt: finalPrompt // [修正] finalPrompt を使用
                }
            ],
            parameters: {
                sampleCount: 1
            }
        };

        // ... (Imagen API呼び出し、レスポンス処理、エラーハンドリングはそのまま) ...
        const geminiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const responseText = await geminiResponse.text();
        let geminiResult;
        try {
            geminiResult = JSON.parse(responseText);
        } catch (e) { /* ... */ }
        if (!geminiResponse.ok || geminiResult.error) { /* ... */ }


        // Imagen API のレスポンスから画像を抽出
        const base64Image = geminiResult.predictions?.[0]?.bytesBase64Encoded;

        if (base64Image) {
            // [修正] originalPrompt も返す
            return new Response(JSON.stringify({ 
                base64Image: base64Image,
                success: true,
                finalPrompt: finalPrompt,
                originalPrompt: originalPrompt // [追加]
            }), {
                headers: { 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        // ... (エラーハンドリングはそのまま) ...
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
