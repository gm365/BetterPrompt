// popup.js
console.log("[BetterPrompt Popup] 脚本加载完成");

// 默认模型
const DEFAULT_MODEL = "gemini-2.0-flash-lite";
// 获取 background.js 中的默认温度值
let DEFAULT_TEMPERATURE = 0.2; // 先设置一个默认值，后续会从 background.js 获取

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
    console.log("[BetterPrompt Popup] DOM 加载完成");

    // 获取页面元素引用
    const apiKeyInput = document.getElementById('apiKey');
    const showKeyCheckbox = document.getElementById('showKey');
    const promptSelector = document.getElementById('promptSelector');
    const customPromptSection = document.getElementById('customPromptSection');
    const customPromptTextarea = document.getElementById('customPrompt');
    const currentPromptDisplay = document.getElementById('currentPrompt');
    const modelSelector = document.getElementById('modelSelector');
    const openPromptOptimizerBtn = document.getElementById('openPromptOptimizerBtn');
    const temperatureSlider = document.getElementById('temperatureSlider');
    const temperatureValue = document.getElementById('temperatureValue');
    // const statusDiv = document.getElementById('status'); // Remove statusDiv reference

    // 从 background.js 获取默认温度值 - 使用消息传递替代getBackgroundPage
    chrome.runtime.sendMessage({ type: "GET_DEFAULT_TEMPERATURE" }, (response) => {
        if (chrome.runtime.lastError) {
            console.warn("[BetterPrompt Popup] 获取默认温度值时出错:", chrome.runtime.lastError);
            // 继续使用默认值
        } else if (response && response.defaultTemperature !== undefined) {
            DEFAULT_TEMPERATURE = response.defaultTemperature;
            console.log("[BetterPrompt Popup] 从 background.js 获取默认温度值:", DEFAULT_TEMPERATURE);
            // 如果此时已经加载完成，但还没有设置温度值，则设置默认温度值
            if (temperatureSlider && (!temperatureSlider.value || temperatureSlider.value === "0")) {
                temperatureSlider.value = DEFAULT_TEMPERATURE;
                temperatureValue.textContent = DEFAULT_TEMPERATURE;
            }
        }
    });

    // 加载已保存的设置
    loadSavedSettings();

    // 创建防抖版本的保存函数
    const debouncedSaveSettings = debounce(saveSettings, 800); // 800ms 延迟

    // 事件监听器设置

    // 显示/隐藏 API 密钥
    showKeyCheckbox.addEventListener('change', () => {
        apiKeyInput.type = showKeyCheckbox.checked ? 'text' : 'password';
    });

    // 处理提示模板选择
    promptSelector.addEventListener('change', () => {
        handlePromptChange();
        saveSettings(); // 下拉框更改立即保存
    });

    // 处理自定义提示词的更改
    customPromptTextarea.addEventListener('input', () => {
        updateCurrentPromptDisplay();
        debouncedSaveSettings(); // 输入时防抖保存
    });

    // 处理API Key的更改
    apiKeyInput.addEventListener('input', () => {
        debouncedSaveSettings(); // 输入时防抖保存
    });

    // 处理模型选择更改
    modelSelector.addEventListener('change', () => {
        saveSettings(); // 下拉框更改立即保存
    });

    // 处理温度滑块更改
    temperatureSlider.addEventListener('input', () => {
        temperatureValue.textContent = temperatureSlider.value;
        debouncedSaveSettings(); // 使用防抖保存
    });

    // 处理打开Prompt优化器页面按钮点击
    openPromptOptimizerBtn.addEventListener('click', () => {
        console.log("[BetterPrompt Popup] 打开Prompt优化器页面");
        chrome.tabs.create({ url: 'prompt_optimizer.html' });
    });

    /**
     * 加载已保存的设置
     */
    function loadSavedSettings() {
        console.log("[BetterPrompt Popup] 正在加载保存的设置");
        chrome.storage.local.get(['geminiApiKey', 'selectedPromptType', 'customPrompt', 'selectedModel', 'temperature'], (result) => {
            // 设置 API 密钥
            if (result.geminiApiKey) {
                apiKeyInput.value = result.geminiApiKey;
                console.log("[BetterPrompt Popup] API 密钥已加载");
            }

            // 设置选定的提示类型
            const promptType = result.selectedPromptType || 'default';
            promptSelector.value = promptType;

            // 添加控制台输出：选择的提示词类型
            console.log(`[BetterPrompt Popup] 选择的提示词类型: ${promptType === 'default' ? '默认' :
                promptType === 'concise' ? '简洁' :
                    promptType === 'detailed' ? '详细' :
                        promptType === 'custom' ? '自定义' : promptType}`);


            // 设置自定义提示 - 总是加载，即使当前选择的不是自定义
            if (result.customPrompt) {
                customPromptTextarea.value = result.customPrompt;
            }
            // 只有当上次保存的是自定义类型时，才默认显示它
            if (promptType === 'custom') {
                customPromptSection.style.display = 'block';
            }


            // 设置选定的模型
            const modelName = result.selectedModel || DEFAULT_MODEL;
            modelSelector.value = modelName;
            console.log("[BetterPrompt Popup] 模型已加载:", modelName);
            // 添加控制台输出：选择的模型名称
            console.log(`[BetterPrompt Popup] 选择的模型名称: ${modelName}`);

            // 设置温度值
            const temperature = result.temperature !== undefined ? result.temperature : DEFAULT_TEMPERATURE;
            temperatureSlider.value = temperature;
            temperatureValue.textContent = temperature;
            console.log("[BetterPrompt Popup] 温度值已加载:", temperature);

            // 更新当前显示的提示词
            updateCurrentPromptDisplay();
            console.log("[BetterPrompt Popup] 设置加载完成");
        });
    }

    /**
     * 处理提示模板的改变
     */
    function handlePromptChange() {
        const selectedValue = promptSelector.value;
        console.log("[BetterPrompt Popup] 提示模板更改为:", selectedValue);

        // 如果选择了自定义，显示自定义输入区域
        if (selectedValue === 'custom') {
            customPromptSection.style.display = 'block';
        } else {
            customPromptSection.style.display = 'none';
        }

        updateCurrentPromptDisplay();
    }

    /**
     * 更新当前提示词的显示
     */
    function updateCurrentPromptDisplay() {
        const selectedValue = promptSelector.value;

        // 设置临时加载状态
        currentPromptDisplay.textContent = "加载中...";

        if (selectedValue === 'custom') {
            // 使用自定义提示词
            const customText = customPromptTextarea.value.trim();
            currentPromptDisplay.textContent = customText || "请输入自定义提示词...";
        } else {
            // 从background.js中获取预设提示词
            chrome.runtime.sendMessage({ type: "GET_PRESET_PROMPT", promptType: selectedValue }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("[BetterPrompt Popup] 获取预设提示词时出错:", chrome.runtime.lastError);
                    currentPromptDisplay.textContent = "无法获取提示词，请确保插件正常运行";
                    showToast("无法连接到后台脚本", "error");
                    return;
                }

                if (response && response.promptText) {
                    currentPromptDisplay.textContent = response.promptText;
                } else if (response && response.error) {
                    console.error("[BetterPrompt Popup] 获取预设提示词错误:", response.error);
                    currentPromptDisplay.textContent = `错误: ${response.error}`;
                    showToast(response.error, "error");
                } else {
                    console.warn("[BetterPrompt Popup] 获取到无效的预设提示词响应");
                    currentPromptDisplay.textContent = "无法获取预设提示词";
                    showToast("无效的响应", "warning");
                }
            });
        }
    }

    /**
     * 保存所有设置到 storage - 无需按钮触发
     */
    function saveSettings() {
        console.log("[BetterPrompt Popup] 正在自动保存设置...");
        // showToast('正在保存...', 'info'); // Optionally show "saving..." toast

        const apiKey = apiKeyInput.value.trim();
        const selectedPromptType = promptSelector.value;
        const customPrompt = customPromptTextarea.value.trim();
        const selectedModel = modelSelector.value;
        const temperature = parseFloat(temperatureSlider.value);

        // 添加控制台输出：更新设置时的提示词类型和模型名称
        console.log(`[BetterPrompt Popup] 正在保存 - 提示词类型: ${selectedPromptType === 'default' ? '默认' :
            selectedPromptType === 'concise' ? '简洁' :
                selectedPromptType === 'detailed' ? '详细' :
                    selectedPromptType === 'custom' ? '自定义' : selectedPromptType}`);
        console.log(`[BetterPrompt Popup] 正在保存 - 模型名称: ${selectedModel}`);
        console.log(`[BetterPrompt Popup] 正在保存 - 温度值: ${temperature}`);

        if (!apiKey) {
            console.warn("[BetterPrompt Popup] API 密钥为空，但仍会保存。");
            // Maybe show a warning toast?
            // showToast('API 密钥为空', 'warning');
        }
        if (selectedPromptType === 'custom' && !customPrompt) {
            console.warn("[BetterPrompt Popup] 选择了自定义提示，但内容为空。");
        }

        const settings = {
            geminiApiKey: apiKey,
            selectedPromptType: selectedPromptType,
            customPrompt: customPrompt,
            selectedModel: selectedModel,
            temperature: isNaN(temperature) ? DEFAULT_TEMPERATURE : temperature
        };

        chrome.storage.local.set(settings, () => {
            if (chrome.runtime.lastError) {
                console.error("[BetterPrompt Popup] 保存设置时出错:", chrome.runtime.lastError);
                showToast(`保存失败: ${chrome.runtime.lastError.message}`, 'error');
            } else {
                console.log("[BetterPrompt Popup] 设置自动保存成功:", settings);
                showToast('设置已保存', 'success'); // Show success toast
            }
        });
    }

    // Keep track of the current toast timeout to prevent overlaps if needed
    let currentToastTimeout = null;

    /**
     * 显示 Toast 通知
     * @param {string} message - 要显示的消息
     * @param {'info'|'success'|'error'|'warning'} type - 通知类型
     * @param {number} duration - 显示时长 (毫秒)
     */
    function showToast(message, type = 'info', duration = 2000) {
        // Clear any existing toast timeout to prevent overlaps
        if (currentToastTimeout) {
            clearTimeout(currentToastTimeout);
            // Optionally remove existing toast immediately
            const existingToast = document.querySelector('.toast-notification');
            if (existingToast) {
                existingToast.remove();
            }
        }

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast-notification ${type}`;
        toast.textContent = message;

        // Append to body
        document.body.appendChild(toast);

        // Trigger reflow to enable transition
        void toast.offsetWidth;

        // Add 'show' class to trigger animation
        toast.classList.add('show');

        // Set timeout to hide and remove the toast
        currentToastTimeout = setTimeout(() => {
            toast.classList.remove('show');
            // Remove the element after the transition ends
            toast.addEventListener('transitionend', () => {
                if (toast.parentNode) {
                    toast.remove();
                }
                currentToastTimeout = null; // Clear the timeout reference
            }, { once: true }); // Use once to auto-remove the listener

            // Fallback removal if transitionend doesn't fire (e.g., element removed differently)
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
                if (currentToastTimeout) currentToastTimeout = null; // Ensure cleanup
            }, 500); // 500ms should be longer than the transition

        }, duration);
    }
}); 