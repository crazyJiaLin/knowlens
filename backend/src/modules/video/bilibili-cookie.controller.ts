import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { BilibiliCookieService } from './services/bilibili-cookie.service';
import { CreateBilibiliCookieDto } from './dto/create-bilibili-cookie.dto';
import { UpdateBilibiliCookieDto } from './dto/update-bilibili-cookie.dto';
import { BilibiliCookieStatus } from './schemas/bilibili-cookie.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../../common/decorators/user.decorator';

@Controller('bilibili-cookies')
@UseGuards(JwtAuthGuard)
export class BilibiliCookieController {
  constructor(private readonly cookieService: BilibiliCookieService) {}

  /**
   * 创建 Cookie
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createDto: CreateBilibiliCookieDto,
    @User('phone') phone: string,
  ) {
    return this.cookieService.create(createDto, phone);
  }

  /**
   * 获取所有 Cookie
   */
  @Get()
  async findAll() {
    return this.cookieService.findAll();
  }

  /**
   * 获取单个 Cookie
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.cookieService.findOne(id);
  }

  /**
   * 更新 Cookie
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateBilibiliCookieDto,
    @User('phone') phone: string,
  ) {
    return this.cookieService.update(id, updateDto, phone);
  }

  /**
   * 启用 Cookie
   */
  @Put(':id/enable')
  async enable(@Param('id') id: string, @User('phone') phone: string) {
    return this.cookieService.update(
      id,
      {
        status: BilibiliCookieStatus.ENABLED,
      },
      phone,
    );
  }

  /**
   * 禁用 Cookie
   */
  @Put(':id/disable')
  async disable(@Param('id') id: string, @User('phone') phone: string) {
    return this.cookieService.update(
      id,
      {
        status: BilibiliCookieStatus.DISABLED,
      },
      phone,
    );
  }

  /**
   * 删除 Cookie
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.cookieService.remove(id);
  }
}
