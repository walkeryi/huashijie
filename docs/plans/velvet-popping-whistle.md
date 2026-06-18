# Bug 扫描与修复计划：quant_system

## Context
对 quant_system 量化交易系统进行全面代码审查，发现 26 个 bug，按严重程度分为 Critical / High / Medium / Low。本计划聚焦于修复影响系统正确性和稳定性的 Critical 和 High 级别 bug。

---

## Bug 总览

### Critical（系统崩溃或核心功能完全失效）
| # | 文件 | 问题 |
|---|------|------|
| C1 | `data/providers/fenshi.py:72-89` | `save_to_db()` 构建 records 后从不调用数据库，数据静默丢失 |
| C2 | `data/fetcher.py:168-186` | 同上，`save_to_db()` 是死代码 |
| C3 | `services/sim_engine.py:76` | `pd.np` 已废弃，pandas 2.0+ 上 np 为 None，策略中使用 np 直接崩溃 |
| C4 | `simtrade/sim_trade_tab.py` + `ui/sim_trade_tab.py:273-278` | `SimTradeThread.run()` 立即退出导致 isRunning() 永远 False，每次 UI 刷新创建新线程，线程泄漏 |

### High（核心功能严重错误或数据正确性问题）
| # | 文件 | 问题 |
|---|------|------|
| H1 | `services/sim_engine.py:122-132` | `start_price` 从未持久化，收益率永远为 0%；Sharpe/maxDrawdown 是硬编码假值 |
| H2 | `simtrade/sim_trade_tab.py:140-148` | 创建交易时未保存 `start_price` |
| H3 | `services/sim_engine.py:130` | `annual_return = total_return * 252` 公式错误 |
| H4 | `data/providers/calendar.py:88-111` | `_load_cache_for_year()` 完全覆盖缓存字典，多年数据丢失 |
| H5 | `data/fetcher.py:47-51` | 日线数据获取后未检查 ret=302 就缓存退市股票数据 |
| H6 | `backtest/threads/optimizer_thread.py:43` | 传 0.0 给 limit_ups/limit_downs，涨跌停检查被静默禁用 |
| H7 | `data/storage/storage.py:66-77` | SQLite 异常被静默吞掉，连接泄漏 |
| H8 | `data/providers/calendar.py:58-82` | `_cache` 字典多线程无锁并发访问 |

---

## 修复步骤

### Step 1: 修复分时数据保存 (C1, C2)
- **文件**: `quant_system/data/providers/fenshi.py` 行 72-89
- **文件**: `quant_system/data/fetcher.py` 行 168-186
- **描述**: 在 `save_to_db()` 方法中实际调用 `db_manager` 写入数据
- **修改**: 
  - 调用 `db_manager.upsert_fenshi_records(records)` 或等效方法
  - 如果 db_manager 没有对应接口，需先在 `common/db_manager.py` 添加
- **注意**: 需要检查 `db_manager` 是否有批量写入接口

### Step 2: 修复 np namespace 问题 (C3)
- **文件**: `quant_system/services/sim_engine.py` 行 76
- **描述**: 用 `import numpy as np` 替换 `pd.np`
- **修改**: `namespace = {'pd': pd, 'np': np}`（文件顶部需 `import numpy as np`）

### Step 3: 修复线程泄漏 (C4)
- **文件**: `quant_system/ui/sim_trade_tab.py` 行 273-278
- **描述**: 移除 `SimTradeThread` 包装层，直接使用 `SimTradeEngine`
- **修改**:
  - `start_engine()` 直接创建和管理 `SimTradeEngine`
  - 用 `self._engine_running` 内存标志替代 `isRunning()` 检查
  - 移除 `SimTradeThread` 中间层
- **文件**: `quant_system/ui/threads/sim_trade_thread.py` - 可考虑删除或标记废弃

### Step 4: 修复模拟交易收益计算 (H1, H2, H3)
- **文件**: `quant_system/services/sim_engine.py` 行 120-136
- **文件**: `quant_system/simtrade/sim_trade_tab.py` 行 140-148
- **描述**: 
  - 创建交易时保存 `start_price`（用第一次获取到的最新价）
  - 修复 `annual_return` 公式为 `total_return / (days_elapsed / 365)` 或移除
  - 用真实计算或标记为 "--" 替代硬编码的 Sharpe 和 MaxDrawdown

### Step 5: 修复交易日历缓存覆盖 (H4)
- **文件**: `quant_system/data/providers/calendar.py` 行 88-111
- **描述**: 修改 `_load_cache_for_year()` 使用 `self._cache.update()` 而非 `self._cache =`
- **修改**: `self._cache.update(dict(zip(...)))` 替代 `self._cache = dict(zip(...))`

### Step 6: 修复日线数据 302 检查 (H5)
- **文件**: `quant_system/data/fetcher.py` 行 47-51
- **描述**: 在 `save_parquet` 之前检查 `df.attrs.get('ret') == 302`
- **修改**: 参照 `services/data_preprocessor.py` 中的正确实现

### Step 7: 修复优化器涨跌停处理 (H6)
- **文件**: `quant_system/backtest/threads/optimizer_thread.py` 行 43
- **描述**: 传入正确长度的布尔数组，或使用 `services/backtest_engine.py` 中已有的 `hasattr` 保护逻辑
- **修改**: 确保与 `services/backtest_engine.py` 行为一致

### Step 8: 修复 SQLite 异常处理和连接泄漏 (H7)
- **文件**: `quant_system/data/storage/storage.py` 行 63-91
- **描述**: 
  - `update_stock_status`: 使用 try/finally 确保 conn 被关闭，记录异常日志
  - `get_stock_status`: 区分"数据库错误"和"股票不存在"，记录异常日志

---

## 验证方法

1. **C1/C2**: 运行一次分时数据获取，检查数据库是否有新记录写入
2. **C3**: 在 pandas 2.0+ 环境下启动模拟交易，确认策略不报 `NoneType` 错误
3. **C4**: 多次切换到"模拟交易"tab，用任务管理器确认没有线程数持续增长
4. **H1/H2/H3**: 创建模拟交易后观察收益率是否随价格变化而变化（不再始终为0）
5. **H4**: 查询跨年度的交易日（如 2024-2025），确认缓存命中率正常
6. **H5**: 用已知退市股票代码测试，确认不会被缓存为有效数据
7. **H6**: 运行参数优化并检查日志，确认涨跌停逻辑生效
8. **H7**: 故意制造磁盘满/权限错误场景，确认异常被记录而非静默吞掉
9. 运行 `python -c "from quant_system.data import DataPreprocessor; from quant_system.services import DataPreprocessor"` 确保无导入错误
