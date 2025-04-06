// content_script.js

console.log("Better Prompt content script loaded and listener attached.");

let spacePressTimes = []; // 记录最近三次空格按键的时间
const TRIPLE_SPACE_INTERVAL = 800; // 三次空格的最大间隔时间（毫秒）

document.addEventListener('keydown', handleKeyDown, true); // 使用捕获阶段以优先处理

function handleKeyDown(event) {
    // console.log(`[BetterPrompt CS] Keydown detected: Key='${event.key}', Code='${event.keyCode}'`); // 频繁，可选

    if (event.key === ' ' || event.keyCode === 32) { // 检测空格键
        const now = Date.now();
        const activeElement = document.activeElement;

        // 添加当前时间到空格按键时间数组
        spacePressTimes.push(now);

        // 只保留最近的三次时间
        if (spacePressTimes.length > 3) {
            spacePressTimes.shift();
        }

        // 检测是否是三次连续空格
        if (spacePressTimes.length === 3) {
            // 检查三次空格是否在时间间隔内
            const firstInterval = spacePressTimes[1] - spacePressTimes[0];
            const secondInterval = spacePressTimes[2] - spacePressTimes[1];

            if (firstInterval < TRIPLE_SPACE_INTERVAL && secondInterval < TRIPLE_SPACE_INTERVAL) {
                // 检测到三击空格
                console.log("[BetterPrompt CS] Triple space detected.");

                if (isActiveElementEditable(activeElement)) {
                    console.log("[BetterPrompt CS] Active element IS editable:", activeElement);
                    const currentText = getElementText(activeElement);

                    if (currentText && currentText.trim().length > 0) {
                        console.log("[BetterPrompt CS] Current text found:", currentText.substring(0, 50) + "..."); // 只记录前缀
                        // 阻止默认的空格输入行为和可能的其他监听器
                        event.preventDefault();
                        event.stopPropagation();
                        console.log("[BetterPrompt CS] Default space action prevented.");


                        // 可选：添加视觉反馈，例如给输入框一个临时样式
                        activeElement.style.opacity = '0.5'; // 示例：变暗
                        activeElement.disabled = true; // 禁用输入，防止用户在处理时修改
                        console.log("[BetterPrompt CS] Visual feedback applied (opacity, disabled).");


                        // 发送消息到 background script
                        console.log("[BetterPrompt CS] Sending message to background script:", { type: "OPTIMIZE_TEXT", text: currentText.substring(0, 50) + "..." });
                        chrome.runtime.sendMessage(
                            { type: "OPTIMIZE_TEXT", text: currentText },
                            (response) => {
                                console.log("[BetterPrompt CS] Received response from background:", response); // Log raw response

                                // !!! 重要：首先检查 lastError 或 context 是否失效 !!!
                                if (chrome.runtime.lastError) {
                                    console.warn("[BetterPrompt CS] Extension context invalidated or error after sending message:", chrome.runtime.lastError.message);
                                    // 不需要恢复状态，直接返回
                                    return;
                                }

                                // !!! 再次检查 activeElement 是否还在 DOM 中并且可用 !!!
                                // (虽然 sendMessage 前检查过，但异步回调后可能已改变)
                                // Check if the element is still part of the document *before* accessing properties like style/disabled
                                if (!document.body.contains(activeElement)) {
                                    console.warn("[BetterPrompt CS] Active element is no longer in the document after API call.");
                                    spacePressTimes = []; // 重置空格记录
                                    return;
                                }
                                // Now safe to access style/disabled
                                activeElement.style.opacity = '1';
                                activeElement.disabled = false;
                                console.log("[BetterPrompt CS] Visual feedback removed.");


                                if (!isActiveElementEditable(activeElement)) { // Check editability *after* re-enabling
                                    console.warn("[BetterPrompt CS] Active element is no longer editable after API call (potentially due to re-enabling?).");
                                    spacePressTimes = []; // 重置空格记录
                                    return;
                                }


                                // 现在可以安全处理响应
                                if (response && response.error) {
                                    // 处理 background script 返回的特定错误
                                    console.error("[BetterPrompt CS] Received optimization error from background:", response.error);
                                    alert(`Better Prompt 优化失败: ${response.error}`);
                                    // 错误发生，不替换文本
                                } else if (response && response.optimizedText) {
                                    console.log("[BetterPrompt CS] Received valid optimized text. Updating element.");
                                    setElementText(activeElement, response.optimizedText);
                                    // 将光标移到文本末尾
                                    moveCursorToEnd(activeElement);
                                    console.log("[BetterPrompt CS] Element text updated and cursor moved.");
                                } else {
                                    console.warn("[BetterPrompt CS] Received unexpected or empty response from background:", response);
                                    alert("Better Prompt 未能获取优化结果。");
                                }
                                // 重置空格记录，防止连续触发
                                console.log("[BetterPrompt CS] Resetting triple space timestamps.");
                                spacePressTimes = [];
                            }
                        );
                    } else {
                        console.log("[BetterPrompt CS] Active element is editable but empty or whitespace. Allowing normal space.");
                    }
                } else {
                    console.log("[BetterPrompt CS] Active element is NOT editable. Allowing normal space.");
                }
            }
        }
        // 如果不是三击，则不阻止默认行为，允许输入单个空格
    } else {
        // 如果按下的不是空格键，重置空格记录
        if (spacePressTimes.length > 0) {
            // console.log("[BetterPrompt CS] Non-space key pressed. Resetting space timestamps."); // 频繁，可选
            spacePressTimes = [];
        }
    }
}

function isActiveElementEditable(element) {
    // ... (函数内部不需要加太多日志，除非调试这个函数本身)
    if (!element) {
        // console.log("[BetterPrompt CS] isActiveElementEditable: Element is null.");
        return false;
    }
    const isEditable = (
        (element.tagName === 'TEXTAREA' || (element.tagName === 'INPUT' && /^(text|search|url|tel|email|password|number)$/i.test(element.type || 'text'))) && !element.disabled && !element.readOnly
    ) || element.isContentEditable || element.ownerDocument?.designMode === 'on';

    // console.log(`[BetterPrompt CS] isActiveElementEditable check for ${element.tagName}: ${isEditable}`);
    return isEditable;
}

function getElementText(element) {
    // ... (函数内部不需要加太多日志)
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        return element.value;
    } else if (element.isContentEditable) {
        return element.textContent;
    }
    return null;
}

function setElementText(element, text) {
    console.log(`[BetterPrompt CS] Setting text for ${element.tagName}:`, text.substring(0, 50) + "...");

    try {
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            // 直接设置值是最可靠的方法
            element.value = text;

            // 触发input事件，使得网站的监听器能够感知到值的变化
            const inputEvent = new Event('input', { bubbles: true });
            element.dispatchEvent(inputEvent);

            // 触发change事件
            const changeEvent = new Event('change', { bubbles: true });
            element.dispatchEvent(changeEvent);

            // 确保获得焦点
            element.focus();
        } else if (element.isContentEditable) {
            // 对于富文本编辑器，先清空内容
            element.focus();
            element.innerHTML = '';

            // 然后尝试使用execCommand插入文本
            const success = document.execCommand('insertText', false, text);

            // 如果失败，回退到设置textContent
            if (!success || element.textContent !== text) {
                console.log("[BetterPrompt CS] Using fallback method for contentEditable element");
                element.textContent = text;

                // 触发input事件
                const inputEvent = new Event('input', { bubbles: true });
                element.dispatchEvent(inputEvent);
            }
        }
    } catch (error) {
        console.error("[BetterPrompt CS] Error setting element text:", error);

        // 最后的回退方法 - 直接赋值
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            element.value = text;
        } else if (element.isContentEditable) {
            element.textContent = text;
        }
    }
}

function moveCursorToEnd(element) {
    // console.log(`[BetterPrompt CS] Moving cursor to end for ${element.tagName}`); // 可选
    // ... (内部逻辑日志可选)
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        element.selectionStart = element.selectionEnd = element.value.length;
    } else if (element.isContentEditable) {
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(element);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }
}