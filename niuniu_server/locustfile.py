"""
牛牛棋牌游戏服务器 - Locust 负载测试配置

Locust 是一个开源的负载测试工具，允许你通过 Python 代码定义用户行为。
此文件定义了三个服务器的用户行为模拟。

使用方法:
    # 命令行模式 (无 UI)
    locust -f locustfile.py -H http://localhost:3000 -u 100 -r 10 --run-time 60s --headless

    # Web UI 模式 (推荐)
    locust -f locustfile.py -H http://localhost:3000
    # 然后访问 http://localhost:8089

参考文档: https://docs.locust.io/
"""

from locust import HttpUser, task, between, events
from datetime import datetime
import logging
import json

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================================================
# 事件处理器
# ============================================================================

@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """测试开始时的回调函数"""
    logger.info("=" * 80)
    logger.info(f"负载测试开始 - {datetime.now().isoformat()}")
    logger.info(f"主机: {environment.host}")
    logger.info("=" * 80)

@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """测试停止时的回调函数"""
    logger.info("=" * 80)
    logger.info(f"负载测试完成 - {datetime.now().isoformat()}")
    logger.info("=" * 80)

@events.request.add_listener
def on_request(request_type, name, response_time, response_length, response, context, exception, **kwargs):
    """请求事件监听器"""
    if exception:
        logger.warning(f"{request_type} {name} - 异常: {exception}")

# ============================================================================
# 游戏服务器用户行为模拟
# ============================================================================

class GameServerUser(HttpUser):
    """
    游戏服务器用户行为模拟
    
    模拟真实玩家的行为:
    1. 定期健康检查
    2. 查询游戏状态
    3. 获取版本信息
    4. 创建和加入房间
    """
    
    wait_time = between(1, 3)  # 任务间隔 1-3 秒
    
    def on_start(self):
        """用户开始时的初始化"""
        self.user_id = None
        self.room_id = None
        logger.info(f"游戏服务器用户启动")
    
    def on_stop(self):
        """用户停止时的清理"""
        logger.info(f"游戏服务器用户停止")
    
    @task(1)
    def health_check(self):
        """健康检查 (权重: 1)"""
        with self.client.get("/health", catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Unexpected status code: {response.status_code}")
    
    @task(2)
    def get_game_status(self):
        """获取游戏状态 (权重: 2)"""
        with self.client.get("/api/status", catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status check failed: {response.status_code}")
    
    @task(1)
    def get_version(self):
        """获取版本信息 (权重: 1)"""
        self.client.get("/api/version")
    
    @task(2)
    def ping(self):
        """Ping 测试 (权重: 2)"""
        self.client.get("/api/ping")

# ============================================================================
# 登录服务器用户行为模拟
# ============================================================================

class LoginServerUser(HttpUser):
    """
    登录服务器用户行为模拟
    
    模拟用户登录流程:
    1. 健康检查
    2. 注册新用户
    3. 用户登录
    4. 获取用户信息
    """
    
    wait_time = between(2, 5)  # 任务间隔 2-5 秒
    
    def on_start(self):
        """初始化测试数据"""
        self.username = f"testuser_{int(datetime.now().timestamp() * 1000)}"
        self.password = "test123"
        logger.info(f"登录服务器用户启动: {self.username}")
    
    @task(1)
    def health_check(self):
        """健康检查"""
        with self.client.get("/health", catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Health check failed: {response.status_code}")
    
    @task(2)
    def register_user(self):
        """用户注册"""
        payload = {
            "username": self.username,
            "password": self.password,
            "email": f"{self.username}@example.com"
        }
        with self.client.post("/api/register", json=payload, catch_response=True) as response:
            if response.status_code in [200, 201, 409]:  # 409 = 用户已存在
                response.success()
            else:
                response.failure(f"Registration failed: {response.status_code}")
    
    @task(3)
    def login(self):
        """用户登录"""
        payload = {
            "username": self.username,
            "password": self.password
        }
        with self.client.post("/api/login", json=payload, catch_response=True) as response:
            if response.status_code in [200, 401]:  # 401 = 认证失败（正常测试结果）
                response.success()
            else:
                response.failure(f"Login failed: {response.status_code}")
    
    @task(1)
    def get_user_info(self):
        """获取用户信息"""
        self.client.get("/api/user/info")

# ============================================================================
# 游戏厅服务器用户行为模拟
# ============================================================================

class HallServerUser(HttpUser):
    """
    游戏厅服务器用户行为模拟
    
    模拟玩家在游戏厅中的行为:
    1. 查看可用房间
    2. 创建新房间
    3. 加入房间
    4. 查询排行榜
    """
    
    wait_time = between(1, 2)  # 任务间隔 1-2 秒
    
    def on_start(self):
        """初始化用户数据"""
        self.user_id = None
        self.room_id = None
        logger.info("游戏厅服务器用户启动")
    
    @task(1)
    def health_check(self):
        """健康检查"""
        with self.client.get("/health", catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Health check failed: {response.status_code}")
    
    @task(3)
    def get_rooms(self):
        """获取可用房间列表"""
        with self.client.get("/api/rooms", catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Get rooms failed: {response.status_code}")
    
    @task(2)
    def create_room(self):
        """创建新房间"""
        import random
        payload = {
            "name": f"room_{random.randint(10000, 99999)}",
            "max_players": random.choice([2, 3, 4]),
            "entry_fee": random.choice([10, 20, 50, 100])
        }
        with self.client.post("/api/rooms", json=payload, catch_response=True) as response:
            if response.status_code in [200, 201]:
                try:
                    self.room_id = response.json().get("room_id")
                    response.success()
                except:
                    response.failure("Failed to parse response")
            else:
                response.failure(f"Create room failed: {response.status_code}")
    
    @task(2)
    def join_room(self):
        """加入房间"""
        if not self.room_id:
            import random
            self.room_id = random.randint(1, 1000)
        
        payload = {"user_id": self.user_id or 1}
        with self.client.post(f"/api/rooms/{self.room_id}/join", json=payload, catch_response=True) as response:
            if response.status_code in [200, 400, 404]:  # 400/404 = 房间不存在或满人（正常）
                response.success()
            else:
                response.failure(f"Join room failed: {response.status_code}")
    
    @task(1)
    def get_leaderboard(self):
        """获取排行榜"""
        self.client.get("/api/leaderboard")

# ============================================================================
# 压力测试用户（可选）
# ============================================================================

class StressTestUser(HttpUser):
    """
    压力测试用户 - 发送高频率请求以测试服务器极限
    
    这个用户类会发送高频率的请求来测试服务器在压力下的表现。
    """
    
    wait_time = between(0.1, 0.5)  # 高频率: 100-500ms
    
    @task(5)
    def rapid_health_checks(self):
        """快速健康检查"""
        self.client.get("/health")
    
    @task(10)
    def rapid_status_checks(self):
        """快速状态检查"""
        self.client.get("/api/status")
    
    @task(5)
    def rapid_pings(self):
        """快速 ping"""
        self.client.get("/api/ping")

# ============================================================================
# 使用说明
# ============================================================================

"""
启动命令示例:

1. Web UI 模式 (推荐，用于交互式测试):
   locust -f locustfile.py -H http://localhost:3000

2. 命令行模式 (无 UI):
   locust -f locustfile.py -H http://localhost:3000 -u 100 -r 10 --run-time 60s --headless

3. 指定多个用户类:
   locust -f locustfile.py -H http://localhost:3000 GameServerUser LoginServerUser HallServerUser

4. 生成 HTML 报告:
   locust -f locustfile.py -H http://localhost:3000 -u 100 -r 10 --run-time 60s --headless --html=report.html

参数说明:
   -f, --locustfile       Locust 文件位置 (默认: locustfile.py)
   -H, --host             目标主机地址
   -u, --users            并发用户数
   -r, --spawn-rate       每秒生成的用户数
   --run-time             测试持续时间 (示例: 60s, 1m)
   --headless             无 UI 模式运行
   --html                 生成 HTML 报告文件

Web UI 访问:
   启动后访问 http://localhost:8089
   
   在 Web UI 中可以:
   - 设置并发用户数
   - 设置生成速率
   - 实时查看测试统计
   - 查看响应时间分布
   - 查看请求分布
   - 导出结果

关键指标说明:
   - Type: 请求类型 (GET, POST, 等)
   - Name: 请求端点
   - # requests: 总请求数
   - # fails: 失败请求数
   - Median: 中位响应时间 (ms)
   - Average: 平均响应时间 (ms)
   - Min: 最小响应时间 (ms)
   - Max: 最大响应时间 (ms)
   - Average size: 平均响应体大小 (bytes)
   - RPS: 每秒请求数 (requests per second)
"""
