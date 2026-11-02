# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn

ACCENT = RGBColor(0x2F, 0x54, 0xA3)

def set_font(run, name='微软雅黑', size=None, bold=None, color=None):
    run.font.name = name
    run._element.rPr.rFonts.set(qn('w:eastAsia'), name)
    if size: run.font.size = Pt(size)
    if bold is not None: run.font.bold = bold
    if color is not None: run.font.color.rgb = color

def para(doc, text, size=10.5, bold=False, color=None, space_after=4, indent=0, style=None):
    p = doc.add_paragraph(style=style)
    p.paragraph_format.space_after = Pt(space_after)
    if indent: p.paragraph_format.left_indent = Cm(indent)
    run = p.add_run(text)
    set_font(run, size=size, bold=bold, color=color)
    return p

def heading(doc, text, level=1):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(12 if level == 1 else 8)
    p.paragraph_format.space_after = Pt(5)
    run = p.add_run(text)
    set_font(run, size=15 if level == 1 else 12, bold=True, color=ACCENT)
    return p

def bullets(doc, items, numbered=False, indent=0.4):
    for i, t in enumerate(items, 1):
        para(doc, (f"{i}. " if numbered else "• ") + t, indent=indent)

def make_table(doc, headers, rows, widths=None):
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = 'Table Grid'
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, h in enumerate(headers):
        r = t.rows[0].cells[i].paragraphs[0].add_run(h)
        set_font(r, size=9.5, bold=True)
    for row in rows:
        cells = t.add_row().cells
        for i, v in enumerate(row):
            r = cells[i].paragraphs[0].add_run(v)
            set_font(r, size=9)
    return t

doc = Document()
for s in doc.sections:
    s.left_margin = Cm(2.0); s.right_margin = Cm(2.0)
    s.top_margin = Cm(2.0); s.bottom_margin = Cm(1.8)
st = doc.styles['Normal']
st.font.name = '微软雅黑'
st._element.rPr.rFonts.set(qn('w:eastAsia'), '微软雅黑')
st.font.size = Pt(10.5)

t = doc.add_paragraph(); t.alignment = WD_ALIGN_PARAGRAPH.CENTER
set_font(t.add_run('机鉴 · 数码产品行情与避坑决策平台'), size=20, bold=True)
sub = doc.add_paragraph(); sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
set_font(sub.add_run('2026 软工实践周参赛项目介绍 · 讨论稿 v0.10'), size=10, color=RGBColor(0x66,0x66,0x66))
sub2 = doc.add_paragraph(); sub2.alignment = WD_ALIGN_PARAGRAPH.CENTER
set_font(sub2.add_run('v0.9 变更：部署主线=学生券 0 元 ECS（2核4G 杭州 1 个月）｜http://IP:3000 体验链接｜流量 0.8元/GB 控量'), size=8.5, color=RGBColor(0x88,0x88,0x88))

heading(doc, '零、时间线（本周赛程，硬约束）')
bullets(doc, [
 '今天周一 11-02：定稿分工，当天开工。',
 '周四 11-05 12:00：提交系统关闭作品基本信息修改（作品名/简介/主题/海报等），必须上午填完保存；代码/视频/体验链接之后仍可迭代。',
 '周五 11-06 全天：现场答辩，每组 8 分钟汇报 + 2 分钟提问，全员到场。',
 '开发窗口 ≈ 3.5 天，目标定位：B 级完整——架构与功能完整呈现、手机品类真数据真功能全链路、其余品类真页面浅数据 + 扩展规划。',
], numbered=True)

heading(doc, '零点五、仓库与协作模式（定稿）')
bullets(doc, [
 'GitHub 主仓：https://github.com/xcr2795576719-dot/hackathon-competition',
 'Gitee 镜像仓：https://gitee.com/its-a-shame/hackathon-competition（提交系统填此链接，README 双向互链）',
 'git remote 双 push：每晚 21:00 由队长同步一次',
 '数据更新与网站后期维护负责人：队长本人',
 '开发模式：任务书派发 + 三泳道接力制。泳道 1 前端（2 人接力：行情页→验机页→报告页）；泳道 2 后端+数据（2 人接力：API+JSON 存储→采集入库→估价引擎）；泳道 3 AI 工程（1 人：识机→报告→知识库 RAG）。泳道内甲编码乙验收、中段换防；泳道间目录隔离。',
 '队长 = 集成者：不编码，专责契约维护（packages/shared 唯一写者）、每晚 21:00 合并、验收终审、任务书派发。',
], numbered=True)

heading(doc, '一、一句话定位')
para(doc, '覆盖多品类数码产品的一站式决策平台：查行情（新机/二手价格与走势）→ 拍照验机（识型号、评成色、标瑕疵）→ AI 读遍全网评测 → 一页报告告诉你「这台机器现在买值不值、有没有坑」。', bold=True)

heading(doc, '二、为什么做（痛点）')
bullets(doc, [
 '新机比价信息分散：各平台价格不同、历史价无从查，「先涨后降」防不胜防。',
 '二手市场水深：翻新机、扩容机、组装机、配件调包，普通人看不出来。',
 '评测信息过载：几百篇评测、上万条评论，没人看得完，看完也理不出结论。',
 '决策链断裂：比价、验机、看评测要在 5 个应用之间来回跳。',
 '「机鉴」把这条链收进一个网站：行情 → 验真 → 口碑 → 结论，全程 3 分钟。',
], numbered=True)

heading(doc, '三、数据策略（v0.2 重构：全部走获奖作品验证过的路线）')
para(doc, '依据：对 iWiki 两届 17 个获奖作品的拆解显示，没有一个项目在爬电商多平台价格。获奖作品的数据路线是四种：用户上传即数据（Posturefit/智契）、官方开放 API（TripMate 的高德/和风）、LLM 自产数据（Interview.ai）、清晰的种子/模拟数据集（EcoChic，三等奖）。机鉴照此重构。', size=9.5, color=RGBColor(0x55,0x55,0x55))
bullets(doc, [
 '验机照片：用户上传即数据——拍照识机天然零采集成本，与一等奖 Posturefit 同构。',
 '新机现价：人工回溯 + 每日手动刷新为主（6 机型历史价从慢慢买等工具查询录入，半天完成）；京东联盟 API（审核中）与无登录京东自动爬虫为加分增强，不在关键路径。',
 '新机历史价：仅对 6 个演示机型做 30 天人工回溯录入（1 平台），不贪多平台。',
 '二手价格：「用户提交报价」做成产品功能（众包表单：平台/机型/内存/成色/价格/截图）+ 团队预采 200 条种子数据。答辩叙事 =「可持续的价格数据机制 + 冷启动种子集」。',
 '测评内容：知乎 CLI 开放能力——知乎搜索 + 全网搜索 + 知乎直答（检索生成一体、流式输出），Tavily/博查备用；结论附来源链接可溯源。',
 '避坑知识库与评测语料：知乎 CLI 知识库能力——文件上传 + RAG 检索，报告引用直接走 RAG。',
 '半自动采集器（技术亮点，内部工具）：油猴/控制台脚本——持号人（2~3 个闲鱼小号轮换，无需人手一个）登录后打开目标机型搜索页，脚本自动滚动抽取结构化数据导出 CSV；人工触发+自动采集，限频；不做全自动登录态爬虫上线产品。',
 '多平台对比降级为「1 个官方 API 实时价 + 众包二手价带」，不做全平台爬虫——这是 v0.2 最大的策略变更。',
], numbered=True)

heading(doc, '四、LLM 接入方案（OpenAI 兼容，可插拔）')
bullets(doc, [
 '文本主力：看山工作台 800 美元积分（技术指南确认，报名账号登录领取）+ 知乎直答（CLI 自带检索生成，有每日额度，额度查询接口管理预算）；DeepSeek API（几十元级）兜底。',
 '视觉识机：GLM-4V-Flash（官方文档原文「完全免费的图像理解模型」，2026-11-02 查证）；文本备选阿里云百炼新人免费额度（90 天，需实名）；DeepSeek 按量付费兜底。探测脚本 test_model_apis.py 拿 key 后一键实测。',
 '工具链：安装 zhihu-cli skill（发给 Agent 即完成接入）+ 创建数据开放平台 Access Secret；看山工作台桌面端用报名账号登录领积分；扣子 Coze 为备胎。',
 '工程设计：后端统一 OpenAI 兼容适配层，换供应商 = 改 base_url + key，答辩话术「模型可插拔」（Tech 加分项）。',
 '演示双通道：6 个演示机型的报告全部预生成缓存秒开 + 现场实时跑一次证明链路真实。',
], numbered=True)

heading(doc, '五、覆盖品类（分类频道）')
make_table(doc, ['品类', '本周实现深度', '备注'], [
 ('手机', '全功能：行情+验机+测评+报告', '首发主打、演示主线'),
 ('耳机（TWS/头戴）', '频道壳：页面+参数+验真知识条目', '序列号/弹窗验真是高频痛点'),
 ('笔记本电脑', '频道壳', '学生党二手需求强'),
 ('平板', '频道壳', '与手机共用验机逻辑'),
 ('相机与镜头', '频道壳', '快门数/霉斑知识条目'),
 ('智能手表/手环', '频道壳', '与手机同链路'),
 ('游戏设备', '频道壳', '矿卡避坑话题'),
])
para(doc, '答辩话术：「手机品类全量实现，其余品类框架就绪、数据渐进接入」——诚实且成立。', size=9.5)
heading(doc, '六大演示机型（v0.4 定稿，覆盖 1k~5k 价位段与三大系统）', 2)
bullets(doc, [
 'iPhone 13 128G——二手流通量第一，新手买家最多，价格带最宽。',
 'iPhone 14 Pro 256G——高价值机型、翻新重灾区，「避坑」演示价值最大。',
 '华为 Mate 60 Pro——国产高端，供需波动大、溢价话题强。',
 '小米 14——安卓旗舰代表，价格衰减曲线清晰。',
 'Redmi K70——学生党主力机，覆盖千元价位段。',
 '一加 Ace 3——中端性价比、次新机代表。',
 '每机型需：京东详情页链接（队长汇总）、慢慢买历史价、二手采样 40~60 条、评测报告预生成。',
], numbered=True)

heading(doc, '六、核心功能')
bullets(doc, [
 'A. 行情中心：新机官方 API 现价 + 6 机型历史走势 + 二手众包价格带散点（按成色分层）。',
 'B. AI 验机：拍照上传 → 识型号/版本（置信度）→ 成色评分 0-100 → 瑕疵标注框 → 翻新风险点 → 「验机卡」可分享。',
 'C. AI 测评聚合：搜索 API 检索 → 大模型结构化摘要（优点/缺点/翻车案例/适合人群）→ 结论附来源链接。',
 'D. 决策报告：行情 + 验机 + 测评三合一 → 「价格位置 / 这台有没有坑 / 全网怎么说 / 买或等或换」一页结论。',
 'E. 众包报价：用户提交二手报价表单，入库后反哺价格带（v0.2 从 P2 提为核心功能，它是数据策略的支柱）。',
 'F. 避坑知识库：按品类沉淀翻新/扩容/调包/序列号验证知识条目，报告引用。',
])

heading(doc, '六点五、产品形态')
para(doc, '响应式 Web 网站（浏览器访问、无需安装），手机浏览器可直调摄像头拍照识机。理由：AI Works 部署约束、评委点开链接即用、答辩投屏演示直接。不做桌面客户端。', bold=True)

heading(doc, '七、用户旅程')
para(doc, '选品类 → 选机型 → 看行情 → 拍照验机 → 一键生成决策报告，全流程 3 分钟。', bold=True)

heading(doc, '八、技术架构')
bullets(doc, [
 '前端：Next.js（或 Vue3 + Vite）+ ECharts + Tailwind，Vercel 部署。',
 '后端：Next.js 全栈（Route Handlers）+ JSON 文件存储，OpenAI 兼容适配层接模型；JSON 方案在 AI Works 与自托管服务器上通用，迁移零成本。',
 '数据：JSON 数据文件（机型/价格/报价/报告缓存/知识条目），结构同原 SQLite 表设计。',
 'AI：见「四、LLM 接入方案」。',
 '部署：默认 AI Works 主线（周三晚必须完成首次发布）；京东定时抓取改由队长校园网机器执行（真实家宽 IP 更不易触发风控），抓取结果 git push 供数。备选：轻量香港节点 + 便宜域名全自托管（免备案），代码同构随时可切。',
 '阿里云轻量（云工开物学生计划，300 元无门槛券，2核2G 约 29~38 元/年）：完全控制，可跑定时抓取（Playwright）；坑 = 大陆节点绑域名需 ICP 备案（赛程内来不及）→ 只能裸 IP:端口或香港节点免备案。',
 '阿里云轻量（300 元学生券，2核2G 约 29~38 元/年）保留为备选：香港节点免备案 + Caddy 自动 HTTPS 可全自托管，代码同构随时切换。',
 '工程方式：全程 AI 结对开发（Cursor / Claude Code），成员负责需求拆解、提示词、数据审核、验收。',
], numbered=True)

heading(doc, '九、三泳道接力分工（接口先行定死契约，禁跨泳道改文件，每晚 21:00 队长合并）')
make_table(doc, ['泳道', '成员', '第一棒（周一晚~周二）', '第二棒（周三）', '交接验收物'], [
 ('队长/集成', '队长本人', '契约+仓库骨架+任务书派发', '每晚合并、验收、部署发布', '契约文档、合并日志'),
 ('泳道 1 前端', '队员 A → B', 'A：行情页骨架与图表', 'B：验机页+报告页（A 转验收）', '可点页面+截图'),
 ('泳道 2 后端+数据', '队员 C → D', 'C：API+JSON 存储；D：数据表格与采集', 'D 接管 API 联调（C 转数据清洗）', '接口冒烟通过+数据文件'),
 ('泳道 3 AI 工程', '队员 E', '识机提示词调通+报告预生成', '知识库 RAG+瑕疵样本素材', '识机 JSON 样例+报告缓存'),
])

heading(doc, '十、检查点与降级预案')
bullets(doc, [
 '周二晚：识机或图表未通 → 识图改「预录演示视频 + 结果页回放」，行情只留走势图，链路仍完整。',
 '周三晚：全链路未串通 → 演示改录屏播放 + 静态走场，Tech 分靠 README 架构图与数据采集过程叙事补回。',
 '铁律：周四 11-05 上午 12:00 前作品基本信息必须已保存在提交系统；今天先把账号激活、作品名占位填进去。',
], numbered=True)

heading(doc, '十一、8 分钟答辩剧本（对齐 Tech/Idea/UX/Show 各 25%）')
bullets(doc, [
 '0-1min 痛点：二手被坑聊天记录截图 + 「比价要开 5 个 App」对比图。',
 '1-3min 现场拍照验机：拍评委/队友手机 → 实时出验机卡（成色分+瑕疵框）。',
 '3-5min 行情：新机现价（官方 API）+ 历史走势 + 二手价格带（众包数据），讲数据机制而非爬虫。',
 '5-7min 决策报告：一页结论「值不值/有没有坑」，强调来源可溯源；提一句模型可插拔架构。',
 '7-8min 品类扩展框架 + 团队分工 + 展望（全品类数据接入、报价订阅、验机社区）。',
], numbered=True)

heading(doc, '十二、交付清单（对照评分细则）')
bullets(doc, [
 '提交系统：作品名/简介/主题（数码，后台指定不可改）周四 12:00 前保存。',
 '海报：官方统一模板（稍晚提供），确认后 2 小时内出图。',
 '源码：GitHub 主仓 + Gitee 镜像仓（git remote 双 push，每晚同步；提交系统填 Gitee 链接）+ README 含架构图/运行步骤/数据说明。',
 '演示视频：≤3 分钟传 B 站，完整走「拍照→报告」流程。',
 '体验链接：AI Works 公网链接（预览链接仅作者可见，必须等审核通过），周四晚用非本人设备实测游客可访问。',
], numbered=True)

heading(doc, '十三、待团队讨论的问题清单')
bullets(doc, [
 '产品名：「机鉴」是否通过？',
 '文本/视觉模型组合确认：建议 GLM-4V-Flash（视觉，免费）+ DeepSeek（文本）起步，看山补贴下来后切换。',
 '6 个演示机型选哪几款（建议：iPhone 13、小米 14、华为 Mate 60 各 2 个版本，翻新高发机型优先）。',
 '二手种子数据 200 条的今晚排班。',
 '看山积分领取路径技术指南标为 todo——今晚加群确认；zhihu-cli 安装与 Access Secret 创建今晚必办，由谁负责？',
 'AI Works 源码打包与首次发布由谁执行（建议 1 号集成者，周三晚前完成）？',
 '京东联盟注册是否仍需要：若看山/直答额度够用可暂缓。（默认：仍注册，成本为零）',
 '答辩现场带几台真机、是否购入一台二手演示机做「翻新机」对照。',
], numbered=True)

p = doc.add_paragraph()
set_font(p.add_run('注: 本文档为讨论稿 v0.2，任何人都可以直接改；定稿后按此拆任务。'), size=9, color=RGBColor(0x88,0x88,0x88))

doc.save('机鉴-项目介绍-讨论稿.docx')
print('saved v0.2')