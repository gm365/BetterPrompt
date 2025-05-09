# BetterPrompt

## 项目描述

**简述:** BetterPrompt 是一款 Chrome 插件，利用 Google Gemini API 帮助用户优化、改写和增强 Prompt，支持通过便捷的快捷键在网页内联优化，或使用专门的优化器页面进行更精细的调整。

**详细描述:** 无论您是在与 ChatGPT、Claude 还是其他 AI 模型交互，BetterPrompt 都能提升您的 Prompt 工程效率。遇到不够理想的 Prompt 时，只需在输入完毕后，连续按下三次空格，即可调用 Gemini API 进行智能优化。此外，插件还提供了一个独立的"Prompt 优化器"页面，您可以输入或粘贴 Prompt，选择不同的优化策略（如简洁化、详细化）和 Gemini 模型（Flash Lite 或 Flash），生成更高质量的提示词。BetterPrompt 旨在简化 Prompt 优化流程，激发更多创意可能。

**🎉 好消息！独立优化器网站已上线！🎉**

现在，您除了可以使用 Chrome 插件外，还可以直接访问我们的独立网站 [https://bp.upsui.com/](https://bp.upsui.com/) 在线优化您的 Prompt！无需下载和安装任何插件，直接在网页上即可体验便捷的 Prompt 优化服务。


![BetterPrompt 独立网站](/images/website.avif)

*上图为BetterPrompt 独立网站截图



**目标用户:**
*   经常使用 ChatGPT、Claude、Gemini 等大型语言模型的用户。
*   希望快速优化和改进现有 Prompt 的内容创作者、开发者、研究人员和学生。
*   需要根据不同场景调整 Prompt 风格（简洁/详细）的用户。

## 特性

*   **🚀 内联 Prompt 优化:** 在任何网页的可编辑区域输入文字，连续快速按下**三次空格**即可快速调用 Gemini API 优化当前的 Prompt。
*   **💡 专门优化器页面:** 提供一个独立的界面，用于输入、优化和比较不同版本的 Prompt。
*   **🧠 Gemini API 驱动:** 利用强大的 Google Gemini 模型进行 Prompt 改写和增强。
*   **⚙️ 多种优化风格:** 支持预设的优化模式（默认、简洁、详细）以及自定义系统提示词。
*   **⚡ 模型选择:** 可在 `Gemini Flash Lite` (速度快) 和 `Gemini Flash` (质量更好) 模型之间切换。
*   **🔑 API 密钥管理:** 在插件弹出窗口中安全地配置和管理您的 Gemini API 密钥。
*   **🖱️ 简洁弹出菜单:** 快速访问 API 密钥设置、默认提示模板类型和模型选择。

## 安装

请按照以下步骤安装 BetterPrompt 插件：

1.  **下载:** 从本 GitHub 仓库下载最新的插件源代码。您可以点击页面右上角的 `Code` 按钮，然后选择 `Download ZIP`。下载后请解压该 ZIP 文件。
2.  **加载到 Chrome:**
    *   打开 Chrome 浏览器，在地址栏输入 `chrome://extensions/` 并按回车键。
    *   确保页面右上角的 **开发者模式 (Developer mode)** 开关已启用。
    *   点击左上角的 **加载已解压的扩展程序 (Load unpacked)** 按钮。
    *   在弹出的文件选择窗口中，找到并选择您刚才解压的插件文件夹 (包含 `manifest.json` 文件的那个文件夹)。
3.  **配置 API 密钥:**
    *   点击 Chrome 工具栏上的 BetterPrompt 图标。
    *   在弹出的窗口中，输入您的 Google Gemini API 密钥。您可以点击旁边的链接获取密钥。
    *   **重要:** 没有配置有效的 API 密钥，插件将无法工作。
4.  **完成:** BetterPrompt 图标现在应该会出现在您的 Chrome 工具栏中。

**所需权限:**

BetterPrompt 需要以下权限才能正常工作：

*   `storage`: 用于在本地安全地存储您的 Gemini API 密钥和插件设置（如选择的模型、提示类型）。
*   `scripting` 或 `activeTab`: 用于在您触发快捷键时，读取您在当前页面输入的文本，并将优化后的文本写回页面。

*请注意：我们承诺仅申请必要的权限，并保护您的数据安全。您的 API 密钥仅存储在本地。*

*依赖项：建议使用最新稳定版的 Chrome 浏览器以获得最佳体验。*

## 使用方法

**1. 内联优化 (快捷键):**

*   在任何网页上的文本框、输入框或可编辑区域 (如 ChatGPT 输入框、Google Docs 等) 中，输入您想要优化的文本。
*   在当前文本输入框的位置，快速**连续按下三次空格键** (`空格` `空格` `空格`)。
*   插件将自动调用 Gemini API 对当前输入文本进行优化，并在完成后替换原文。优化过程中，输入框可能会短暂变暗或禁用。

**2. 插件弹出窗口 (设置):**

*   点击 Chrome 工具栏上的 BetterPrompt 图标。
*   在此处：
    *   **配置 Gemini API 密钥:** 输入或更新您的 API 密钥。
    *   **选择默认提示模板类型:** 选择优化时默认使用的系统提示风格（默认、简洁、详细或您设置的自定义模板）。
    *   **选择 Gemini 模型:** 选择进行优化时使用的模型（Flash Lite 或 Flash）。
    *   **打开 Prompt 优化器页面:** 点击按钮跳转到专门的优化页面。

**3. Prompt 优化器页面:**

*   通过插件弹出窗口中的按钮打开此页面。
*   在"原始 Prompt"文本框中输入或粘贴您想要优化的内容。
*   选择所需的"提示模板类型"和"Gemini 模型"。
*   点击"优化 Prompt"按钮。
*   优化后的结果将显示在"优化后的 Prompt"文本框中。
*   您可以使用"复制"按钮复制代码，或使用"清空"按钮清除文本。

![BetterPrompt 优化效果演示](/images/优化效果.avif)

*上图展示了使用 Prompt 优化器页面优化提示词的效果，可以看到优化前后的明显差异*

![BetterPrompt 优化效果演示2](/images/优化效果2.avif)

*上图展示了使用 Prompt 优化器页面优化提示词："如何高效搜索质数"的效果*



## 贡献

我们热烈欢迎社区的贡献！您可以通过以下方式参与：

*   **报告 Bug:** 如果您在使用过程中发现任何问题，请在 [GitHub Issues](https://github.com/gm365/BetterPrompt/issues) 中详细报告。
*   **提出建议:** 如果您有任何改进建议或新功能想法，也欢迎在 [GitHub Issues](https://github.com/gm365/BetterPrompt/issues) 中提出。
*   **提交代码:** 如果您想直接贡献代码，请先 Fork 本仓库，在您的分支上进行修改，然后提交 Pull Request。我们建议您先在 Issue 中讨论您的想法。

请确保您的贡献遵循项目的代码风格和规范 (如果定义了贡献指南 `CONTRIBUTING.md`，请在此处链接)。

## 许可证

本项目采用 [MIT License](LICENSE) 许可证。这意味着您可以自由地使用、复制、修改、合并、发布、分发、再许可和/或销售本软件的副本，只需遵守许可证中的条款。

## 联系方式

*   GitHub: [@gm365](https://github.com/gm365)
*   Twitter: [@gm365](https://x.com/gm365)

---

希望 BetterPrompt 能为您的 AI 之旅带来便利！
