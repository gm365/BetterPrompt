// prompt_optimizer.js
console.log("[BetterPrompt Optimizer] 脚本加载完成");

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

// 默认温度值
let DEFAULT_TEMPERATURE = 0.2; // 先设置一个默认值，后续会从 background.js 获取
let selectedPromptType = 'default'; // 新增：用于存储当前选中的模板类型

// **** 新增：用于存储模板内容的 Map ****
let templateContentsMap = {};

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
    const templateTabs = document.getElementById('templateTabs'); // 新增：获取模板标签容器
    const modelSelector = document.getElementById('modelSelector');
    const temperatureSlider = document.getElementById('temperatureSlider');
    const temperatureValue = document.getElementById('temperatureValue');
    // **** 新增：获取或创建 Tooltip 元素 ****
    let templateTooltip = document.getElementById('templateTooltip');

    if (!templateTooltip) {
        console.error("[BetterPrompt Optimizer] Tooltip element #templateTooltip not found!");
        // 如果没有找到元素，创建一个
        templateTooltip = document.createElement('div');
        templateTooltip.id = 'templateTooltip';
        templateTooltip.className = 'template-tooltip';
        document.body.appendChild(templateTooltip);
    }

    // 加载保存的设置
    loadSavedSettings();

    // 事件监听
    optimizeButton.addEventListener('click', optimizePrompt);
    copyButton.addEventListener('click', copyOptimizedText);
    clearButton.addEventListener('click', clearAll);
    templateTabs.addEventListener('click', handleTabClick); // 新增：监听模板标签点击

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

    // 监听原始提示词文本框输入，有内容时启用优化按钮
    originalPromptTextarea.addEventListener('input', () => {
        optimizeButton.disabled = originalPromptTextarea.value.trim() === '';
    });

    // 当模型改变时保存设置
    modelSelector.addEventListener('change', function () {
        // 选择后的视觉反馈更加轻微
        this.classList.add('active-like');

        // 确保下拉菜单关闭后文本显示正确
        const selectedOption = this.options[this.selectedIndex];
        if (selectedOption) {
            // 如果选项存在，确保显示正确的文本
            console.log(`[BetterPrompt Optimizer] 模型已更改为: ${selectedOption.text}`);
        }

        // 保存设置
        saveSettings();
    });

    // 为选择器添加轻微的视觉标记，而不是完全的活动样式
    modelSelector.classList.add('active-like');

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
            selectedPromptType = result.selectedPromptType || 'default';
            console.log(`[BetterPrompt Optimizer] 已加载提示词类型: ${selectedPromptType}`);
            updateActiveTab(selectedPromptType);

            // 设置选定的模型
            if (result.selectedModel) {
                modelSelector.value = result.selectedModel;
                console.log(`[BetterPrompt Optimizer] 已加载模型: ${result.selectedModel}`);
            }

            // 设置温度值
            const temperature = result.temperature !== undefined ? result.temperature : DEFAULT_TEMPERATURE;
            temperatureSlider.value = temperature;
            temperatureValue.textContent = temperature;
            updateTemperatureColor(temperature);
            console.log("[BetterPrompt Optimizer] 温度值已加载:", temperature);

            // **** 修改：填充 templateContentsMap ****
            templateContentsMap = { ...SYSTEM_PROMPTS }; // 复制预设模板
            templateContentsMap['custom'] = result.customPrompt || "尚未定义自定义模板。"; // 添加自定义模板内容
            console.log("[BetterPrompt Optimizer] 模板内容 Map 已填充");

            // 确保按钮状态正确
            optimizeButton.disabled = originalPromptTextarea.value.trim() === '';
            copyButton.disabled = optimizedPromptTextarea.value.trim() === '';

            // **** 新增：加载完成后为 Tab 添加 Tooltip 事件 ****
            setupTooltipEvents();
        });
    }

    /**
     * 处理模板标签点击事件
     * @param {Event} event
     */
    function handleTabClick(event) {
        const clickedTab = event.target.closest('.template-tab');
        if (!clickedTab) return; // 如果点击的不是标签，则忽略

        const newValue = clickedTab.dataset.value;
        if (newValue === selectedPromptType) return; // 如果点击的是当前已选中的标签，则不处理

        console.log("[BetterPrompt Optimizer] 模板标签点击，切换到:", newValue);
        selectedPromptType = newValue; // 更新状态变量

        // 更新标签的 active 状态
        updateActiveTab(newValue);

        // 保存设置
        saveSettings();
    }

    /**
     * 根据选定的类型更新活动标签的样式
     * @param {string} promptType - 当前选定的模板类型
     */
    function updateActiveTab(promptType) {
        const tabs = templateTabs.querySelectorAll('.template-tab');
        tabs.forEach(tab => {
            if (tab.dataset.value === promptType) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
    }

    /**
     * 保存当前设置（模型、温度、模板类型，以及自定义模板内容）
     */
    function saveSettings() {
        const settingsToSave = {
            selectedPromptType: selectedPromptType,
            selectedModel: modelSelector.value,
            temperature: parseFloat(temperatureSlider.value),
        };

        // **** 保留自定义模板的保存，但使用 templateContentsMap 而不是 DOM 元素 ****
        if (selectedPromptType === 'custom' && templateContentsMap['custom']) {
            settingsToSave.customPrompt = templateContentsMap['custom'];
        }

        console.log("[BetterPrompt Optimizer] 正在保存设置:", settingsToSave);
        chrome.storage.local.set(settingsToSave, () => {
            if (chrome.runtime.lastError) {
                console.error("[BetterPrompt Optimizer] 保存设置失败:", chrome.runtime.lastError);
            } else {
                console.log("[BetterPrompt Optimizer] 设置已保存。");
            }
        });
    }

    /**
     * 调用后台进行提示词优化
     */
    async function optimizePrompt() {
        const originalPrompt = originalPromptTextarea.value.trim();
        if (!originalPrompt) {
            showToast("请输入原始提示词！", "warning");
            return;
        }

        const selectedModel = modelSelector.value;
        const temperature = parseFloat(temperatureSlider.value);
        let systemPrompt = ''; // 初始化系统提示

        console.log(`[BetterPrompt Optimizer] 开始优化。类型: ${selectedPromptType}, 模型: ${selectedModel}, 温度: ${temperature}`);

        // **** 修改：从 templateContentsMap 获取模板内容 ****
        systemPrompt = templateContentsMap[selectedPromptType];

        // 检查模板内容是否存在且有效
        if (!systemPrompt) {
            if (selectedPromptType === 'custom') {
                showToast("自定义模板内容为空，请先编辑自定义模板！", "warning");
                console.warn("[BetterPrompt Optimizer] 自定义模板为空，已中止优化。");
            } else {
                console.error("未找到对应的预设系统提示:", selectedPromptType);
                showToast("选择的预设模板无效！", "error");
            }
            return;
        }

        // 显示加载指示器等 UI 操作
        loadingIndicator.classList.add('show');
        optimizeButton.disabled = true;
        optimizedPromptTextarea.value = '';
        copyButton.disabled = true;

        try {
            // 调用 background.js 发送请求
            const response = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    type: "OPTIMIZE_TEXT",
                    text: originalPrompt,
                    temperature: temperature,
                    systemPrompt: systemPrompt // 添加 systemPrompt 字段
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error("[BetterPrompt Optimizer] sendMessage 错误:", chrome.runtime.lastError.message);
                        reject(new Error(chrome.runtime.lastError.message));
                    } else if (response && response.error) {
                        reject(new Error(response.error));
                    } else if (response && response.optimizedText !== undefined) {
                        resolve(response);
                    } else {
                        console.error("[BetterPrompt Optimizer] 收到无效响应:", response);
                        reject(new Error("后台脚本返回了无效的响应。"));
                    }
                });
            });

            console.log("[BetterPrompt Optimizer] 收到优化结果:", response);
            optimizedPromptTextarea.value = response.optimizedText.trim();
            copyButton.disabled = false;
            showToast("提示词优化成功！", "success");

        } catch (error) {
            console.error("[BetterPrompt Optimizer] 优化过程中出错:", error);
            optimizedPromptTextarea.value = `优化失败：${error.message}`;
            showToast(`优化失败: ${error.message}`, "error", 4000);
        } finally {
            // 隐藏加载指示器等 UI 恢复操作
            loadingIndicator.classList.remove('show');
            // 只有在原始输入框还有内容时才重新启用优化按钮
            optimizeButton.disabled = originalPromptTextarea.value.trim() === '';
        }
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

    // --- 新增：Tooltip 相关函数 ---

    /**
     * 为所有模板标签添加 Tooltip 事件监听
     */
    function setupTooltipEvents() {
        const tabs = templateTabs.querySelectorAll('.template-tab');
        tabs.forEach(tab => {
            tab.addEventListener('mouseenter', handleTooltipMouseEnter);
            tab.addEventListener('mouseleave', handleTooltipMouseLeave);
            tab.addEventListener('mousemove', positionTooltip);
        });
        console.log("[BetterPrompt Optimizer] Tooltip 事件监听器已设置");
    }

    /**
     * 鼠标进入标签时的处理函数
     * @param {MouseEvent} event
     */
    function handleTooltipMouseEnter(event) {
        if (!templateTooltip) return;

        const templateKey = event.target.dataset.value;
        const content = templateContentsMap[templateKey];

        if (content) {
            templateTooltip.textContent = content;
            // 立即显示，然后添加 show 类以触发淡入
            templateTooltip.style.display = 'block';
            requestAnimationFrame(() => { // 确保 display: block 生效后再加 class
                templateTooltip.classList.add('show');
            });
            positionTooltip(event); // 初始定位
        } else {
            templateTooltip.textContent = '无法加载此模板的内容';
            templateTooltip.style.display = 'block';
            requestAnimationFrame(() => {
                templateTooltip.classList.add('show');
            });
            positionTooltip(event);
        }
    }

    /**
     * 鼠标离开标签时的处理函数
     */
    function handleTooltipMouseLeave() {
        if (!templateTooltip) return;
        templateTooltip.classList.remove('show');
        // 在过渡结束后隐藏，避免闪烁
        templateTooltip.addEventListener('transitionend', () => {
            if (!templateTooltip.classList.contains('show')) { // 再次检查，防止快速移入移出问题
                templateTooltip.style.display = 'none';
            }
        }, { once: true });
        // 设置一个备用隐藏，以防 transitionend 不触发
        setTimeout(() => {
            if (!templateTooltip.classList.contains('show')) {
                templateTooltip.style.display = 'none';
            }
        }, 200); // 略长于 transition 时间
    }

    /**
     * 定位 Tooltip
     * @param {MouseEvent} event
     */
    function positionTooltip(event) {
        if (!templateTooltip || templateTooltip.style.display === 'none') return;

        const offset = 12; // 鼠标指针与 Tooltip 左上角的偏移量
        let x = event.clientX + offset;
        let y = event.clientY + offset;
        const tooltipRect = templateTooltip.getBoundingClientRect(); // 获取实际渲染尺寸

        // 防止 Tooltip 超出窗口右边界
        if (x + tooltipRect.width > window.innerWidth) {
            x = window.innerWidth - tooltipRect.width - offset;
        }
        // 防止 Tooltip 超出窗口下边界
        if (y + tooltipRect.height > window.innerHeight) {
            y = event.clientY - tooltipRect.height - offset; // 移到鼠标上方
        }
        // 防止 Tooltip 超出窗口左边界
        if (x < offset) { // 稍微留点边距
            x = offset;
        }
        // 防止 Tooltip 超出窗口上边界
        if (y < offset) {
            y = offset;
        }

        templateTooltip.style.left = `${x}px`;
        templateTooltip.style.top = `${y}px`;
    }
}); 