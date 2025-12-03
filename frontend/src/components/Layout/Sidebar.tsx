import { Layout, Menu } from 'antd';
import { HomeOutlined, FileTextOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import type { MenuProps } from 'antd';

const { Sider } = Layout;

type MenuItem = Required<MenuProps>['items'][number];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems: MenuItem[] = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: '首页',
    },
    {
      key: '/records',
      icon: <FileTextOutlined />,
      label: '我的记录',
    },
    {
      key: '/setting',
      icon: <UserOutlined />,
      label: '个人设置',
    },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  return (
    <Sider
      width={200}
      style={{
        background: '#fff',
        boxShadow: '2px 0 8px rgba(0, 0, 0, 0.1)',
        minHeight: 'calc(100vh - 64px)',
      }}
      breakpoint="lg"
      collapsedWidth={0}
    >
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={handleMenuClick}
        style={{ height: '100%', borderRight: 0 }}
      />
    </Sider>
  );
}
