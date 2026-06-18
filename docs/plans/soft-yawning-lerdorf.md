# 任务4重构计划

## 上下文
任务4要求从公开数据源获取真实数据绘制图表。原方案用硬编码GDP数据，用户指出了问题。现改用World Bank API实时获取2024年中国经济数据。

## 修改方案

### 修改的文件
- `task4_charts.py` — 重写，使用World Bank API动态获取数据

### 具体改动
1. 添加 `fetch_data()` 函数，从 World Bank API 获取数据
2. 圆环图：三大产业构成（农业/制造业/服务业增加值）
3. 漏斗图：三大产业增加值排序
4. 仪表盘：服务业占GDP比重
5. 雷达图：GDP增长率/CPI/失业率/出口占比/城镇人口多维度对比
6. Tab分页整合

### 数据来源
World Bank API (无需注册) — `https://api.worldbank.org/v2/country/CN/indicator/{code}?format=json`

### 验证
运行 `python3 task4_charts.py`，确认HTML生成且数据正确
