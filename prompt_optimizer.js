// prompt_optimizer.js
console.log("[BetterPrompt Optimizer] 脚本加载完成");

// 预设的系统提示词（优化后）
const SYSTEM_PROMPTS = {
    /** 通用——高质量、上下文充分 */
    default: `作为一名专业 Prompt Engineer，请基于以下「用户原始输入」，重写一个高质量 AI Prompt。要求：
1. 语言准确清晰、逻辑严谨；
2. 充分还原并补充必要上下文，使任务目标、期望输出和评估标准一目了然；
3. 如示例或约束条件有助于完成任务，可主动添加；
4. 不得引入与原意无关的信息。
仅返回重写后的 Prompt，本条说明及任何前缀一律省略。`,

    /** 极简——信息密度最高的两句话内 */
    concise: `请将以下「用户原始输入」压缩为 ≤2 句的精准 AI Prompt：保留核心意图与关键约束，删除所有冗余或情绪性描述，确保一读即懂。只输出结果文本，不附加解释。`,

    /** 结构化——分段清晰、要素完备 */
    detailed: `请对以下「用户原始输入」进行深度再设计，输出一份结构化 Prompt，包含：
① 任务目标  
② 必要背景/上下文  
③ 输入格式与示例（如适用）  
④ 输出要求及评估标准  
⑤ 限制条件（风格、长度、语言等）
确保条理分明、信息完备，能指导 AI 精准完成任务。禁止输出任何额外解释或标注，仅返回最终 Prompt。`
};

// 默认温度值
let DEFAULT_TEMPERATURE = 0.2; // 先设置一个默认值，后续会从 background.js 获取

/**
 * 根据温度值获取对应的颜色
 * @param {number} temperature - 温度值（0-1）
 * @returns {string} - 颜色的 CSS 值
 */
function getTemperatureColor(temperature) {
    // 确保温度值在 0-1 范围内
    temperature = Math.min(1, Math.max(0, temperature));

    // 定义冷色到热色的渐变色带
    const colors = [
        { temp: 0.0, color: '#3b82f6' },  // 蓝色 (冷)
        { temp: 0.2, color: '#60a5fa' },  // 淡蓝色
        { temp: 0.4, color: '#a3e635' },  // 绿色
        { temp: 0.6, color: '#facc15' },  // 黄色
        { temp: 0.8, color: '#f97316' },  // 橙色
        { temp: 1.0, color: '#ef4444' }   // 红色 (热)
    ];

    // 找到温度值所处的范围
    let startColor, endColor;
    let startTemp, endTemp;

    for (let i = 0; i < colors.length - 1; i++) {
        if (temperature >= colors[i].temp && temperature <= colors[i + 1].temp) {
            startColor = colors[i].color;
            endColor = colors[i + 1].color;
            startTemp = colors[i].temp;
            endTemp = colors[i + 1].temp;
            break;
        }
    }

    // 如果是边界值，直接返回对应颜色
    if (temperature === 0) return colors[0].color;
    if (temperature === 1) return colors[colors.length - 1].color;

    // 计算插值比例
    const ratio = (temperature - startTemp) / (endTemp - startTemp);

    // 将颜色从十六进制转换为RGB
    const startRGB = hexToRgb(startColor);
    const endRGB = hexToRgb(endColor);

    // 线性插值两个颜色
    const r = Math.round(startRGB.r + ratio * (endRGB.r - startRGB.r));
    const g = Math.round(startRGB.g + ratio * (endRGB.g - startRGB.g));
    const b = Math.round(startRGB.b + ratio * (endRGB.b - startRGB.b));

    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * 将十六进制颜色转换为RGB
 * @param {string} hex - 十六进制颜色值
 * @returns {Object} - RGB颜色对象
 */
function hexToRgb(hex) {
    // 去掉 # 号
    hex = hex.replace('#', '');

    // 将十六进制转为 RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return { r, g, b };
}

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
    const temperatureSlider = document.getElementById('temperatureSlider');
    const temperatureValue = document.getElementById('temperatureValue');

    // 设置滑块的彩虹色渐变 - 调整为更柔和的色彩
    const rainbowGradient = `linear-gradient(to right, 
        rgba(92, 139, 246, 0.7) 0%, 
        rgba(131, 177, 250, 0.7) 20%, 
        rgba(176, 231, 102, 0.7) 40%, 
        rgba(250, 222, 95, 0.7) 60%, 
        rgba(249, 148, 82, 0.7) 80%, 
        rgba(239, 112, 112, 0.7) 100%)`;

    // 添加CSS样式到文档头部
    const styleEl = document.createElement('style');
    styleEl.textContent = `
        #temperatureSlider::-webkit-slider-runnable-track {
            background: ${rainbowGradient};
            height: 6px; /* 减小高度 */
            border-radius: 3px;
        }
        #temperatureSlider::-moz-range-track {
            background: ${rainbowGradient};
            height: 6px; /* 减小高度 */
            border-radius: 3px;
        }
        #temperatureSlider::-ms-track {
            background: ${rainbowGradient};
            height: 6px; /* 减小高度 */
            border-radius: 3px;
        }
        #temperatureSlider {
            -webkit-appearance: none;
            appearance: none;
            height: 6px; /* 减小高度 */
            border-radius: 3px;
            background: transparent; /* 移除背景色，使用透明背景 */
        }
        #temperatureSlider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: white;
            border: 2px solid #328E6E;
            cursor: pointer;
            margin-top: -5px;
        }
        #temperatureSlider::-moz-range-thumb {
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: white;
            border: 2px solid #328E6E;
            cursor: pointer;
        }
        #temperatureSlider::-ms-thumb {
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: white;
            border: 2px solid #328E6E;
            cursor: pointer;
        }
    `;
    document.head.appendChild(styleEl);

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
     * 更新温度颜色
     * @param {number} tempValue - 温度值
     */
    function updateTemperatureColor(tempValue) {
        // 取消使用彩虹色效果，改为固定颜色
        temperatureValue.style.backgroundColor = '#f5f9ef'; // 恢复原始背景色
        temperatureValue.style.color = 'var(--primary-color)'; // 恢复原始文字颜色
    }

    // 处理温度滑块更改
    temperatureSlider.addEventListener('input', () => {
        const tempValue = parseFloat(temperatureSlider.value);
        temperatureValue.textContent = temperatureSlider.value;
        updateTemperatureColor(tempValue);
        saveSettings(); // 立即保存温度设置
    });

    // 从 background.js 获取默认温度值
    chrome.runtime.sendMessage({ type: "GET_DEFAULT_TEMPERATURE" }, (response) => {
        if (chrome.runtime.lastError) {
            console.warn("[BetterPrompt Optimizer] 获取默认温度值时出错:", chrome.runtime.lastError);
            // 继续使用默认值
        } else if (response && response.defaultTemperature !== undefined) {
            DEFAULT_TEMPERATURE = response.defaultTemperature;
            console.log("[BetterPrompt Optimizer] 从 background.js 获取默认温度值:", DEFAULT_TEMPERATURE);
            // 如果此时已经加载完成，但还没有设置温度值，则设置默认温度值
            if (temperatureSlider && (!temperatureSlider.value || temperatureSlider.value === "0")) {
                temperatureSlider.value = DEFAULT_TEMPERATURE;
                temperatureValue.textContent = DEFAULT_TEMPERATURE;
                updateTemperatureColor(DEFAULT_TEMPERATURE);
            }
        }
    });

    /**
     * 加载保存的设置
     */
    function loadSavedSettings() {
        console.log("[BetterPrompt Optimizer] 正在加载保存的设置");
        chrome.storage.local.get(['selectedPromptType', 'selectedModel', 'customPrompt', 'temperature'], (result) => {
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

            // 设置温度值
            const temperature = result.temperature !== undefined ? result.temperature : DEFAULT_TEMPERATURE;
            temperatureSlider.value = temperature;
            temperatureValue.textContent = temperature;
            updateTemperatureColor(temperature); // 更新温度颜色
            console.log("[BetterPrompt Optimizer] 温度值已加载:", temperature);

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

        const temperature = parseFloat(temperatureSlider.value);

        const settings = {
            selectedPromptType: promptSelector.value,
            selectedModel: modelSelector.value,
            temperature: isNaN(temperature) ? DEFAULT_TEMPERATURE : temperature
        };

        console.log(`[BetterPrompt Optimizer] 正在保存 - 温度值: ${settings.temperature}`);

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
            const temperature = parseFloat(temperatureSlider.value);

            console.log(`[BetterPrompt Optimizer] 开始优化 - 使用模板: ${promptType}, 模型: ${modelName}, 温度: ${temperature}`);

            // 发送消息到 background.js 进行处理
            chrome.runtime.sendMessage(
                {
                    type: "OPTIMIZE_TEXT",
                    text: originalText,
                    temperature: temperature // 新增：传递温度值
                },
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