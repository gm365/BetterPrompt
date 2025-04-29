// background.js

console.log("[BetterPrompt BG] Service worker started.");


const SYSTEM_PROMPTS = {
    /** 通用 - 优化核心意图，明确上下文与目标 */
    default: `作为 Prompt 优化专家，请基于以下「用户原始输入」重写，生成一个高质量、目标明确的 Prompt。核心要求：
1.  **深度理解与提炼**：精准捕捉用户的核心意图与深层需求，去除模糊或冗余表述。
2.  **明确任务目标**：清晰定义 AI 需要完成的具体任务。
3.  **补充关键上下文**：添加必要的背景信息、假设或约束条件，确保 AI 准确理解任务环境。
4.  **定义期望输出**：明确说明期望的输出格式、风格、口吻或结构。
5.  **语言精练、逻辑严谨**：使用准确、无歧义的语言，确保逻辑清晰。
6.  **保持原始意图**：不得扭曲或添加与用户原意无关的信息。

直接输出优化后的 Prompt 内容本身，不要包含任何额外的问候、解释、标题或标记（如 "Prompt:"）。
Important: Output must start immediately with the rewritten prompt content. Do **NOT** add greetings, explanations, titles, or any extra words before or after the prompt.
`,

    /** 极简 - 直击核心，高度浓缩 */
    concise: `请将以下「用户原始输入」压缩为一到两句、信息密度极高的 AI Prompt。要求：
1.  **直击本质**：仅保留最核心的任务指令和关键约束。
2.  **极致精简**：删除所有非必要的描述、解释、示例和情感色彩。
3.  **清晰无歧义**：确保浓缩后的指令依然准确、易于理解。

只输出最终浓缩后的 Prompt 文本，不附加任何解释。
`,

    /** 结构化 - 要素完整，逻辑清晰 */
    detailed: `请基于以下「用户原始输入」，进行深度分析和结构化重构，生成一份包含以下核心要素的详细 Prompt：
1.  **核心目标 (Core Objective)**：明确指出本次任务最根本的目的。
2.  **角色与背景 (Role & Context)**：设定 AI 的角色（如果需要），并提供完成任务所必需的最小背景信息。
3.  **关键指令与步骤 (Key Instructions & Steps)**：按逻辑顺序列出具体的执行要求或思考步骤。
4.  **输入信息 (Input Data / Information)**：说明需要处理的输入类型或具体内容（如有）。
5.  **输出要求 (Output Requirements)**：详细定义期望输出的具体格式、结构、风格、语气、长度限制和评估标准。
6.  **约束与偏好 (Constraints & Preferences)**：明确任务的限制条件、禁止项或用户的特殊偏好。

确保各要素条理清晰、信息完备且相互关联，能指导 AI 精准高效地完成任务。禁止输出任何额外解释或标注，仅返回最终结构化的 Prompt。
Important: Output must start immediately with the rewritten prompt content (beginning with "核心目标"). Do **NOT** add greetings, explanations, titles, section numbers (like ①, ②), or any extra words before or after the prompt sections. Use Markdown headers (e.g., ## 核心目标) for structure if appropriate for the target AI, otherwise use clear text labels followed by content.
`,
};

// 默认模型
const DEFAULT_MODEL = "gemini-2.0-flash-lite";
const DEFAULT_TEMPERATURE = 0.2; // 默认的生成温度
const DEFAULT_MAX_OUTPUT_TOKENS = 2048; // 默认的最大输出 Token 数

// 监听来自 content script 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("[BetterPrompt BG] Received message:", request);
    console.log("[BetterPrompt BG] Sender:", sender); // Log sender info

    if (request.type === "OPTIMIZE_TEXT") {
        console.log("[BetterPrompt BG] Handling OPTIMIZE_TEXT request.");

        // 1. 从 storage 获取 API Key 和提示模板设置
        console.log("[BetterPrompt BG] Attempting to get settings from storage.");
        chrome.storage.local.get(['geminiApiKey', 'selectedPromptType', 'customPrompt', 'selectedModel', 'temperature'], async (result) => {
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

            // 获取温度值：优先使用请求中的temperature参数，如果未提供，再从storage中获取
            let temperature;
            if (request.temperature !== undefined) {
                temperature = request.temperature;
                console.log("[BetterPrompt BG] 使用请求中提供的温度值:", temperature);
            } else {
                temperature = result.temperature !== undefined ? result.temperature : DEFAULT_TEMPERATURE;
                console.log("[BetterPrompt BG] 使用存储中的温度值:", temperature);
            }

            // 添加控制台输出：显示当前请求使用的 prompt 类型
            console.log(`[BetterPrompt BG] 当前请求使用的提示词类型: ${promptType === 'default' ? '默认' :
                promptType === 'concise' ? '简洁明了' :
                    promptType === 'detailed' ? '详细分析' :
                        promptType === 'custom' ? '自定义' : promptType}`);

            // 添加控制台输出：显示当前请求使用的模型
            console.log(`[BetterPrompt BG] 当前请求使用的模型: ${selectedModel}`);

            // 添加控制台输出：显示当前请求使用的温度值
            console.log(`[BetterPrompt BG] 当前请求使用的温度值: ${temperature}`);

            console.log("[BetterPrompt BG] Using prompt type:", promptType);
            console.log("[BetterPrompt BG] Using model:", selectedModel);

            // 2. 调用 Gemini API (异步操作)
            try {
                console.log("[BetterPrompt BG] Calling callGeminiApi function...");
                const optimizedText = await callGeminiApi(apiKey, request.text, systemPrompt, selectedModel, temperature);
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
    // 新增：处理获取默认温度值的请求
    else if (request.type === "GET_DEFAULT_TEMPERATURE") {
        console.log("[BetterPrompt BG] Handling GET_DEFAULT_TEMPERATURE request");
        sendResponse({ defaultTemperature: DEFAULT_TEMPERATURE });
        return false; // 这是同步响应，不需要返回 true
    }

    console.warn("[BetterPrompt BG] Received unknown message type:", request.type);
    return false; // 对其他消息类型同步返回 false
});

async function callGeminiApi(apiKey, textToOptimize, systemPrompt, modelName = DEFAULT_MODEL, temperature = DEFAULT_TEMPERATURE) {
    // 使用指定的模型，根据参数选择模型
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;

    console.log(`[BetterPrompt BG] Using model: ${modelName}`);
    console.log(`[BetterPrompt BG] Using temperature: ${temperature}`);
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
            temperature: temperature, // 使用传入的温度值
            maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS, // 使用常量
            // topP: 0.95, // 可以使用默认值
            // topK: 40,   // 可以使用默认值
        }
    };

    // 只有当模型为 gemini-2.5-flash-preview-04-17 时才添加 thinkingConfig
    if (modelName === "gemini-2.5-flash-preview-04-17") {
        requestBody.generationConfig.thinkingConfig = {
            thinkingBudget: 1024 // 设置预算，单位为 tokens. 0 = disabled, 1-1024 -> 1024.
        };
    }

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