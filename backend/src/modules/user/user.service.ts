import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { UpdateUserDto } from './dto/update-user.dto';
import { OssService } from '../aliyun/oss.service';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private ossService: OssService,
  ) {}

  /**
   * 根据用户ID获取用户信息
   */
  async findById(userId: string): Promise<UserDocument | null> {
    return this.userModel.findById(userId);
  }

  /**
   * 获取用户资料
   */
  async getProfile(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const userDoc = user as any;
    return {
      id: user._id.toString(),
      phone: user.phone,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      createdAt: userDoc.createdAt,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      updatedAt: userDoc.updatedAt,
    };
  }

  /**
   * 更新用户信息
   */
  async updateProfile(userId: string, updateUserDto: UpdateUserDto) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 更新字段
    if (updateUserDto.nickname !== undefined) {
      user.nickname = updateUserDto.nickname;
    }
    if (updateUserDto.avatarUrl !== undefined) {
      user.avatarUrl = updateUserDto.avatarUrl;
    }

    await user.save();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const userDoc = user as any;
    return {
      id: user._id.toString(),
      phone: user.phone,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      updatedAt: userDoc.updatedAt,
    };
  }

  /**
   * 上传头像
   */
  async uploadAvatar(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ avatarUrl: string }> {
    if (!file) {
      throw new BadRequestException('请选择要上传的文件');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const originalname = (file as any).originalname as string;
    this.logger.log(`上传头像文件: ${originalname}`);

    // 验证文件类型
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const mimetype = file.mimetype as string;
    if (!allowedMimeTypes.includes(mimetype)) {
      throw new BadRequestException(
        '只支持上传图片文件（JPEG、PNG、GIF、WebP）',
      );
    }

    // 验证文件大小（5MB）
    const maxSize = 5 * 1024 * 1024; // 5MB
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const fileSize = file.size as number;
    if (fileSize > maxSize) {
      throw new BadRequestException('文件大小不能超过5MB');
    }

    try {
      // 生成文件名：avatars/{userId}/{timestamp}.{ext}
      const ext = originalname.split('.').pop() || 'jpg';
      const timestamp = Date.now();
      const filename = `avatars/${userId}/${timestamp}.${ext}`;

      // 上传到OSS
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const fileBuffer = (file as any).buffer as Buffer;
      const avatarUrl = await this.ossService.uploadFile(fileBuffer, filename);

      // 如果用户已有头像，删除旧头像
      const user = await this.userModel.findById(userId);
      if (user?.avatarUrl) {
        try {
          // 从完整URL中提取OSS路径
          const oldFilename = this.extractFilenameFromUrl(user.avatarUrl);
          if (oldFilename) {
            await this.ossService.deleteFile(oldFilename);
          }
        } catch (error) {
          // 删除失败不影响更新，只记录日志
          this.logger.warn(`删除旧头像失败: ${error}`);
        }
      }

      // 更新用户头像URL
      await this.updateProfile(userId, { avatarUrl });

      return { avatarUrl };
    } catch (error) {
      throw new BadRequestException(`头像上传失败: ${error}`);
    }
  }

  /**
   * 从URL中提取文件名
   * 支持OSS URL和本地文件URL两种格式
   */
  private extractFilenameFromUrl(url: string): string | null {
    try {
      // 本地文件URL格式: /uploadFile/path/to/file
      if (url.startsWith('/uploadFile/')) {
        return url.replace('/uploadFile/', '');
      }

      // OSS URL格式: https://bucket.oss-region.aliyuncs.com/path/to/file
      const urlObj = new URL(url);
      // 移除开头的斜杠
      return urlObj.pathname.substring(1) || null;
    } catch {
      // 如果URL解析失败，可能是相对路径，直接返回
      return url.startsWith('/uploadFile/')
        ? url.replace('/uploadFile/', '')
        : url;
    }
  }
}
