# 按设计 skills 进行的 UI 审计与改进

2026-09-27 · 工作分支 `fix/ui-interaction-audit` · UI issue #253 / draft PR #251

[打开前后对照页](e2e-evidence/reference-improvement/index.html) · 可切换手机/桌面 Chat 与 Work Room。

## 本轮结论

最明显的问题来自信息层级、重复状态和空间分配。图标本身不是主要原因。本轮先改善聊天、Work Room 和导航，保留真实内容、审批和权限边界。

独立 **AI** 审阅经过多轮截图批评和生产构建复查：本轮阅读密度、层级、文件来源表达与已检查的恢复路径通过；普通聊天的结构化交付物呈现仍需补充数据契约。功能验证和视觉结论分别记录，不能据此称整个产品已经达到生产级验收。

## 依据与范围

- 使用 `oo-chat-product-design` 和 `frontend-ui-verify`；参照维护中的 [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)。
- 实际查看 P04 [Raycast 桌面聊天演示](../.agents/skills/oo-chat-product-design/references/images/raycast-chat.png)：学习过程摘要与具体结果的主次关系。
- 实际查看 P02 [Linear 导航局部对比](../.agents/skills/oo-chat-product-design/references/images/linear-nav.png)：学习单一选中态、非当前信息弱化和一致的间距。
- 原始来源、日期、截图类型和限制见 [sources.json](../.agents/skills/oo-chat-product-design/references/sources.json)。P04 是理想短对话的宣传演示，P02 是局部裁图，不能证明它们在审批、长内容、触控或错误状态中的行为。
- 当前仍缺少完整外部手机长结果参考。手机整屏是否达到外部参考水准：**证据不足**；以下手机判断依据 O Chat 产品标准和真实浏览器检查。
- 本轮修改 UI，不改变发现、身份、授权和传输协议。Explore / 首次使用同时做回归复查，目录功能与布局未重做。

## 十个问题与落实的改变

| 问题 | 对应原则 | 本轮改变 |
| --- | --- | --- |
| 完成计划固定占据顶部约一行，持续挤压结果 | 当前任务优先，历史按需查看 | 完成计划进入可滚动记录；运行中的计划留在顶部；所有状态和优先级仍可展开 |
| 回答和下方元数据较长时，滚动到底会裁掉阅读起点 | 稳定、连续地阅读结果 | 为完成回答保留开头；既覆盖长回答，也覆盖短回答后附较多记录的情况 |
| 自动定位到当前结果时仍显示 Latest，另占一行 | 控制要符合当前操作需要 | 阅读当前结果时不显示；向上查看历史后恢复；按钮仍位于文字外 |
| 侧栏、桌面标题和每条回复重复头像，正文对齐分散 | 减少重复装饰，统一阅读轴线 | 保留 Agent 身份和品牌，去掉标题与正文中的重复头像；正文与输入区对齐，15px 正文保持可读 |
| Agent 和会话同时高亮，单会话侧栏占 288px | 一个明确当前位置 | 桌面侧栏改为 256px，手机抽屉仍为 288px；会话有单一选中态、`aria-current` 和完整标题提示 |
| SDK 版本占常驻导航位置 | 任务导航优先，技术信息可查 | 版本链接移至 Settings / About；键盘焦点循环随新顺序验证 |
| Work Room 灰色原请求块比最新结果更重 | 结果先于背景 | 最新回答有清楚标题；完成后的原请求收为单行披露，历史仍可展开 |
| 文件记录藏在执行详情中，结果缺少实质 | 展示真实证据和来源 | 展示本次运行报告的文件变化，注明来自 provider 活动记录；只用 typed、done 的 file_change；三项后可展开 |
| Work Room 输入框与工具条分两行，空白占位多 | 相关输入动作紧邻，保护正文空间 | 输入与语音/发送在同一行；多行文本和不可用原因自动增高，保留权限及审批入口 |
| 结果不能直接带走，复制缺乏反馈 | 后续使用和恢复也是设计的一部分 | 普通聊天和完成的 Work Room 支持复制原始回答；成功、失败及重试有明确反馈 |

另修复一个来源错误：新请求尚无回复时，历史回答不能被标为“Latest result”，也不能附上新一轮的文件记录。

最终补查中还复现了主动追加回复的滚动回归：读者停留在上一条完成结果时，新回复没有恢复 Latest。修复后仅恢复跳转入口，保持阅读位置；新测试先在旧实现失败，再在生产构建通过。

## 同场景证据

基线来自 `d3d1c91` 的应用代码；当时只有 skills/docs 在工作区修改。第一轮采用 Next dev；最终复验采用 `npm run build` 后的 `next start -p 3335`。浏览器是 Chromium，100% 缩放，浅色主题，受控公开测试资料。

| 场景 | 修改前 | 第一轮 | 最终生产构建 |
| --- | --- | --- | --- |
| 完成长结果 · 390×667 | [before](e2e-evidence/reference-improvement/before/completed-work-has-a-clear-reading-surface-at-390x667--completed.png) | [iteration 1](e2e-evidence/reference-improvement/iteration-1/completed-work-has-a-clear-reading-surface-at-390x667--completed.png) | [production](e2e-evidence/reference-improvement/production/completed-work-has-a-clear-reading-surface-at-390x667--completed.png) |
| 完成长结果 · 768×1024 | [before](e2e-evidence/reference-improvement/before/completed-work-has-a-clear-reading-surface-at-768x1024--completed.png) | [iteration 1](e2e-evidence/reference-improvement/iteration-1/completed-work-has-a-clear-reading-surface-at-768x1024--completed.png) | [production](e2e-evidence/reference-improvement/production/completed-work-has-a-clear-reading-surface-at-768x1024--completed.png) |
| 完成长结果 · 1440×900 | [before](e2e-evidence/reference-improvement/before/completed-work-has-a-clear-reading-surface-at-1440x900--completed.png) | [iteration 1](e2e-evidence/reference-improvement/iteration-1/completed-work-has-a-clear-reading-surface-at-1440x900--completed.png) | [production](e2e-evidence/reference-improvement/production/completed-work-has-a-clear-reading-surface-at-1440x900--completed.png) |
| Work Room · 390×844 | [before](e2e-evidence/reference-improvement/before/work-room-prioritises-the-result-at-390px--completed-workroom.png) | [iteration 1](e2e-evidence/reference-improvement/iteration-1/work-room-prioritises-the-result-at-390px--completed-workroom.png) | [production](e2e-evidence/reference-improvement/production/work-room-prioritises-the-result-at-390px--completed-workroom.png) |
| Work Room · 1440×900 | [before](e2e-evidence/reference-improvement/before/work-room-prioritises-the-result-at-1440px--completed-workroom.png) | [iteration 1](e2e-evidence/reference-improvement/iteration-1/work-room-prioritises-the-result-at-1440px--completed-workroom.png) | [production](e2e-evidence/reference-improvement/production/work-room-prioritises-the-result-at-1440px--completed-workroom.png) |

另外验证了 [1280×720](e2e-evidence/reference-improvement/production/completed-work-has-a-clear-reading-surface-at-1280x720--completed.png)、390×844、流式增长、手机审批、语音失败、多 Agent 导航、Explore 与设置。

**数据可比性说明：** 普通聊天的提示、工具数量、正文和 Full access 状态没有修改。Work Room 的旧 mock 长请求错误地写了 ring buffer，但 taskSummary 和活动一直是 sort.c / test_sort.c；修正为同样多条要求的长排序任务。最终样例的折叠原请求文本因此有变化，回复和文件记录没有改变。此前版本的图片保留供检查，不把这次测试数据修正当成视觉改进。文件区陈述 provider 的报告，不证明实际工作满足请求。

## 三问

| 问题 | 结论与证据 |
| --- | --- |
| 是否达到预期效果？ | 达到本轮阅读与主次目标。390×667 中结果标题、说明、使用命令和权限入口可同时看见；Work Room 结果先于请求，文件记录有来源。 |
| 是否达到参考相关水准？ | 导航的安静度和结果优先层级已有接近。P04 的可定位交付物仍超出普通 Markdown 回答的当前数据能力；完整手机外部比较为证据不足。 |
| 最大差距在哪里？ | 普通聊天仍只有 prose 中的项目名、命令。缺少与任务/版本关联的 artifact 身份、类型、有效目标及后续操作；应扩展契约，而非从加粗文字猜造下载卡。计划与已完成活动也仍有两个入口，可在建立可靠的任务关联后进一步整合。 |

## 独立 AI 批评与迭代

审阅者 `design_audit` 查看实际本地图片，不是人类设计师或外部机构验收。

| 迭代 | 批评 | 处理与复审 |
| --- | --- | --- |
| Baseline | 结果弱、原请求过重、完成状态重复、小屏可读区紧、侧栏双高亮 | 结论 REVISE；据此实施上方十项改变 |
| Iteration 1 | 密度已有改善；普通 Chat 产物身份仍弱；文件名与长请求不一致 | UI 密度局部通过；文件展示补上报告来源，限制为本轮完成记录；增加多文件与旧回答边界测试 |
| 最终候选 | 阅读层级和来源表达通过；手机 disabled 提示截字；语音失败图有开发 Issue 浮层 | 输入自动增高；最终改用生产构建截图；修正已有 mock 错配。结构化产物契约仍为 REVISE |
| Production | 审批次级 explanation 在短屏初始视口下方 | 补拍键盘展开、滚动与点击命中证据；独立 AI 确认可达。主结果、Work Room、语音恢复、审批局部通过 |
| 最后滚动补查 | 新增回复应提示但不能打断阅读 | 复现后修复，15 项定向检查通过；独立 AI 查看跳转前后两图，确认 Latest 不遮文字、回复可读 |

## 验证

- `npm run build`：通过。
- `npx --no-install tsc --noEmit`：通过。
- `npm test`：30 个文件、216 项测试通过。
- `npm run lint`：0 errors，7 个既有 warnings（图片、SDK effect cleanup 与 live helper）。
- 迭代中的 61 项浏览器检查通过；第二轮 40 项检查通过。
- 生产构建全套 `E2E_BASE_URL=http://localhost:3335 E2E_SHOTS_DIR=docs/e2e-evidence/reference-improvement/production npx --no-install playwright test`：**240/240 通过**。
- 随后补充审批可达检查：1 项通过。最后滚动边界修复后重新构建并运行 `e2e/density-review.spec.ts e2e/scroll-follow.spec.ts`：**15/15 通过**，含新增连续回复场景。241 个用例有成功覆盖，但没有把这些分次运行描述成一次 241 项全套通过。

新增检查关注：完成计划随正文滚动；结果开头与使用方式可读；返回历史后 Latest 可用；复制成功/失败；文件证据去重与来源边界；续接无回复时保留真实语义；审批提示不被截断。

关键恢复证据：

- [审批初始视口](e2e-evidence/reference-improvement/production/the-compact-native-approval-stays-readable-and-reachable-at-375px--codex-c-sort-approval-workroom-phone.png)与[滚动后的 explanation](e2e-evidence/reference-improvement/production/the-compact-native-approval-stays-readable-and-reachable-at-375px--codex-c-sort-approval-explanation-phone.png)：375×667 先呈现允许/拒绝两个主要操作，次级选项需滚动；键盘展开与点击命中通过。
- [语音失败与保留的草稿](e2e-evidence/reference-improvement/production/work-room-voice-failure-preserves-the-provider-draft-and-never-reaches-the-outer--codex-workroom-voice-error-draft-preserved-mobile.png)：生产构建没有开发 Issue 浮层。
- [有后续回复时的 Latest](e2e-evidence/reference-improvement/production/a-later-response-offers-latest-without-dragging-a-reader-away-from-the-completed--later-result-unread.png)与[跳转后的回复](e2e-evidence/reference-improvement/production/a-later-response-offers-latest-without-dragging-a-reader-away-from-the-completed--later-result.png)。
- [双 Agent 导航](e2e-evidence/reference-improvement/production/a-conversation-stays-under-the-agent-that-had-it--drawer.png)与[连续操作流程](e2e-evidence/reference-improvement/production/pr-release-evidence-invite-prompt-modes-and-control-center--complete-flow.png)。

保留的图片及哈希、构建标识、源文件摘要见 [evidence.json](e2e-evidence/reference-improvement/evidence.json)。

本轮是 UI 与受控浏览器验收。没有重新运行真实 Host/原生 provider 的整套发布验收，也没有部署。完整 WCAG 审计和跨浏览器发布验收不在本轮结论内。
