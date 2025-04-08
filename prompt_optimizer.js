// prompt_optimizer.js
console.log("[BetterPrompt Optimizer] 脚本加载完成");

// 预设的系统提示词 - 从background.js复制到这里方便前端使用 
// 预设的系统提示词（优化后）
const SYSTEM_PROMPTS = {
    default: "请分析以下用户原始输入，优化生成一个高质量的 AI Prompt。要求：语言清晰、逻辑严谨、具备充分上下文和必要示例，能够精准引导 AI 完成任务。直接返回优化后的 Prompt，不添加任何解释或前缀。",
    concise: "请将以下用户输入提炼成一个极简且精准的 AI Prompt。要求：保留核心意图和关键信息，删除所有冗余内容，使 AI 能迅速抓住重点。直接返回优化后的文本，勿附加任何解释。",
    detailed: "请对以下用户输入进行深入分析，并扩展生成一个结构完整、详细且高质量的 AI Prompt。要求：明确描述任务目标、背景信息、限制条件及示例（如适用），确保 AI 可以全面理解并准确响应。直接返回优化后的 Prompt，且不得包含任何解释性文字或多余说明。"
};

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("[BetterPrompt Optimizer] DOM 加载完成");

    // 获取页面元素引用
    const originalPromptTextarea = document.getElementById('originalPrompt');
    const optimizedPromptTextarea = document.getElementById('optimizedPrompt');
    const optimizeButton = document.getElementById('optimizeButton');
    const copyButton = document.getElementById('copyButton');
    const clearButton = document.getElementById('clearButton');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const promptSelector = document.getElementById('promptSelector');
    const modelSelector = document.getElementById('modelSelector');
    const templateContent = document.getElementById('templateContent'); // 新增：模板内容展示区域

    // 加载保存的设置
    loadSavedSettings();

    // 如果没有保存的设置，默认显示default模板内容
    if (!templateContent.textContent || templateContent.textContent === "选择上方的模板类型查看具体内容..." || templateContent.textContent === "未找到模板内容") {
        updateTemplateDisplay('default');
    }

    // 事件监听
    optimizeButton.addEventListener('click', optimizePrompt);
    copyButton.addEventListener('click', copyOptimizedText);
    clearButton.addEventListener('click', clearAll);
    promptSelector.addEventListener('change', handlePromptChange); // 新增：监听模板切换

    // 监听Enter键
    originalPromptTextarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey) { // Ctrl+Enter触发优化
            e.preventDefault();
            optimizePrompt();
        }
    });

    // 监听优化结果文本框输入，有内容时启用复制按钮
    optimizedPromptTextarea.addEventListener('input', () => {
        copyButton.disabled = optimizedPromptTextarea.value.trim() === '';
    });

    // 禁用优化按钮如果文本为空
    originalPromptTextarea.addEventListener('input', () => {
        optimizeButton.disabled = originalPromptTextarea.value.trim() === '';
    });

    // 当提示词类型或模型改变时保存设置
    modelSelector.addEventListener('change', saveSettings);

    /**
     * 加载保存的设置
     */
    function loadSavedSettings() {
        console.log("[BetterPrompt Optimizer] 正在加载保存的设置");
        chrome.storage.local.get(['selectedPromptType', 'selectedModel', 'customPrompt'], (result) => {
            // 设置选定的提示类型
            if (result.selectedPromptType) {
                promptSelector.value = result.selectedPromptType;
                console.log(`[BetterPrompt Optimizer] 已加载提示词类型: ${result.selectedPromptType}`);
            }

            // 设置选定的模型
            if (result.selectedModel) {
                modelSelector.value = result.selectedModel;
                console.log(`[BetterPrompt Optimizer] 已加载模型: ${result.selectedModel}`);
            }

            // 更新模板内容展示
            updateTemplateDisplay(result.selectedPromptType, result.customPrompt);
        });

        // 默认禁用优化按钮
        optimizeButton.disabled = true;
    }

    /**
     * 处理提示模板的改变
     */
    function handlePromptChange() {
        const selectedValue = promptSelector.value;
        console.log("[BetterPrompt Optimizer] 提示模板更改为:", selectedValue);

        // 从存储中获取自定义提示词
        chrome.storage.local.get(['customPrompt'], (result) => {
            updateTemplateDisplay(selectedValue, result.customPrompt);
            saveSettings(); // 保存用户的选择
        });
    }

    /**
     * 更新模板内容展示
     */
    function updateTemplateDisplay(promptType, customPrompt) {
        console.log(`[BetterPrompt Optimizer] 更新模板内容展示: 类型=${promptType}`);

        if (promptType === 'custom' && customPrompt) {
            templateContent.textContent = customPrompt;
        } else if (SYSTEM_PROMPTS[promptType]) {
            templateContent.textContent = SYSTEM_PROMPTS[promptType];
        } else {
            templateContent.textContent = '未找到模板内容';
        }
    }

    /**
     * 保存设置
     */
    function saveSettings() {
        console.log("[BetterPrompt Optimizer] 正在保存设置");

        const settings = {
            selectedPromptType: promptSelector.value,
            selectedModel: modelSelector.value
        };

        chrome.storage.local.set(settings, () => {
            if (chrome.runtime.lastError) {
                console.error("[BetterPrompt Optimizer] 保存设置失败:", chrome.runtime.lastError);
                showToast("设置保存失败", "error");
            } else {
                console.log("[BetterPrompt Optimizer] 设置保存成功");
                // 不显示保存成功的提示，避免干扰用户
            }
        });
    }

    /**
     * 优化Prompt
     */
    function optimizePrompt() {
        const originalText = originalPromptTextarea.value.trim();

        if (!originalText) {
            showToast("请输入需要优化的提示词", "warning");
            return;
        }

        // 检查API密钥
        chrome.storage.local.get(['geminiApiKey'], (result) => {
            if (!result.geminiApiKey) {
                showToast("请先在插件设置中配置 Gemini API 密钥", "error");
                return;
            }

            // 显示加载状态
            loadingIndicator.classList.add('show');
            optimizeButton.disabled = true;

            // 获取当前选择的提示词类型和模型
            const promptType = promptSelector.value;
            const modelName = modelSelector.value;

            console.log(`[BetterPrompt Optimizer] 开始优化 - 使用模板: ${promptType}, 模型: ${modelName}`);

            // 发送消息到 background.js 进行处理
            chrome.runtime.sendMessage(
                { type: "OPTIMIZE_TEXT", text: originalText },
                (response) => {
                    // 隐藏加载状态
                    loadingIndicator.classList.remove('show');
                    optimizeButton.disabled = false;

                    // 检查错误
                    if (chrome.runtime.lastError) {
                        console.error("[BetterPrompt Optimizer] 消息发送错误:", chrome.runtime.lastError);
                        showToast("与后台通信失败，请刷新页面重试", "error");
                        return;
                    }

                    if (response && response.error) {
                        console.error("[BetterPrompt Optimizer] 优化失败:", response.error);
                        showToast(`优化失败: ${response.error}`, "error");
                        return;
                    }

                    if (response && response.optimizedText) {
                        console.log("[BetterPrompt Optimizer] 优化成功");
                        optimizedPromptTextarea.value = response.optimizedText;
                        copyButton.disabled = false;
                        showToast("优化完成", "success");
                    } else {
                        console.warn("[BetterPrompt Optimizer] 收到无效响应:", response);
                        showToast("优化过程出现错误", "error");
                    }
                }
            );
        });
    }

    /**
     * 复制优化后的文本
     */
    function copyOptimizedText() {
        const textToCopy = optimizedPromptTextarea.value;

        if (!textToCopy) {
            showToast("没有可复制的文本", "warning");
            return;
        }

        navigator.clipboard.writeText(textToCopy)
            .then(() => {
                console.log("[BetterPrompt Optimizer] 文本已复制到剪贴板");
                showToast("已复制到剪贴板", "success");
            })
            .catch(err => {
                console.error("[BetterPrompt Optimizer] 复制失败:", err);
                showToast("复制失败，请手动选择并复制", "error");
            });
    }

    /**
     * 清空所有文本
     */
    function clearAll() {
        originalPromptTextarea.value = '';
        optimizedPromptTextarea.value = '';
        copyButton.disabled = true;
        optimizeButton.disabled = true;
        console.log("[BetterPrompt Optimizer] 已清空所有文本");
    }

    // 保存当前Toast超时，避免重叠
    let currentToastTimeout = null;

    /**
     * 显示Toast通知
     * @param {string} message - 消息内容
     * @param {'info'|'success'|'error'|'warning'} type - 通知类型
     * @param {number} duration - 显示时长（毫秒）
     */
    function showToast(message, type = 'info', duration = 2000) {
        // 清除现有的Toast超时
        if (currentToastTimeout) {
            clearTimeout(currentToastTimeout);
            const existingToast = document.querySelector('.toast-notification');
            if (existingToast) {
                existingToast.remove();
            }
        }

        // 创建Toast元素
        const toast = document.createElement('div');
        toast.className = `toast-notification ${type}`;
        toast.textContent = message;

        // 添加到DOM
        document.body.appendChild(toast);

        // 触发重排以启用过渡效果
        void toast.offsetWidth;

        // 添加'show'类触发动画
        toast.classList.add('show');

        // 设置定时器隐藏并移除Toast
        currentToastTimeout = setTimeout(() => {
            toast.classList.remove('show');
            // 过渡结束后移除元素
            toast.addEventListener('transitionend', () => {
                if (toast.parentNode) {
                    toast.remove();
                }
                currentToastTimeout = null;
            }, { once: true });

            // 备用移除机制
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
                if (currentToastTimeout) currentToastTimeout = null;
            }, 500);

        }, duration);
    }
}); 