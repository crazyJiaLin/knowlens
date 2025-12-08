import { Avatar, Dropdown, Button, Space } from 'antd';
import type { MenuProps } from 'antd';
import { UserOutlined, SettingOutlined, LogoutOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { logout } from '@/api/auth';
import { message } from 'antd';
import { useUIStore } from '@/stores/uiStore';
import { useState, useEffect } from 'react';

export default function Header() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout: logoutStore } = useAuthStore();
  const { openLoginModal } = useUIStore();
  const [isScrolled, setIsScrolled] = useState(false);

  // 监听滚动事件
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      setIsScrolled(scrollTop > 10);
    };

    window.addEventListener('scroll', handleScroll);
    // 初始化时检查一次
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      logoutStore();
      message.success('退出登录成功');
      navigate('/');
    } catch {
      message.error('退出登录失败');
    }
  };

  const menuItems: MenuProps['items'] = [
    {
      key: 'setting',
      icon: <SettingOutlined />,
      label: '个人设置',
      onClick: () => navigate('/setting'),
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  const getUserName = () => {
    const name = user?.nickname || user?.phone || '';
    return name.length > 12 ? name.slice(0, 11) + '...' : name;
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        backgroundColor: isScrolled ? '#fff' : 'transparent',
        boxShadow: isScrolled ? '0 2px 8px rgba(0, 0, 0, 0.1)' : 'none',
        transition: 'all 0.6s ease',
      }}
    >
      {/* 左侧占位 */}
      <div style={{ width: '120px' }} />

      {/* 右侧操作区 */}
      <Space size="middle" style={{ width: '120px', justifyContent: 'flex-end' }}>
        <Button type="primary" onClick={() => navigate('/records')}>
          记录
        </Button>
        {isAuthenticated && user ? (
          <Dropdown menu={{ items: menuItems }} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar src={user.avatarUrl} icon={<UserOutlined />} size="default" />
              <span style={{ whiteSpace: 'nowrap' }}>{getUserName()}</span>
            </Space>
          </Dropdown>
        ) : (
          <Button type="primary" onClick={openLoginModal}>
            登录
          </Button>
        )}
      </Space>
    </div>
  );
}
