// functions/api/generate.js

/**
 * Gemini API（Flash）を呼び出してプロンプトを翻訳（最適化）する
 * (Proモード専用)
 */
async function translateProPrompt(prompt, apiKey) {
    const flashApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    // (中身は変更なし ... 省略)
    const translatorPrompt = `
You are an expert AI prompt engineer specializing in advanced image generation.
Your task is to rewrite the user's prompt based on the following rules to achieve a specific artistic, suggestive, and sensual style, while strictly avoiding explicit or policy-violating terms.
(中略)
Rewritten Prompt:
`;
    const payload = {
        contents: [
            {
                parts: [{ text: translatorPrompt }]
            }
        ],
        safetySettings: [
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ],
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048
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
    // ( ... 関数の残りは省略 ... )
}

/**
 * [注意] この関数 (editImageWithGemini) は、
 * 'mode: edit' がインペインティングに置き換えられたため、
 * 現在のコードパスでは呼び出されなくなりました。
 * (ただし、'pro'モード翻訳などの他の関数が内部で依存している場合に備えて残しています)
 */
async function editImageWithGemini(prompt, inputImage, apiKey) {
    // ... (関数の中身は変更なし) ...
    
     const analysisApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;

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
        generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 2048
        },
        safetySettings: [
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
    };

    try {
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
 * Gemini API（Flash）を呼び出して、テキストが英語かどうかを判定する
 */
async function isEnglish(prompt, apiKey) {
    // ... (関数の中身は変更なし) ...
    const flashApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    // ( ... 中身は変更なし ... )
}

/**
 * Gemini API（Flash）を呼び出して、テキストを英語の画像生成プロンプトに翻訳する
 */
async function translateToEnglish(prompt, apiKey) {
    // ... (関数の中身は変更なし) ...
    const flashApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    // ( ... 中身は変更なし ... )
}


/**
 * APIキーローテーション用のヘルパー関数
 */
function getApiKeyByIndex(index, env) {
    // ... (関数の中身は変更なし) ...
    const keyNames = [
        'GEMINI_API_KEY',     // Index 0
        'GEMINI_API_KEY_01',  // Index 1
        'GEMINI_API_KEY_02',  // Index 2
        'GEMINI_API_KEY_03',  // Index 3
        'GEMINI_API_KEY_04',  // Index 4
        'GEMINI_API_KEY_05',  // Index 5
        'GEMINI_API_KEY_06',  // Index 6
        'GEMINI_API_KEY_07',  // Index 7
        'GEMINI_API_KEY_08',  // Index 8
        'GEMINI_API_KEY_09',  // Index 9
        'GEMINI_API_KEY_10'   // Index 10 (合計 11 keys)
    ];
    // ( ... 中身は変更なし ... )
}


/**
 * 画像生成リクエストを処理するエントリポイント
 */
export async function onRequestPost({ request, env }) {
    try {
        // ▼▼▼ [修正] seed, aspectRatio, styles を受け取る ▼▼▼
        const { 
            prompt,
            originalPrompt: originalPromptFromClient,
            mode, 
            inputImage, 
            maskImage,
            action,
            personalPrefix,
            personalSuffix,
            seed,
            aspectRatio,
            styles // (Array of strings from client)
        } = await request.json();
        // ▲▲▲ [修正ここまで] ▲▲▲
        
        
        // API_KEY を let で宣言し、アクションに応じて設定する
        let API_KEY; 

        if (action === 'generate') {
            // --- 画像生成時のみAPIキーローテーションを実行 ---
            const KV_NAMESPACE = env.KEY_STORE; 
            const KV_KEY_NAME = 'CURRENT_API_INDEX';
            const TOTAL_KEYS = 11;
            // ( ... ローテーションロジックは変更なし ...)
            if (!KV_NAMESPACE) {
                console.warn('KV Namespace (KEY_STORE) is not bound. Falling back to GEMINI_API_KEY.');
                API_KEY = env.GEMINI_API_KEY; 
            } else {
                try {
                    const currentIndexStr = await KV_NAMESPACE.get(KV_KEY_NAME);
                    const currentIndex = parseInt(currentIndexStr, 10) || 0;
                    API_KEY = getApiKeyByIndex(currentIndex, env);
                    const nextIndex = (currentIndex + 1) % TOTAL_KEYS;
                    await KV_NAMESPACE.put(KV_KEY_NAME, nextIndex.toString());
                } catch (kvError) {
                    console.error('KV Error during API key rotation:', kvError.message);
                    API_KEY = env.GEMINI_API_KEY; // KVエラー時はフォールバック
                }
            }
        } else {
            // 'translate' アクション
            API_KEY = env.GEMINI_API_KEY;
        }


        if (!prompt) {
            return new Response(JSON.stringify({ error: 'プロンプトが必要です。' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // --- 翻訳アクション (Translateボタン) ---
        if (action === 'translate') {
            if (!API_KEY) {
                 return new Response(JSON.stringify({ error: 'メインAPIキー(GEMINI_API_KEY)が設定されていません。翻訳に必要です。' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            try {
                let originalPromptForTranslate = prompt;
                let translatedPrompt = prompt;
                let finalPrompt = prompt;

                // Step 1: 翻訳 (Proモード以外)
                // [修正] 'pro-detail' モードでも翻訳が必要
                if (mode !== 'pro') {
                    const isEng = await isEnglish(originalPromptForTranslate, API_KEY);
                    if (!isEng) {
                        translatedPrompt = await translateToEnglish(originalPromptForTranslate, API_KEY);
                    }
                }
                
                // Step 2: モード別処理
                switch (mode) {
                    case 'edit':
                        finalPrompt = translatedPrompt;
                        break;
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
                        finalPrompt = await translateProPrompt(originalPromptForTranslate, API_KEY);
                        break;
                    
                    // ▼▼▼ [追加] PRO-DETAIL の翻訳処理 ▼▼▼
                    case 'pro-detail':
                        finalPrompt = translatedPrompt; // まず翻訳
                        
                        // スタイルを結合 (もしあれば)
                        if (styles && styles.length > 0) {
                            finalPrompt = `${finalPrompt}, ${styles.join(', ')}`;
                        }
                        break;
                    // ▲▲▲ [追加ここまで] ▲▲▲

                    case 'personal':
                        let prefix = (personalPrefix && personalPrefix.trim() !== '') ? personalPrefix.trim() : '';
                        let suffix = (personalSuffix && personalSuffix.trim() !== '') ? personalSuffix.trim() : '';
                        
                        finalPrompt = translatedPrompt;
                        
                        if (prefix) {
                            finalPrompt = `${prefix}, ${finalPrompt}`;
                        }
                        if (suffix) {
                            finalPrompt = `${finalPrompt}, ${suffix}`;
                        }
                        break;

                    case 'default':
                    default:
                        finalPrompt = translatedPrompt;
                        break;
                }
                
                return new Response(JSON.stringify({ 
                    success: true, 
                    translatedPrompt: finalPrompt 
                }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200,
                });

            } catch (processingError) {
                return new Response(JSON.stringify({
                    error: 'プロンプトの翻訳・処理に失敗しました。',
                    processingError: processingError.message
                }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        // --- 生成アクション (Generateボタン) ---
        
        let finalPrompt = prompt;
        
        // Generate直押し（Translateスキップ）の場合の Prefix/Suffix 適用
        if (mode === 'personal') {
            // ( ... personalモードの処理は変更なし ... )
            let prefix = (personalPrefix && personalPrefix.trim() !== '') ? personalPrefix.trim() : '';
            let suffix = (personalSuffix && personalSuffix.trim() !== '') ? personalSuffix.trim() : '';
            const trimmedFinalPrompt = finalPrompt.trim();
            const trimmedPrefix = prefix;
            const trimmedSuffix = suffix;
            const lowerFinalPrompt = trimmedFinalPrompt.toLowerCase();
            let needsPrefix = (prefix && !lowerFinalPrompt.startsWith(trimmedPrefix.toLowerCase()));
            let needsSuffix = (suffix && !lowerFinalPrompt.endsWith(trimmedSuffix.toLowerCase()));
            let tempPrompt = trimmedFinalPrompt;
            if (needsPrefix) {
                tempPrompt = `${trimmedPrefix}, ${tempPrompt}`;
            }
            if (needsSuffix) {
                tempPrompt = `${tempPrompt}, ${trimmedSuffix}`;
            }
            finalPrompt = tempPrompt;
        }

        // ▼▼▼ [追加] Generate直押し（Translateスキップ）の場合の Style 適用 ▼▼▼
        if (mode === 'pro-detail' && styles && styles.length > 0) {
            const stylesString = styles.join(', ');
            // 既に翻訳済みでスタイルが含まれているかチェック (簡易)
            if (!finalPrompt.toLowerCase().includes(stylesString.toLowerCase())) {
                finalPrompt = `${finalPrompt}, ${stylesString}`;
            }
        }
        // ▲▲▲ [追加ここまで] ▲▲▲
        
        const originalPrompt = originalPromptFromClient || finalPrompt;

        // [修正] 編集モード (インペインティング) の処理
        // (PRO-DETAILの2回目以降も 'edit' として扱われる)
        if (mode === 'edit') {
            
            if (!inputImage) {
                 return new Response(JSON.stringify({ error: '編集モードには元画像が必要です。' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            if (!maskImage) {
                 return new Response(JSON.stringify({ error: '編集モードにはマスク画像が必要です。' }), {
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

            try {
                const inpaintApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-capability-001:predict?key=${API_KEY}`;
                
                const inpaintPayload = {
                    instances: [
                        {
                            prompt: finalPrompt,
                            image: {
                                bytesBase64Encoded: inputImage
                            },
                            mask: {
                                bytesBase64Encoded: maskImage
                            }
                        }
                    ],
                    // ▼▼▼ [修正] seed と aspectRatio を追加 ▼▼▼
                    parameters: {
                        sampleCount: 1,
                        temperature: 1.0,
                        ...(seed && { seed: seed }), // SEED
                        ...(aspectRatio && { aspectRatio: aspectRatio }) // アスペクト比
                    }
                    // ▲▲▲ [修正ここまで] ▲▲▲
                };

                const imagenResponse = await fetch(inpaintApiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(inpaintPayload),
                });
                
                const imagenResponseText = await imagenResponse.text();
                let imagenResult;
                
                try {
                    imagenResult = JSON.parse(imagenResponseText);
                } catch (e) {
                    throw new Error(`Failed to parse Imagen response: ${imagenResponseText}`);
                }
                if (!imagenResponse.ok || imagenResult.error) {
                    throw new Error(JSON.stringify(imagenResult.error || 'Imagen API error'));
                }

                const base64Image = imagenResult.predictions?.[0]?.bytesBase64Encoded;

                if (base64Image) {
                    return new Response(JSON.stringify({ 
                        base64Image: base64Image,
                        success: true,
                        finalPrompt: finalPrompt,
                        originalPrompt: originalPrompt,
                        mode: 'edit'
                    }), {
                        headers: { 'Content-Type': 'application/json' },
                        status: 200,
                    });
                }
                 throw new Error('編集画像の生成に失敗しました。');

            } catch (editError) {
                 return new Response(JSON.stringify({
                    error: '画像編集処理中にエラーが発生しました。',
                    editError: editError.message
                }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }


        // [修正] 通常の画像生成 (PRO-DETAILの1回目も含む)
        if (mode !== 'edit') {
            if (!API_KEY) {
                return new Response(JSON.stringify({ error: 'APIキーが設定されていません。' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${API_KEY}`;
            
            const payload = {
                instances: [
                    {
                        prompt: finalPrompt 
                    }
                ],
                // ▼▼▼ [修正] seed と aspectRatio を追加 ▼▼▼
                parameters: {
                    sampleCount: 1,
                    temperature: 1.8,
                    ...(seed && { seed: seed }), // SEED
                    ...(aspectRatio && { aspectRatio: aspectRatio }) // アスペクト比
                }
                // ▲▲▲ [修正ここまで] ▲▲▲
            };

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
                throw new Error(`Failed to parse Imagen response: ${responseText}`);
            }
            if (!geminiResponse.ok || geminiResult.error) {
                 throw new Error(JSON.stringify(geminiResult.error || 'Imagen API error'));
            }

            const base64Image = geminiResult.predictions?.[0]?.bytesBase64Encoded;

            if (base64Image) {
                return new Response(JSON.stringify({ 
                    base64Image: base64Image,
                    success: true,
                    finalPrompt: finalPrompt,
                    originalPrompt: originalPrompt 
                }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200,
                });
            }

            return new Response(JSON.stringify({ 
                error: '画像データが取得できませんでした。',
                fullResponse: geminiResult
            }), { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

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
