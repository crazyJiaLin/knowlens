import { Modal, Form, Input, Button, message } from 'antd';
import { useState } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { sendSmsCode, verifyCode } from '@/api/auth';

export default function LoginModal() {
  const [form] = Form.useForm();
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);

  const { isLoginModalOpen, closeLoginModal } = useUIStore();
  const { login } = useAuthStore();

  // 发送验证码
  const handleSendCode = async () => {
    const phone = form.getFieldValue('phone');
    if (!phone || !/^1\d{10}$/.test(phone)) {
      message.error('请输入正确的手机号');
      return;
    }

    try {
      await sendSmsCode(phone);
      message.success('验证码已发送');

      // 倒计时
      let count = 60;
      setCountdown(count);
      const timer = setInterval(() => {
        count--;
        setCountdown(count);
        if (count === 0) clearInterval(timer);
      }, 1000);
    } catch {
      message.error('发送失败，请稍后重试');
    }
  };

  // 提交登录
  const handleSubmit = async (values: { phone: string; code: string }) => {
    setLoading(true);
    try {
      // 后端验证成功后会自动设置 cookie
      const { user } = await verifyCode(values.phone, values.code);
      login(user); // 只保存用户信息，token 在 cookie 中
      message.success('登录成功');
      closeLoginModal();
      form.resetFields();
    } catch {
      message.error('验证码错误或已过期');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="手机号登录"
      open={isLoginModalOpen}
      onCancel={closeLoginModal}
      footer={null}
      width={400}
    >
      <Form form={form} onFinish={handleSubmit} layout="vertical">
        <Form.Item
          name="phone"
          label="手机号"
          rules={[
            { required: true, message: '请输入手机号' },
            { pattern: /^1\d{10}$/, message: '请输入正确的手机号' },
          ]}
        >
          <Input placeholder="请输入手机号" size="large" />
        </Form.Item>

        <Form.Item name="code" label="验证码" rules={[{ required: true, message: '请输入验证码' }]}>
          <Input
            placeholder="请输入验证码"
            size="large"
            addonAfter={
              <Button
                type="link"
                onClick={handleSendCode}
                disabled={countdown > 0}
                style={{ padding: 0 }}
              >
                {countdown > 0 ? `${countdown}秒后重试` : '获取验证码'}
              </Button>
            }
          />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} size="large" block>
            登录
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}
