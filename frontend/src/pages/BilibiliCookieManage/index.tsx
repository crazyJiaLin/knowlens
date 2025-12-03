import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  message,
  Space,
  Tag,
  Popconfirm,
  Card,
  Typography,
  Alert,
  Select,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  getBilibiliCookies,
  createBilibiliCookie,
  updateBilibiliCookie,
  deleteBilibiliCookie,
  enableBilibiliCookie,
  disableBilibiliCookie,
  type BilibiliCookie,
  type CreateBilibiliCookieDto,
} from '@/api/bilibili-cookie';

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function BilibiliCookieManage() {
  const [cookies, setCookies] = useState<BilibiliCookie[]>([]);
  const [filteredCookies, setFilteredCookies] = useState<BilibiliCookie[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCookie, setEditingCookie] = useState<BilibiliCookie | null>(
    null,
  );
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [form] = Form.useForm();

  // 加载 cookies
  const loadCookies = async () => {
    setLoading(true);
    try {
      const data = await getBilibiliCookies();
      setCookies(data);
      applyFilter(data, statusFilter);
    } catch (error) {
      message.error('加载 cookies 失败');
      console.error('加载 cookies 失败', error);
    } finally {
      setLoading(false);
    }
  };

  // 应用状态筛选
  const applyFilter = (data: BilibiliCookie[], filter: string) => {
    if (filter === 'all') {
      setFilteredCookies(data);
    } else {
      setFilteredCookies(data.filter((cookie) => cookie.status === filter));
    }
  };

  // 状态筛选变化
  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    applyFilter(cookies, value);
  };

  useEffect(() => {
    void loadCookies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 打开新增/编辑弹窗
  const handleOpenModal = (cookie?: BilibiliCookie) => {
    if (cookie) {
      setEditingCookie(cookie);
      form.setFieldsValue({
        name: cookie.name,
        content: cookie.content,
      });
    } else {
      setEditingCookie(null);
      form.resetFields();
    }
    setModalVisible(true);
  };

  // 关闭弹窗
  const handleCloseModal = () => {
    setModalVisible(false);
    setEditingCookie(null);
    form.resetFields();
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingCookie) {
        await updateBilibiliCookie(editingCookie._id, values);
        message.success('更新成功');
      } else {
        await createBilibiliCookie(values as CreateBilibiliCookieDto);
        message.success('创建成功');
      }
      handleCloseModal();
      await loadCookies();
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'errorFields' in error
      ) {
        return;
      }
      message.error(editingCookie ? '更新失败' : '创建失败');
    }
  };

  // 删除
  const handleDelete = async (id: string) => {
    try {
      await deleteBilibiliCookie(id);
      message.success('删除成功');
      void loadCookies();
    } catch {
      message.error('删除失败');
    }
  };

  // 启用
  const handleEnable = async (id: string) => {
    try {
      await enableBilibiliCookie(id);
      message.success('启用成功');
      void loadCookies();
    } catch {
      message.error('启用失败');
    }
  };

  // 禁用
  const handleDisable = async (id: string) => {
    try {
      await disableBilibiliCookie(id);
      message.success('禁用成功');
      void loadCookies();
    } catch {
      message.error('禁用失败');
    }
  };

  // 状态标签
  const getStatusTag = (status: string) => {
    switch (status) {
      case 'enabled':
        return <Tag color="success">启用</Tag>;
      case 'disabled':
        return <Tag color="default">禁用</Tag>;
      case 'expired':
        return <Tag color="error">已过期</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  // 表格列
  const columns: ColumnsType<BilibiliCookie> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
    },
    {
      title: 'Cookie 内容',
      dataIndex: 'content',
      key: 'content',
      width: 300,
      ellipsis: {
        showTitle: false,
      },
      render: (text: string) => (
        <span title={text} style={{ display: 'block', maxWidth: '100%' }}>
          {text}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => getStatusTag(status),
    },
    {
      title: '使用次数',
      dataIndex: 'usageCount',
      key: 'usageCount',
      width: 100,
    },
    {
      title: '最后使用时间',
      dataIndex: 'lastUsedAt',
      key: 'lastUsedAt',
      width: 180,
      render: (text) => (text ? new Date(text).toLocaleString() : '-'),
    },
    {
      title: '创建者',
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: 120,
      render: (text) => text || '-',
    },
    {
      title: '最后编辑者',
      dataIndex: 'updatedBy',
      key: 'updatedBy',
      width: 120,
      render: (text) => text || '-',
    },
    {
      title: '添加时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (text) => new Date(text).toLocaleString(),
    },
    {
      title: '最后错误',
      dataIndex: 'lastError',
      key: 'lastError',
      width: 200,
      ellipsis: {
        showTitle: false,
      },
      render: (text: string) =>
        text ? (
          <Text type="danger" title={text}>
            {text}
          </Text>
        ) : (
          '-'
        ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            onClick={() => handleOpenModal(record)}
          >
            编辑
          </Button>
          {record.status === 'enabled' ? (
            <Button
              type="link"
              size="small"
              onClick={() => handleDisable(record._id)}
            >
              禁用
            </Button>
          ) : (
            <Button
              type="link"
              size="small"
              onClick={() => handleEnable(record._id)}
            >
              启用
            </Button>
          )}
          <Popconfirm
            title="确定要删除这个 cookie 吗？"
            onConfirm={() => handleDelete(record._id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Title level={2} style={{ marginBottom: '16px' }}>
          B站 Cookie 管理
        </Title>

        <Alert
          message="使用说明"
          description={
            <div>
              <p>
                <strong>方式一：从 API 请求头复制 Cookie（推荐）</strong>
              </p>
              <p>
                1. 在浏览器中登录 B站，打开开发者工具（F12）
              </p>
              <p>
                2. 切换到 Network（网络）标签，访问任意 B站页面或 API
              </p>
              <p>
                3. 找到任意请求（如访问视频页面），点击查看请求详情
              </p>
              <p>
                4. 在 Request Headers（请求头）中找到 Cookie 字段
              </p>
              <p>
                5. 复制 Cookie 的值（格式为：<code>key1=value1; key2=value2; ...</code>）
              </p>
              <p>
                6. 粘贴到下方的内容框中，系统会自动转换为 Netscape 格式
              </p>
              <p>
                <strong>方式二：使用 yt-dlp 导出</strong>
              </p>
              <p>
                1. 在浏览器中登录 B站，使用 yt-dlp 导出 cookies：
              </p>
              <pre style={{ background: '#f5f5f5', padding: '8px', borderRadius: '4px' }}>
                yt-dlp --cookies-from-browser chrome --cookies cookies.txt "https://www.bilibili.com"
              </pre>
              <p>2. 将 cookies.txt 文件内容复制到下方的内容框中</p>
              <p>
                <strong>注意：</strong>系统会自动按顺序尝试使用启用的 cookies，如果 cookie
                过期或格式错误，系统会自动标记为"已过期"状态
              </p>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: '16px' }}
        />

        <div
          style={{
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Space>
            <Button type="primary" onClick={() => handleOpenModal()}>
              新增 Cookie
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => loadCookies()}>
              刷新
            </Button>
          </Space>
          <Space>
            <span>状态筛选：</span>
            <Select
              value={statusFilter}
              onChange={handleStatusFilterChange}
              style={{ width: 120 }}
            >
              <Select.Option value="all">全部</Select.Option>
              <Select.Option value="enabled">启用</Select.Option>
              <Select.Option value="disabled">禁用</Select.Option>
              <Select.Option value="expired">已过期</Select.Option>
            </Select>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={filteredCookies}
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1500 }}
        />
      </Card>

      <Modal
        title={editingCookie ? '编辑 Cookie' : '新增 Cookie'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={handleCloseModal}
        width={800}
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="名称/备注"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="例如：主账号 Cookie" />
          </Form.Item>
          <Form.Item
            name="content"
            label="Cookie 内容（支持 Netscape 格式或浏览器 Cookie 字符串）"
            rules={[{ required: true, message: '请输入 Cookie 内容' }]}
          >
            <TextArea
              rows={10}
              placeholder={
                '支持两种格式：\n' +
                '1. Netscape 格式：\n' +
                '# Netscape HTTP Cookie File\n' +
                '.bilibili.com	TRUE	/	FALSE	1735689600	SESSDATA	value\n\n' +
                '2. 浏览器 Cookie 字符串格式：\n' +
                'SESSDATA=value; DedeUserID=123456; buvid3=xxx; ...'
              }
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

