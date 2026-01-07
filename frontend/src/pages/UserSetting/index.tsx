import { useState, useEffect, useCallback } from 'react';
import { Form, Input, Button, message, Card } from 'antd';
// import { Upload, Avatar } from 'antd';
// import { UserOutlined, UploadOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/stores/authStore';
import { getUserProfile, updateUserProfile, type UserProfile } from '@/api/user';
// import { uploadAvatar } from '@/api/user';
// import type { UploadProps } from 'antd';

export default function UserSetting() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  // const [uploading, setUploading] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const { updateUser } = useAuthStore();

  // 加载用户资料
  const loadUserProfile = useCallback(async () => {
    try {
      const profile = await getUserProfile();
      setUserProfile(profile);
      form.setFieldsValue({
        nickname: profile.nickname || '',
        phone: profile.phone,
      });
    } catch {
      message.error('加载用户资料失败');
    }
  }, [form]);

  useEffect(() => {
    void loadUserProfile();
  }, [loadUserProfile]);

  // 头像上传功能已注释
  // const handleAvatarUpload: UploadProps['customRequest'] = async (options) => {
  //   const { file, onSuccess, onError } = options;
  //   setUploading(true);

  //   try {
  //     const result = await uploadAvatar(file as File);
  //     console.log('上传成功result', result);
  //     message.success('头像上传成功');

  //     // 更新本地状态
  //     const updatedProfile = {
  //       ...userProfile,
  //       avatarUrl: result.avatarUrl,
  //     } as UserProfile;
  //     setUserProfile(updatedProfile);

  //     // 同步更新 authStore 中的用户信息
  //     updateUser({ avatarUrl: result.avatarUrl });

  //     // 重新加载用户资料以确保数据一致
  //     await loadUserProfile();

  //     onSuccess?.(result);
  //   } catch {
  //     message.error('头像上传失败');
  //     onError?.(new Error('头像上传失败'));
  //   } finally {
  //     setUploading(false);
  //   }
  // };

  // 提交表单
  const handleSubmit = async (values: { nickname: string }) => {
    setLoading(true);
    try {
      const result = await updateUserProfile({
        nickname: values.nickname,
      });

      message.success('更新成功');

      // 更新本地状态
      const updatedProfile = { ...userProfile, ...result };
      setUserProfile(updatedProfile as UserProfile);
      updateUser({ nickname: result.nickname });
    } catch {
      message.error('更新失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <Card title="个人设置">
        <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ maxWidth: '500px' }}>
          {/* 头像上传功能已注释 */}
          {/* <Form.Item label="头像">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <Avatar
                size={80}
                src={userProfile?.avatarUrl || user?.avatarUrl}
                icon={<UserOutlined />}
                key={userProfile?.avatarUrl || user?.avatarUrl || 'default'}
              />
              <Upload
                customRequest={handleAvatarUpload}
                showUploadList={false}
                accept="image/*"
                beforeUpload={(file) => {
                  const isImage = file.type.startsWith('image/');
                  if (!isImage) {
                    message.error('只能上传图片文件');
                    return false;
                  }
                  const isLt5M = file.size / 1024 / 1024 < 5;
                  if (!isLt5M) {
                    message.error('图片大小不能超过5MB');
                    return false;
                  }
                  return true;
                }}
              >
                <Button icon={<UploadOutlined />} loading={uploading} disabled={uploading}>
                  上传头像
                </Button>
              </Upload>
            </div>
          </Form.Item> */}

          {/* 手机号（只读） */}
          <Form.Item label="手机号" name="phone">
            <Input disabled />
          </Form.Item>

          {/* 昵称 */}
          <Form.Item
            label="昵称"
            name="nickname"
            rules={[{ max: 20, message: '昵称长度不能超过20个字符' }]}
          >
            <Input placeholder="请输入昵称" maxLength={20} />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              保存
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
