import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../../common/decorators/user.decorator';
import { PdfService } from './pdf.service';
import { UploadPdfDto } from './dto/upload-pdf.dto';

@ApiTags('PDF')
@Controller('pdf')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PdfController {
  constructor(private readonly pdfService: PdfService) {}

  @Post('upload')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: '上传PDF文件' })
  @ApiResponse({ status: 200, description: '上传成功' })
  @ApiResponse({ status: 400, description: '文件格式错误或文件过大' })
  @ApiResponse({ status: 401, description: '未登录' })
  async uploadPdf(
    @User('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadPdfDto,
  ) {
    if (!file) {
      throw new BadRequestException('请选择要上传的PDF文件');
    }

    // 打印文件名的编码信息，用于调试
    const originalname = file.originalname || 'unknown.pdf';
    console.log('上传的PDF文件名（原始 latin1）:', originalname);

    // 尝试从 latin1 转为 utf8（修复中文乱码）
    const utf8Filename = Buffer.from(originalname, 'latin1').toString('utf8');
    console.log('转换为 UTF-8 后:', utf8Filename);

    // 将正确的文件名传给 service
    file.originalname = utf8Filename;

    const result = await this.pdfService.uploadPdf(userId, file, dto);
    return {
      success: true,
      ...result,
    };
  }
}
