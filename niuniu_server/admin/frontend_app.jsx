/**
 * React 管理控制台 - 初始化骨架
 * 使用 Ant Design 企业组件库
 * 
 * 安装依赖：
 * npm install react react-dom antd axios react-router-dom
 */

import React, { useState, useContext, createContext } from 'react';
import { Layout, Menu, Dropdown, Button, message } from 'antd';
import {
  UserOutlined,
  HomeOutlined,
  DollarOutlined,
  AlertOutlined,
  UnorderedListOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const { Header, Content, Sider } = Layout;

// AuthContext 用于全局管理认证状态
const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

/**
 * 登录页面
 */
export const LoginPage = ({ onLoginSuccess }) => {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [totpCode, setTotpCode] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post('/admin/login', { account, password });
      if (res.data.data.mfaRequired) {
        setMfaToken(res.data.data.mfaToken);
        setMfaStep(true);
      } else {
        localStorage.setItem('token', res.data.data.token);
        message.success('登录成功');
        onLoginSuccess(res.data.data);
      }
    } catch (err) {
      message.error('登录失败：' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleMFA = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post('/admin/verify-mfa', { mfaToken, totpCode });
      localStorage.setItem('token', res.data.data.token);
      message.success('验证成功');
      onLoginSuccess(res.data.data);
    } catch (err) {
      message.error('MFA 验证失败：' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  if (mfaStep) {
    return (
      <div style={{ maxWidth: 400, margin: '100px auto', padding: 20, border: '1px solid #ddd' }}>
        <h2>请输入 MFA 验证码</h2>
        <form onSubmit={handleMFA}>
          <div style={{ marginBottom: 16 }}>
            <label>验证码</label>
            <input
              type="text"
              maxLength="6"
              placeholder="000000"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              style={{ width: '100%', padding: 8, marginTop: 4 }}
            />
          </div>
          <Button type="primary" htmlType="submit" loading={loading} block>
            验证
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 400, margin: '100px auto', padding: 20, border: '1px solid #ddd' }}>
      <h2>管理员登录</h2>
      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: 16 }}>
          <label>账号</label>
          <input
            type="text"
            placeholder="输入账号"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            style={{ width: '100%', padding: 8, marginTop: 4 }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label>密码</label>
          <input
            type="password"
            placeholder="输入密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: 8, marginTop: 4 }}
          />
        </div>
        <Button type="primary" htmlType="submit" loading={loading} block>
          登录
        </Button>
      </form>
    </div>
  );
};

/**
 * 用户管理页面
 */
export const UserManagementPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/admin/users', {
        params: { page, pageSize: 50 },
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(res.data.data.users);
    } catch (err) {
      message.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchUsers();
  }, [page]);

  return (
    <div>
      <h2>用户管理</h2>
      <Button type="primary" onClick={fetchUsers} loading={loading} style={{ marginBottom: 16 }}>
        刷新
      </Button>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid #ddd', padding: 8 }}>用户 ID</th>
            <th style={{ border: '1px solid #ddd', padding: 8 }}>账号</th>
            <th style={{ border: '1px solid #ddd', padding: 8 }}>注册时间</th>
            <th style={{ border: '1px solid #ddd', padding: 8 }}>状态</th>
            <th style={{ border: '1px solid #ddd', padding: 8 }}>余额</th>
            <th style={{ border: '1px solid #ddd', padding: 8 }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.userId}>
              <td style={{ border: '1px solid #ddd', padding: 8 }}>{user.userId}</td>
              <td style={{ border: '1px solid #ddd', padding: 8 }}>{user.account}</td>
              <td style={{ border: '1px solid #ddd', padding: 8 }}>{user.registerTime}</td>
              <td style={{ border: '1px solid #ddd', padding: 8 }}>{user.status === 0 ? '正常' : '封禁'}</td>
              <td style={{ border: '1px solid #ddd', padding: 8 }}>{user.balance}</td>
              <td style={{ border: '1px solid #ddd', padding: 8 }}>
                <Button type="link" danger size="small">
                  封禁
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * 房间管理页面
 */
export const RoomManagementPage = () => {
  return (
    <div>
      <h2>房间管理</h2>
      <p>房间列表 - 开发中</p>
    </div>
  );
};

/**
 * 财务管理页面
 */
export const FinanceManagementPage = () => {
  return (
    <div>
      <h2>财务管理</h2>
      <p>充值、提现审核、账务对账 - 开发中</p>
    </div>
  );
};

/**
 * 风控管理页面
 */
export const RiskControlPage = () => {
  return (
    <div>
      <h2>风控管理</h2>
      <p>风控规则配置、异常检测 - 开发中</p>
    </div>
  );
};

/**
 * 审计日志页面
 */
export const AuditLogPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/admin/audit-logs', {
        params: { page: 1, pageSize: 50 },
        headers: { Authorization: `Bearer ${token}` },
      });
      setLogs(res.data.data.logs);
    } catch (err) {
      message.error('获取审计日志失败');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div>
      <h2>审计日志</h2>
      <Button type="primary" onClick={fetchLogs} loading={loading} style={{ marginBottom: 16 }}>
        刷新
      </Button>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid #ddd', padding: 8 }}>操作员</th>
            <th style={{ border: '1px solid #ddd', padding: 8 }}>操作</th>
            <th style={{ border: '1px solid #ddd', padding: 8 }}>资源类型</th>
            <th style={{ border: '1px solid #ddd', padding: 8 }}>资源 ID</th>
            <th style={{ border: '1px solid #ddd', padding: 8 }}>状态</th>
            <th style={{ border: '1px solid #ddd', padding: 8 }}>IP</th>
            <th style={{ border: '1px solid #ddd', padding: 8 }}>时间</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td style={{ border: '1px solid #ddd', padding: 8 }}>{log.adminName}</td>
              <td style={{ border: '1px solid #ddd', padding: 8 }}>{log.action}</td>
              <td style={{ border: '1px solid #ddd', padding: 8 }}>{log.resourceType}</td>
              <td style={{ border: '1px solid #ddd', padding: 8 }}>{log.resourceId}</td>
              <td style={{ border: '1px solid #ddd', padding: 8 }}>{log.success ? '成功' : '失败'}</td>
              <td style={{ border: '1px solid #ddd', padding: 8 }}>{log.ip}</td>
              <td style={{ border: '1px solid #ddd', padding: 8 }}>{new Date(log.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * 主应用布局
 */
export const AdminDashboard = ({ admin, onLogout }) => {
  const navigate = useNavigate();
  const [selectedKey, setSelectedKey] = useState('users');

  const menuItems = [
    { key: 'users', icon: <UserOutlined />, label: '用户管理' },
    { key: 'rooms', icon: <HomeOutlined />, label: '房间管理' },
    { key: 'finance', icon: <DollarOutlined />, label: '财务管理' },
    { key: 'risk', icon: <AlertOutlined />, label: '风控管理' },
    { key: 'audit', icon: <UnorderedListOutlined />, label: '审计日志' },
  ];

  const contentMap = {
    users: <UserManagementPage />,
    rooms: <RoomManagementPage />,
    finance: <FinanceManagementPage />,
    risk: <RiskControlPage />,
    audit: <AuditLogPage />,
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ color: 'white', margin: 0 }}>牛牛管理后台</h2>
        <Dropdown
          menu={{
            items: [
              { key: 'profile', label: '个人资料' },
              { key: 'logout', label: '退出登录', icon: <LogoutOutlined /> },
            ],
            onClick: ({ key }) => {
              if (key === 'logout') {
                localStorage.removeItem('token');
                onLogout();
              }
            },
          }}
        >
          <Button type="text" style={{ color: 'white' }}>
            <UserOutlined /> {admin?.adminName}
          </Button>
        </Dropdown>
      </Header>
      <Layout>
        <Sider width={200} theme="light">
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            onClick={({ key }) => setSelectedKey(key)}
            items={menuItems}
          />
        </Sider>
        <Content style={{ padding: '20px' }}>
          {contentMap[selectedKey]}
        </Content>
      </Layout>
    </Layout>
  );
};

/**
 * 主应用入口
 */
export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('token'));
  const [admin, setAdmin] = useState(null);

  const handleLoginSuccess = (data) => {
    setAdmin(data.admin || { adminName: '管理员' });
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setAdmin(null);
  };

  return isLoggedIn ? (
    <AdminDashboard admin={admin} onLogout={handleLogout} />
  ) : (
    <LoginPage onLoginSuccess={handleLoginSuccess} />
  );
}
