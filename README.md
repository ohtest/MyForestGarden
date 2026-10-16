# Echo

心理陪伴对话 Demo：人本主义 + CBT，基座模型走 DeepSeek API，前端是微信小程序，并带一个便于本机预览的网页。

## 结构

```
backend/          FastAPI + DeepSeek API
  prompts/        系统提示词，可直接改
  skills/         Skill 文件，可增删
  web/            本机网页预览
miniprogram/      微信小程序
```

## 启动后端

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# 若 PyPI 不稳定：
# pip install -i https://pypi.tuna.tsinghua.edu.cn/simple --trusted-host pypi.tuna.tsinghua.edu.cn -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

本机预览：打开 http://127.0.0.1:8000

## 接上 DeepSeek V4.1 Flash

默认可用 DeepSeek API（模型名 `deepseek-flash`）。在 `backend/.env` 写入：

```
DEEPSEEK_API_KEY=你的Key
ECHO_LLM_PROVIDER=deepseek
```

## 接上 GLM-5.3-Flash

走智谱开放平台的 `glm-5.3-flash`。在 `backend/.env` 写入：

```
ZHIPUAI_API_KEY=你的Key
ECHO_LLM_PROVIDER=glm
```

然后重启后端。

## 接上 GPT

默认用和 Flash 同档的 `gpt-6-luna`。在 `backend/.env` 写入：

```
OPENAI_API_KEY=你的Key
OPENAI_MODEL=gpt-6-luna
ECHO_LLM_PROVIDER=openai
```

然后重启后端。要测旗舰模型时把 `OPENAI_MODEL` 改成 `gpt-6-astra`。

## 演示模式

没有 API Key 时，可用演示回复跑通界面：

```bash
ECHO_MOCK_LLM=1 uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## 打开小程序

用微信开发者工具导入 `miniprogram/`，详情里关闭「校验合法域名」。真机调试时，把 `miniprogram/app.js` 里的 `apiBase` 改成你电脑的局域网地址。

## 背景随时间和天气变化

背景插画在 `backend/web/art/weather/`，按「时段-天气」命名，时段是 dawn / noon / dusk / night，天气是 clear / cloudy / rain / snow。时段按本机时间自动切换，光色随分钟渐变；天气来自 `/api/weather`。

网页预览可以加参数看效果：

- `?speed=720&at=05:00`：从 5 点开始，2 分钟走完一天
- `?sky=rain`：指定天气，可选 clear、partly、cloudy、fog、rain、storm、snow
- `?wind=1`：加上大风落叶
- `?time=night`：固定在某个时段

## 自定义提示词和 Skill

- 改 `backend/prompts/system.md`
- 在 `backend/skills/` 增加或关闭 `.md` 文件，格式见 `backend/skills/README.md`
- 无需改代码，下一次对话会重新读取
