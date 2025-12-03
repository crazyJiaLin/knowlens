import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  BilibiliCookie,
  BilibiliCookieDocument,
  BilibiliCookieStatus,
} from '../schemas/bilibili-cookie.schema';
import { CreateBilibiliCookieDto } from '../dto/create-bilibili-cookie.dto';
import { UpdateBilibiliCookieDto } from '../dto/update-bilibili-cookie.dto';

@Injectable()
export class BilibiliCookieService {
  private readonly logger = new Logger(BilibiliCookieService.name);

  constructor(
    @InjectModel(BilibiliCookie.name)
    private cookieModel: Model<BilibiliCookieDocument>,
  ) {}

  /**
   * 创建 Cookie
   */
  async create(
    createDto: CreateBilibiliCookieDto,
    createdBy?: string,
  ): Promise<BilibiliCookieDocument> {
    const cookie = new this.cookieModel({
      ...createDto,
      status: BilibiliCookieStatus.ENABLED,
      createdBy,
      updatedBy: createdBy,
    });
    return cookie.save();
  }

  /**
   * 获取所有 Cookie
   */
  async findAll(): Promise<BilibiliCookieDocument[]> {
    return this.cookieModel.find().sort({ createdAt: -1 }).exec();
  }

  /**
   * 获取单个 Cookie
   */
  async findOne(id: string): Promise<BilibiliCookieDocument | null> {
    return this.cookieModel.findById(id).exec();
  }

  /**
   * 更新 Cookie
   */
  async update(
    id: string,
    updateDto: UpdateBilibiliCookieDto,
    updatedBy?: string,
  ): Promise<BilibiliCookieDocument | null> {
    const updateData = {
      ...updateDto,
      ...(updatedBy && { updatedBy }),
    };
    return this.cookieModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
  }

  /**
   * 删除 Cookie
   */
  async remove(id: string): Promise<boolean> {
    const result = await this.cookieModel.findByIdAndDelete(id).exec();
    return !!result;
  }

  /**
   * 获取所有启用且未过期的 Cookie（按创建时间排序）
   */
  async findEnabledCookies(): Promise<BilibiliCookieDocument[]> {
    return this.cookieModel
      .find({
        status: BilibiliCookieStatus.ENABLED,
      })
      .sort({ createdAt: 1 }) // 按创建时间升序，先使用最早添加的
      .exec();
  }

  /**
   * 标记 Cookie 为已过期
   */
  async markAsExpired(id: string, error?: string): Promise<void> {
    await this.cookieModel
      .findByIdAndUpdate(id, {
        status: BilibiliCookieStatus.EXPIRED,
        lastError: error,
      })
      .exec();
    this.logger.warn(`Cookie ${id} 已标记为过期: ${error || '未知错误'}`);
  }

  /**
   * 更新 Cookie 使用信息
   */
  async updateUsage(id: string): Promise<void> {
    await this.cookieModel
      .findByIdAndUpdate(id, {
        $inc: { usageCount: 1 },
        lastUsedAt: new Date(),
        lastError: '', // 清除之前的错误
      })
      .exec();
  }
}
