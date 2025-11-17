/**
 * TypeScript 类型定义 - NiuNiu Admin API
 * 自动生成，用于前端管理控制台
 */

export enum AdminRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  FINANCE = 'finance',
  SUPPORT = 'support',
  OPERATOR = 'operator',
}

export enum Permission {
  // 用户管理
  USER_VIEW = 'user:view',
  USER_EDIT = 'user:edit',
  USER_BLACKLIST = 'user:blacklist',
  USER_BAN = 'user:ban',
  USER_KYC = 'user:kyc',

  // 房间管理
  ROOM_VIEW = 'room:view',
  ROOM_MANAGE = 'room:manage',
  ROOM_KICK = 'room:kick',
  ROOM_REPLAY = 'room:replay',
  ROOM_CLOSE = 'room:close',

  // 财务管理
  FINANCE_VIEW = 'finance:view',
  FINANCE_RECHARGE = 'finance:recharge',
  FINANCE_WITHDRAW = 'finance:withdraw',
  FINANCE_RECONCILE = 'finance:reconcile',

  // 风控管理
  RISK_VIEW = 'risk:view',
  RISK_RULE = 'risk:rule',
  RISK_DETECT = 'risk:detect',

  // 运维管理
  OPS_PUBLISH = 'ops:publish',
  OPS_ROLLBACK = 'ops:rollback',
  OPS_CONFIG = 'ops:config',
  OPS_MONITOR = 'ops:monitor',
}

export interface AdminUser {
  adminId: string;
  adminName: string;
  roles: AdminRole[];
  email?: string;
  mfaEnabled: boolean;
  lastLoginAt?: string;
  status: 0 | 1; // 0=disabled, 1=active
}

export interface GameUser {
  userId: string;
  account: string;
  registerTime: string;
  status: 0 | 1; // 0=active, 1=banned
  balance: number;
}

export interface UserBlacklistEntry {
  userId: string;
  reason: string;
  createdAt: string;
  createdBy: string;
}

export interface Room {
  roomId: string;
  gameType: string;
  playerCount: number;
  createdAt: string;
  status: number;
}

export interface Transaction {
  id: number;
  userId: string;
  type: 'RECHARGE' | 'WITHDRAW' | 'GAME_WIN' | 'GAME_LOSS';
  amount: number;
  description: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  processedAt?: string;
  processedBy?: string;
}

export interface RiskRule {
  id: number;
  ruleName: string;
  ruleType: string;
  threshold: number;
  action: string;
  description: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: number;
  adminId: string;
  adminName: string;
  action: string;
  resourceType: string;
  resourceId: string;
  success: boolean;
  ip: string;
  timestamp: number;
  createdAt: string;
}

// API 请求/响应类型

export interface LoginRequest {
  account: string;
  password: string;
}

export interface LoginResponse {
  code: number;
  message: string;
  data: {
    token?: string;
    mfaToken?: string;
    mfaRequired?: boolean;
    admin?: AdminUser;
  };
}

export interface VerifyMFARequest {
  mfaToken: string;
  totpCode: string;
}

export interface VerifyMFAResponse {
  code: number;
  message: string;
  data: {
    token: string;
  };
}

export interface SetupMFAResponse {
  code: number;
  message: string;
  data: {
    secret: string;
    qrCodeURI: string;
    instructions: string;
  };
}

export interface BanUserRequest {
  reason: string;
  duration: number; // in days, 0 = permanent
}

export interface KickPlayerRequest {
  userId: string;
  reason: string;
}

export interface RechargeRequest {
  userId: string;
  amount: number;
  note: string;
}

export interface CreateRiskRuleRequest {
  ruleName: string;
  ruleType: string;
  threshold: number;
  action: string;
  description: string;
}

export interface PaginatedResponse<T> {
  code: number;
  message: string;
  data: {
    items: T[];
    page: number;
    pageSize: number;
    total?: number;
  };
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  data?: T;
}

// 前端服务层接口（示例）

export interface AdminApiService {
  // Authentication
  login(request: LoginRequest): Promise<LoginResponse>;
  verifyMFA(request: VerifyMFARequest): Promise<VerifyMFAResponse>;
  setupMFA(): Promise<SetupMFAResponse>;
  confirmMFA(secret: string, totpCode: string): Promise<ApiResponse<void>>;

  // User Management
  getUsers(page: number, pageSize: number, keyword?: string, status?: number): Promise<PaginatedResponse<GameUser>>;
  banUser(userId: string, request: BanUserRequest): Promise<ApiResponse<void>>;
  blacklistUser(userId: string, reason: string): Promise<ApiResponse<void>>;

  // Room Management
  getRooms(page: number, pageSize: number, status?: number): Promise<PaginatedResponse<Room>>;
  kickPlayer(roomId: string, request: KickPlayerRequest): Promise<ApiResponse<void>>;

  // Finance Management
  getBalance(userId: string, page: number): Promise<ApiResponse<{ user: GameUser; transactions: Transaction[] }>>;
  recharge(request: RechargeRequest): Promise<ApiResponse<void>>;

  // Risk Control
  getRiskRules(): Promise<ApiResponse<{ rules: RiskRule[] }>>;
  createRiskRule(request: CreateRiskRuleRequest): Promise<ApiResponse<{ ruleId: number }>>;

  // Audit
  getAuditLogs(
    page: number,
    pageSize: number,
    adminId?: string,
    action?: string,
    startTime?: number,
    endTime?: number
  ): Promise<PaginatedResponse<AuditLogEntry>>;
}
