// functions/api/generate.js
// [修正] 'Personal' モードを 'persona' (単一) から 'personalPrefix' と 'personalSuffix' (テンプレート式) に変更

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
        safetySettings: [
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ],
        generationConfig: {
            temperature: 1.0,
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
}

/**
 * Gemini Flash APIを使用して画像を編集する
 */
async function editImageWithGemini(prompt, inputImage, apiKey) {
    // 注意: この関数に渡される 'prompt' は、呼び出し元で翻訳済みである想定
    
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
            temperature: 1.0,
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
        
        return (answer && answer.includes('yes')); 

    } catch (error) {
        console.error('isEnglish Error:', error.message);
        // エラー時はフォールバックとして英語扱いにする（翻訳ステップをスキップ）
        return true; 
    }
}

/**
 * Gemini API（Flash）を呼び出して、テキストを英語の画像生成プロンプトに翻訳する
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
            temperature: 1.0,
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
 * APIキーローテーション用のヘルパー関数
 */
function getApiKeyByIndex(index, env) {
    // ローテーション対象のキー名を順番に定義
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
    
    // インデックスが範囲内か確認 (0〜10)
    const safeIndex = index >= 0 && index < keyNames.length ? index : 0;
    const keyName = keyNames[safeIndex];
    
    const apiKey = env[keyName];

    if (!apiKey) {
         // 環境変数にキーが設定されていなかった場合、警告を出しデフォルトキーを試す
         console.error(`API Key ${keyName} (Index ${safeIndex}) is missing in environment variables. Falling back to default GEMINI_API_KEY.`);
         return env['GEMINI_API_KEY'];
    }
    
    return apiKey;
}


/**
 * 画像生成リクエストを処理するエントリポイント
 */
export async function onRequestPost({ request, env }) {
    try {
        // ▼▼▼ [修正] ▼▼▼
        const { 
            prompt,
            originalPrompt: originalPromptFromClient,
            mode, 
            inputImage, 
            action,
            personalPrefix, // [修正]
            personalSuffix  // [修正]
        } = await request.json();
        // ▲▲▲ [修正ここまで] ▲▲▲
        
        
        // API_KEY を let で宣言し、アクションに応じて設定する
        let API_KEY; 
        const API_KEY_EDIT = env.GEMINI_API_KEY_EDIT; 

        if (action === 'generate') {
            // --- 画像生成時のみAPIキーローテーションを実行 ---
            
            const KV_NAMESPACE = env.KEY_STORE; 
            const KV_KEY_NAME = 'CURRENT_API_INDEX';
            const TOTAL_KEYS = 11;

            if (!KV_NAMESPACE) {
                console.warn('KV Namespace (KEY_STORE) is not bound. Falling back to GEMINI_API_KEY.');
                API_KEY = env.GEMINI_API_KEY; 
            } else {
                try {
                    // 1. KVから現在のインデックスを取得
                    const currentIndexStr = await KV_NAMESPACE.get(KV_KEY_NAME);
                    const currentIndex = parseInt(currentIndexStr, 10) || 0;

                    // 2. 今回使用するAPIキーをヘルパー関数から取得
                    API_KEY = getApiKeyByIndex(currentIndex, env);
                    
                    // 3. 次のインデックスを計算し、KVに保存
                    const nextIndex = (currentIndex + 1) % TOTAL_KEYS;
                    await KV_NAMESPACE.put(KV_KEY_NAME, nextIndex.toString());

                } catch (kvError) {
                    console.error('KV Error during API key rotation:', kvError.message);
                    API_KEY = env.GEMINI_API_KEY; // KVエラー時はフォールバック
                }
            }
            // --- [ここまで] APIキーローテーション処理 ---

        } else {
            // 'translate' アクション (または他のアクション) の場合
            API_KEY = env.GEMINI_API_KEY;
        }


        if (!prompt) {
            return new Response(JSON.stringify({ error: 'プロンプトが必要です。' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // --- [追加] 翻訳アクション (Translateボタン) ---
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

                // Step 1: 翻訳 (ProとEditモード以外)
                if (mode !== 'pro' && mode !== 'edit') {
                    const isEng = await isEnglish(originalPromptForTranslate, API_KEY);
                    if (!isEng) {
                        translatedPrompt = await translateToEnglish(originalPromptForTranslate, API_KEY);
                    }
                }
                
                // Step 2: モード別処理
                switch (mode) {
                    case 'edit':
                        let translatedEditPrompt = originalPromptForTranslate;
                        const isEng = await isEnglish(originalPromptForTranslate, API_KEY);
                        if (!isEng) {
                            translatedEditPrompt = await translateToEnglish(originalPromptForTranslate, API_KEY);
                        }
                        finalPrompt = translatedEditPrompt;
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
                    
                    // ▼▼▼ [修正] ▼▼▼
                    case 'personal':
                        let prefix = (personalPrefix && personalPrefix.trim() !== '') ? personalPrefix.trim() : '';
                        let suffix = (personalSuffix && personalSuffix.trim() !== '') ? personalSuffix.trim() : '';
                        
                        // 翻訳済みプロンプトを開始点にする
                        finalPrompt = translatedPrompt;
                        
                        // Prefixを追加 (存在する場合)
                        if (prefix) {
                            finalPrompt = `${prefix}, ${finalPrompt}`;
                        }
                        // Suffixを追加 (存在する場合)
                        if (suffix) {
                            finalPrompt = `${finalPrompt}, ${suffix}`;
                        }
                        break;
                    // ▲▲▲ [修正ここまで] ▲▲▲

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

        // --- [修正] 生成アクション (Generateボタン) ---
        
        let finalPrompt = prompt; // 'prompt' には既に翻訳/処理済みのプロンプトが入っている想定
        
        // ▼▼▼ [修正] ▼▼▼
        // Generate直押し（Translateスキップ）の場合の Prefix/Suffix 適用
        if (mode === 'personal') {
            let prefix = (personalPrefix && personalPrefix.trim() !== '') ? personalPrefix.trim() : '';
            let suffix = (personalSuffix && personalSuffix.trim() !== '') ? personalSuffix.trim() : '';

            // 'Translate' ボタンが押された場合、'prompt' には既に Prefix/Suffix が含まれている可能性がある
            // そのため、'prompt' が Prefix で始まっていないか、Suffix で終わっていないかをチェックする
            
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
        // ▲▲▲ [修正ここまで] ▲▲▲
        
        const originalPrompt = originalPromptFromClient || finalPrompt; // 翻訳元のプロンプト

        // [修正] 編集モードの処理
        if (mode === 'edit') {
            if (!inputImage) {
                 return new Response(JSON.stringify({ error: '編集モードには画像が必要です。' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            if (!API_KEY_EDIT) {
                 return new Response(JSON.stringify({ error: '編集用APIキー(GEMINI_API_KEY_EDIT)が設定されていません。' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
             if (!API_KEY) {
                 return new Response(JSON.stringify({ error: 'メインAPIキー(GEMINI_API_KEY)が設定されていません。' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            try {
                // 1. Gemini Flashでプロンプトを分析・編集
                const analysisResult = await editImageWithGemini(finalPrompt, inputImage, API_KEY_EDIT);
                
                // 2. Imagen 3.0で画像を生成（ローテーションされたAPI_KEYを使用）
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
                        finalPrompt: analysisResult.editedPrompt,
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

        // [修正] 編集モードでない場合 (通常の画像生成)
        if (mode !== 'edit') {
            if (!API_KEY) {
                return new Response(JSON.stringify({ error: 'APIキーが設定されていません。' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            
            // ローテーションされた API_KEY を使用
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${API_KEY}`;
            
            const payload = {
                instances: [
                    {
                        prompt: finalPrompt 
                    }
                ],
                parameters: {
                    sampleCount: 1
                }
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
