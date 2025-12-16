import { useParams, Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import VideoDocument from './VideoDocument';
import TextDocument from './TextDocument';

/**
 * 通用文档页面组件
 * 根据路由参数 type 直接渲染不同的子组件
 */
export default function Document() {
  const { type } = useParams<{ id: string; type: string }>();

  // 根据路由参数 type 直接渲染对应组件
  if (type === 'video') {
    return <VideoDocument />;
  }

  if (type === 'text') {
    return <TextDocument />;
  }

  if (type === 'pdf') {
    // PDF 功能待实现
    return (
      <div style={{ padding: '24px' }}>
        <Spin tip="PDF 功能待实现" />
      </div>
    );
  }

  // 类型未知，跳转到记录页
  return <Navigate to="/records" replace />;
}

