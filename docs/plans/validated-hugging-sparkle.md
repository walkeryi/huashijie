# Bug 修复计划

## Context

代码审查发现 12 个 bug，从致命到低优先级。按用户要求从高到低依次修复。

## 修复步骤

### 1. 致命：BUG 1 — `main_window.py` 消息中心导入路径错误

**文件**: `quant_system/ui/main_window.py:409`
**修改**: `from .chat_tab import ChatTab` → `from quant_system.chat.ui import ChatTab`

### 2. 中等：BUG 2 — `monthly.py` / `weekly.py` 补 `all_data` 参数

**文件**: `quant_system/data/providers/monthly.py`, `quant_system/data/providers/weekly.py`
**修改**: `fetch` 方法签名补 `all_data: bool = False`，将硬编码 `'all': 0` 改为 `1 if all_data else 0`

### 3. 中等：BUG 3 — `_get_kline_data_logic` 补 302 退市处理

**文件**: `quant_system/data/fetcher.py`
**修改**: 在 `_get_kline_data_logic` 的 `except` 块中，仿照 `get_daily_data` 添加 `"302" in str(e)` 检查和退市标记

### 4. 中等：BUG 4 — 回测线程启动前检查前一个线程

**文件**: `quant_system/ui/quant_backtest_tab.py`
**修改**: `run_center_backtest` 和 `run_parameter_optimization` 方法中，创建新线程前检查 `self.thread` / `self.opt_thread` 是否仍在运行，若运行中则提示用户等待或忽略

### 5. 中等：BUG 5 — `load_stock_daily` 避免双重 `setCurrentIndex`

**文件**: `quant_system/ui/main_window.py:459-469`
**修改**: 懒加载后不再额外调用 `self.tabs.setCurrentIndex(1)`，因为 `on_tab_changed(1)` 内部已设置

### 6. 低：BUG 6 — `monthly.py` / `weekly.py` `attrs['base']` 补 `date` 字段

**文件**: `quant_system/data/providers/monthly.py`, `quant_system/data/providers/weekly.py`
**修改**: `df.attrs['base'] = {'code': code, 'date': data.get('date', '')}` 与 daily.py 对齐

### 7. 低：BUG 7-10 — `data/fetcher.py` 死代码清理

**文件**: `quant_system/data/fetcher.py`
**修改**:
- 删除 `getattr(df, 'ret', 200)`，直接用 `df.attrs.get('ret', 200)`
- 删除不可达的 `ret_code == 302` 分支（provider 层已 raise ValueError）
- `"302" in str(e)` 改为更健壮的检查
- 修正文件头注释路径 `data_preprocessing/fetcher.py` → `data/fetcher.py`

### 8. 低：BUG 12 — 删空文件

**文件**: `quant_system/ui/charts/base_chart_widget.py`
**修改**: 删除该空文件

## Verification

- 运行 `python main.py` 启动程序，点击各标签页验证不崩溃
- 检查 `git diff` 确认所有修改正确
