# 按设计 skills 进行的 UI 审计与改进

2026-09-28 · 工作分支 `fix/ui-interaction-audit` · UI issue #253 / PR #251

[打开前后对照页](e2e-evidence/reference-improvement/index.html) · 可切换手机/桌面 Chat 与 Work Room。

## 本轮结论

最明显的问题来自信息层级、重复状态和空间分配。图标本身不是主要原因。本轮先改善聊天、Work Room 和导航，保留真实内容、审批和权限边界。

**2026-09-28 实施后复审：本次构图改动 PASS。** 用户指出画面仍然很忙后，先把旧图结论修正为 REVISE，再实施下方十项修正。新的生产构建截图经过两轮独立 AI 批评与复查；功能验证和视觉判断分别记录。此结论仅覆盖改动场景，不表示整个产品已经达到最高设计水准。

## 本次修复与发布候选

应用提交：`b9162d3864a9e6c31fb2043d199c33a6c4f1d9a7`。基线：`8d5ada9b90e67291622dbb1c31a1c10149b4523f`。基线和本次四个主要场景使用相同任务、回答、文件记录及视口。

1. Chat 完成步骤、完成计划与明确标注的 Session usage 收在结果下方的一个 **Task details**；复制在同一行，展开后仍使用完整阅读列。
2. Work Room 成为有明确 Back 入口的完整工作面，背景聊天和第二个输入框不再争抢注意。
3. 已完成任务的原请求、此前回复、执行记录合入一个 **Task details**，审批仍直接展示。
4. 顶栏放 provider、当前状态与具名权限；完整任务标题移到正文开头，手机不再截成 “Build and …”。
5. Chat 权限与剩余次数移到输入框下方的紧凑行；保留 amber 提示和 **Exit Full access**。
6. 真实回复和 provider 报告的文件放在同一结果区；不把文件路径伪装成下载或已验证产物。
7. 顶层详情入口统一为左侧 disclosure 箭头；复制作为相邻动作。
8. 结果、记录、输入使用一致阅读列，减少横跨全屏的重复分隔线。
9. 侧栏每个 Agent 保留一个在线点，去掉重复在线文字和单会话计数；单会话仍直接可达。
10. 手机使用低权重文字页签，Work Room 手机输入区不显示桌面键盘提示；保留可访问名称、焦点和触控范围。

### AI 批评 / 修改 / 复审

| 阶段 | 具体批评或发现 | 处理及结论 |
| --- | --- | --- |
| 旧图复审 | 完成步骤、计划、用量碎片化；背景聊天与 Work Room 并列；原请求/历史/执行各占区域 | REVISE；下方保留完整十项发现 |
| 第一轮 | 分组改善，但手机任务标题被权限挤成短截字；结果缺少清楚的任务入口 | REVISE；任务成为正文完整标题，权限收为具名紧凑控件，复制/详情共用动作行 |
| 第二轮 | 任务→真实结果→报告文件→详情/复制→输入次序清楚；完整任务与权限同时可见 | 本次构图 PASS；审批、语音失败及真实 touch 操作补查 |
| 最终生产构建 | 独立 AI `source_audit` 查看四张主图、touch、375px 审批与完整流程；四张主图与第二轮逐字节一致 | 维持本次构图 PASS；不是人类设计师或外部机构认证 |

**三个比较问题：** 预期的连贯、安静阅读路径已达到；P01 Linear 的桌面角色分区、P04 Raycast 的过程附属于回答等局部机制已接近。完整手机长结果没有匹配的外部参考，整屏比较仍为**证据不足**。剩余差距：真实回复较短时桌面 Work Room 空白较多；390×667 Chat 顶部略露上一条消息边缘。不能通过伪造内容填充空白。

### 本次验证

- `npm run build`、`npx --no-install tsc --noEmit`：通过。
- `npm run lint`：0 errors、7 个既有 warnings。
- `npm test`：**31 个文件、230/230 通过**。
- 生产构建完整 Playwright：**254/254 通过**（3.6 分钟）。包含手机/平板/桌面、实际 touch tap、详情与权限菜单、审批、Stop、滚动与 Latest、复制恢复、语音失败、重连以及 Wiki 回归。
- 浏览器证据使用受控公开测试资料；这里的 `production` 指 `next build` + `next start`，不代表已经部署线上。
- 实际 Host / 原生 provider 发布验收和 Vercel 上线结果在发布流程完成后单独记录；不能由这组 mock 检查推定。

[新旧对照页](e2e-evidence/reference-improvement/index.html) · [本次截图及 SHA-256 / 构建信息](e2e-evidence/composition/evidence.json)。

## 历史记录：修复前整体构图 REVISE

以下记录用户反馈时的原始截图问题，作为上方修复的依据。此前把阅读位置、控件可达、文件来源等局部改善过度延伸为整体层级通过；功能验证不能替代视觉验收。

## 2026-09-28：为什么仍然显得忙

本次直接查看对照页使用的四张原始 PNG：390×667 手机 Chat、1440×900 桌面 Chat、390×844 手机 Work Room、1440×900 桌面 Work Room。没有新运行应用或重新截图。另由独立 **AI** 审阅者 `source_audit` 直接查看同样的四张图，结论为 **REVISE**。本次只记录分析与修订验收结论。

手机 Chat 的正文可读，最大问题在桌面 Chat 和两个 Work Room 画面。空白主要落在内容之外，而实际阅读路径被标签、分隔线、状态和控制项反复切开。一项功能一块区域的叠加方式，使同一个任务被看成许多并列事项。

| 优先顺序 | 截图中的具体问题 | 用户代价与改动方向 |
| --- | --- | --- |
| 1 | 桌面 Chat 的 `12 completed steps`、`Plan complete 2/2`、`Session usage $0.04` 各占一个独立入口 | 同一次工作需要跨多个位置理解。将有关联的完成活动、计划与用量放入一个可检查的记录区域，保留各自语义；权限继续留在输入区。 |
| 2 | Work Room 在原聊天之上再开一套标题、内容、输入框；背景仍清楚可辨 | 两个工作界面同时争夺注意。让 Work Room 成为一个聚焦的工作面，并明确返回关系。背景还能看见 `Working`，当前面板却写 `Codex · Completed`；即使属于不同范围，也需要清楚区分。 |
| 3 | Work Room 的 `Your request`、`Earlier conversation (3)`、`Execution details` 分成三个相距较远的条目 | 用户先要理解产品如何分类记录。合为一个 Details 入口，展开后保留请求、对话与执行的清楚分组；待审批决定不能藏进去。 |
| 4 | 手机 Work Room 的长标题、provider 状态和整行权限框占满约 152px 顶部 | 短结果也需要在多个控件之后才能开始读。标题采用可识别的短名称，完整请求保留可查；权限做紧凑、具名、可操作的控件。 |
| 5 | Chat 输入框同时包含外框、多个工具图标、灰底发送按钮和整条黄色 Full access 区域 | 常驻权限提示形成另一块强视觉区域。将权限状态、剩余次数和退出入口组织成一个紧凑行；保留清楚的警示色、标签和退出操作。 |
| 6 | Work Room 的结果只有一句测试通过，周围却有结果标题、文件数、来源说明、文件列表与复制行 | 辅助说明比实际产出更有存在感。把真实结果、报告的文件和有效下一步组成一个结果区；现有文件名只是 provider 报告，不能伪造打开或下载能力。 |
| 7 | Work Room 折叠入口混用右侧细箭头、左侧细箭头和左侧实心三角 | 相同类型的交互需要重新辨认。统一箭头位置、展开方向、基线、间距和点击范围。 |
| 8 | Work Room 文件行的分隔线较短，下面请求、历史、执行区域横跨大部分面板 | 缺少统一阅读列，短内容与长边界反复切换。统一内容和辅助记录的宽度、对齐与组内间距。 |
| 9 | 桌面侧栏只有一个 Agent 和一个会话，仍分别显示 `YOUR AGENTS · 1 ONLINE`、Agent 的 `Online`、`1 conversation` 和会话行 | 为少量内容引入过多导航层级与重复状态。保留 Agent 归属和当前会话，合并重复计数与在线提示。 |
| 10 | 手机 Chat 的 `Control / Chat` 占据顶栏近半宽；Work Room 底部还常驻桌面键盘操作提示 | 次级导航与提示占据稀缺空间。降低 Control 入口的视觉重量；键盘提示按输入设备显示，同时保留可访问名称和触控范围。 |

### 下一轮先改的三件事

1. **把一次任务的记录组织成一个整体。** 完成活动、计划和用量归组，结果成为主阅读区；输入权限与退出仍保持清楚可见。
2. **重组 Work Room。** 一个任务标题、一个结果区、一个 Details 入口、一个输入区；权限独立可见，审批出现时成为主要决定。
3. **统一控制项和空间规则。** 折叠箭头、内容宽度、分隔线、顶部权限与底部输入统一处理，再微调图标与颜色。不要用缩小正文或继续增加空白解决分组问题。

### 对照现有 skills 和参考

- 重新查看 P01 Linear 工作区与 P04 Raycast 对话图。可迁移的机制是让导航、工作内容和辅助状态有稳定关系；当前 O Chat 的结果周围仍散落多个同级入口。
- 预期效果：**部分达到**，结果更容易读到，但整屏尚未安静、连贯。相关构图完成度：**REVISE**。
- 本库仍没有匹配的完整手机长结果参考，手机整屏外部水准比较继续为**证据不足**；上述手机问题直接来自 O Chat 截图和自身产品原则。
- 本次是静态截图复审，未重新验证交互。下一轮需用相同数据与视口重拍，并重新检查审批、权限、长内容与键盘展开后的布局。

## 上一轮实施与验证记录

以下保留 2026-09-27 的局部改善和验证结果；其中原有视觉通过判断由上方整体构图复审补充、更正。

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
