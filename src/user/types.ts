export interface User {
  id: string;
  credits: number;
  usageHistory: UsageRecord[];
}

export interface UsageRecord {
  timestamp: string;
  queryDepth: number;
  queryBreadth: number;
  creditsUsed: number;
  query: string;
}

// 额度计算配置
export interface CreditConfig {
  // 基础消耗（每次查询）
  baseCredits: number;
  // 每增加一层深度的额外消耗
  depthMultiplier: number;
  // 每增加一个广度的额外消耗
  breadthMultiplier: number;
}
