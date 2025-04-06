// background.js

console.log("[BetterPrompt BG] Service worker started.");

// 预设的系统提示词
const SYSTEM_PROMPTS = {
    default: "请将以下用户输入改写为一个优化后的 Prompt，使其更清晰、具体，并包含足够的上下文信息，以便 AI 模型能够更好地理解和执行任务。请专注于提高 Prompt 的质量和效果，直接返回优化后的 Prompt 文本，不要包含任何解释性文字或前缀。",
    concise: "请将以下用户输入浓缩为一个极其简洁但清晰的 AI Prompt。保留核心意图和关键信息，去除冗余。目标是最大限度地缩短长度，同时确保 AI 能够理解。直接返回优化后的 Prompt 文本，不要包含任何解释。",
    detailed: "请将以下用户输入扩展并重构成一个高质量、详细的 AI Prompt。仔细分析用户意图，补充必要的背景信息、上下文、示例（如果适用）和约束条件。明确任务目标和期望的输出格式。确保 Prompt 结构清晰、逻辑严谨、信息全面。直接返回优化后的 Prompt 文本，不要包含任何解释性文字或前缀。"
};

// 默认模型
const DEFAULT_MODEL = "gemini-2.0-flash-lite";

// 监听来自 content script 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("[BetterPrompt BG] Received message:", request);
    console.log("[BetterPrompt BG] Sender:", sender); // Log sender info

    if (request.type === "OPTIMIZE_TEXT") {
        console.log("[BetterPrompt BG] Handling OPTIMIZE_TEXT request.");

        // 1. 从 storage 获取 API Key 和提示模板设置
        console.log("[BetterPrompt BG] Attempting to get settings from storage.");
        chrome.storage.local.get(['geminiApiKey', 'selectedPromptType', 'customPrompt', 'selectedModel'], async (result) => {
            const apiKey = result.geminiApiKey;

            if (!apiKey) {
                console.error("[BetterPrompt BG] Gemini API Key not found in storage.");
                sendResponse({ error: "请先在插件选项中设置 Gemini API 密钥。" });
                console.log("[BetterPrompt BG] Sent error response (API key not found).");
                return;
            }
            console.log("[BetterPrompt BG] API Key found in storage.");

            // 确定使用哪个 systemPrompt
            let systemPrompt = SYSTEM_PROMPTS.default; // 默认
            const promptType = result.selectedPromptType || 'default';

            if (promptType === 'custom' && result.customPrompt) {
                systemPrompt = result.customPrompt;
            } else if (SYSTEM_PROMPTS[promptType]) {
                systemPrompt = SYSTEM_PROMPTS[promptType];
            }

            // 获取选择的模型
            const selectedModel = result.selectedModel || DEFAULT_MODEL;

            // 添加控制台输出：显示当前请求使用的 prompt 类型
            console.log(`[BetterPrompt BG] 当前请求使用的提示词类型: ${promptType === 'default' ? '默认' :
                promptType === 'concise' ? '简洁明了' :
                    promptType === 'detailed' ? '详细分析' :
                        promptType === 'custom' ? '自定义' : promptType}`);

            // 添加控制台输出：显示当前请求使用的模型
            console.log(`[BetterPrompt BG] 当前请求使用的模型: ${selectedModel}`);

            console.log("[BetterPrompt BG] Using prompt type:", promptType);
            console.log("[BetterPrompt BG] Using model:", selectedModel);

            // 2. 调用 Gemini API (异步操作)
            try {
                console.log("[BetterPrompt BG] Calling callGeminiApi function...");
                const optimizedText = await callGeminiApi(apiKey, request.text, systemPrompt, selectedModel);
                console.log("[BetterPrompt BG] callGeminiApi returned successfully. Sending optimized text back.");
                sendResponse({ optimizedText: optimizedText });
                console.log("[BetterPrompt BG] Sent success response with optimized text.");
            } catch (error) {
                console.error("[BetterPrompt BG] Error during callGeminiApi or sending response:", error);
                sendResponse({ error: `调用 API 时出错: ${error.message}` });
                console.log("[BetterPrompt BG] Sent error response (API call failed).");
            }
        });

        console.log("[BetterPrompt BG] Returning true to indicate async response for OPTIMIZE_TEXT.");
        return true; // 返回 true 表示我们将异步发送响应
    }
    // 新增：处理获取预设提示词的请求
    else if (request.type === "GET_PRESET_PROMPT") {
        console.log("[BetterPrompt BG] Handling GET_PRESET_PROMPT request for type:", request.promptType);
        const promptType = request.promptType;

        if (SYSTEM_PROMPTS[promptType]) {
            console.log("[BetterPrompt BG] Found preset prompt. Sending back.");
            sendResponse({ promptText: SYSTEM_PROMPTS[promptType] });
        } else {
            console.error("[BetterPrompt BG] Invalid prompt type requested:", promptType);
            sendResponse({ error: `未知的预设 Prompt 类型: ${promptType}` });
        }

        return false; // 这是同步响应，不需要返回 true
    }

    console.warn("[BetterPrompt BG] Received unknown message type:", request.type);
    return false; // 对其他消息类型同步返回 false
});

async function callGeminiApi(apiKey, textToOptimize, systemPrompt, modelName = DEFAULT_MODEL) {
    // 使用指定的模型，根据参数选择模型
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;

    console.log(`[BetterPrompt BG] Using model: ${modelName}`);
    // console.log(`[BetterPrompt BG] System Prompt: ${systemPrompt}`); // Log system prompt if needed

    // 不再手动拼接，使用独立的 system_instruction 和 contents
    // const fullPrompt = `${systemPrompt}\n\n用户输入：\n${textToOptimize}`;

    const requestBody = {
        // 使用专门的 system_instruction 字段
        system_instruction: {
            parts: [{
                text: systemPrompt
            }]
        },
        // 用户输入放在 contents 中
        contents: [{
            parts: [{
                text: textToOptimize // 只包含用户输入
            }]
        }],
        // 添加 generationConfig 控制生成行为
        generationConfig: {
            temperature: 0.3, // 降低温度以获得更一致、聚焦的优化结果
            maxOutputTokens: 2048 // 设置一个合理的输出上限
            // topP: 0.95, // 可以使用默认值
            // topK: 40,   // 可以使用默认值
        },
        // safetySettings: [ ... ] // 可以根据需要添加安全设置
    };

    // 只记录部分信息，避免完整日志过长或泄露过多信息
    console.log(`[BetterPrompt BG] Calling Gemini API Endpoint: ${apiUrl}`);
    // 记录请求体结构，隐藏具体文本内容
    console.log("[BetterPrompt BG] Request Body Structure:", {
        system_instruction: { parts: [{ text: "..." }] },
        contents: [{ parts: [{ text: "..." }] }],
        generationConfig: requestBody.generationConfig
    });


    const headers = {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
    };
    // console.log("[BetterPrompt BG] Request Headers (API key masked):", { ...headers, 'x-goog-api-key': '***MASKED***' }); // Mask key in logs


    let response;
    try {
        response = await fetch(apiUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });
    } catch (networkError) {
        console.error("[BetterPrompt BG] Network error during fetch:", networkError);
        throw new Error(`网络请求失败: ${networkError.message}`);
    }


    console.log(`[BetterPrompt BG] API Response Status: ${response.status} ${response.statusText}`);
    // console.log("[BetterPrompt BG] API Response Headers:", Object.fromEntries(response.headers.entries())); // 可选，可能很长


    if (!response.ok) {
        let errorBodyText = await response.text(); // 尝试读取错误响应体
        console.error("[BetterPrompt BG] API Error Response Body:", errorBodyText);
        // 尝试解析 JSON 错误体获取更具体信息
        let errorMessage = `API 请求失败，状态码: ${response.status}`;
        try {
            const errorJson = JSON.parse(errorBodyText);
            if (errorJson.error && errorJson.error.message) {
                errorMessage += `. ${errorJson.error.message}`;
            } else {
                errorMessage += `. ${errorBodyText.substring(0, 100)}...`; // 显示部分文本
            }
        } catch (parseError) {
            errorMessage += `. ${errorBodyText.substring(0, 100)}...`; // 解析失败，显示部分文本
        }
        throw new Error(errorMessage);
    }

    let data;
    try {
        data = await response.json();
        console.log("[BetterPrompt BG] API Response Data (parsed JSON):", data); // Log parsed data
    } catch (jsonError) {
        console.error("[BetterPrompt BG] Error parsing API response JSON:", jsonError);
        const rawText = await response.text(); // 尝试获取原始文本
        console.error("[BetterPrompt BG] Raw API response text:", rawText);
        throw new Error("无法解析 API 响应。");
    }


    // !!! 解析响应结构需根据 API 文档调整 !!!
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        const extractedText = data.candidates[0].content.parts[0].text.trim();
        console.log("[BetterPrompt BG] Extracted optimized text:", extractedText.substring(0, 50) + "...");
        return extractedText;
    } else if (data.error) {
        console.error("[BetterPrompt BG] API returned an error structure in JSON:", data.error);
        throw new Error(`API 错误: ${data.error.message || JSON.stringify(data.error)}`);
    } else {
        console.error("[BetterPrompt BG] Unexpected API response structure. Cannot extract text:", data);
        throw new Error("无法从 API 响应中提取优化后的文本。");
    }
}

// 安装监听器
chrome.runtime.onInstalled.addListener((details) => {
    console.log(`[BetterPrompt BG] Extension installed or updated. Reason: ${details.reason}`);
    // ... 其他初始化逻辑 ...
});

// 可以添加 Service Worker 激活的日志，但可能很频繁
// self.addEventListener('activate', event => {
//   console.log('[BetterPrompt BG] Service worker activated.');
// });