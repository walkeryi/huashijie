// 向后兼容：所有函数从 local-storage 重新导出
export {
  localListSaves as listSaves,
  localSaveToSlot as saveToSlot,
  localAutoSave as autoSave,
  localLoadSave as loadSave,
  localDeleteSave as deleteSave,
  localClearAllSaves as clearAllSaves,
  localGetSaveSummary as getSaveSummary,
} from './local-storage'
