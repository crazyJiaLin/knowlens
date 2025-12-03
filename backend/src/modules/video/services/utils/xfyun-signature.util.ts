import * as crypto from 'crypto';

/**
 * 科大讯飞 API 签名工具
 * 根据官方文档：https://www.xfyun.cn/doc/spark/asr_llm/Ifasr_llm.html
 */
export class XfyunSignatureUtil {
  /**
   * 生成 dateTime 参数（请求发起的本地时间）
   * 格式：yyyy-MM-dd'T'HH:mm:ss±HHmm（如 2025-09-08T22:58:29+0800）
   */
  static generateDateTime(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    // 获取时区偏移（分钟）
    const timezoneOffset = -now.getTimezoneOffset();
    const offsetHours = Math.floor(Math.abs(timezoneOffset) / 60)
      .toString()
      .padStart(2, '0');
    const offsetMinutes = (Math.abs(timezoneOffset) % 60)
      .toString()
      .padStart(2, '0');
    const offsetSign = timezoneOffset >= 0 ? '+' : '-';

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${offsetSign}${offsetHours}${offsetMinutes}`;
  }

  /**
   * 生成 signatureRandom 参数（16位大小写字母+数字组合）
   */
  static generateSignatureRandom(): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * 生成签名 signature（新的大模型 API 签名方式）
   * 签名生成步骤：
   * 1. 排除待签名参数中的"signature"字段
   * 2. 对剩余参数按参数名进行自然排序（与Java TreeMap排序规则一致）
   * 3. 对排序后的每个参数的值进行URL编码（标准URL编码，不保留特殊字符）
   * 4. 空值或空字符串不参与签名
   * 5. 编码后的键值对格式：key=encoded_value
   * 6. 所有键值对用&连接，形成完整baseString
   * 7. 使用HMAC-SHA1算法对baseString进行加密，密钥是APISecret（UTF-8编码）
   * 8. 对加密结果进行Base64编码，得到最终签名
   */
  static generateSignature(
    queryParams: Record<string, string>,
    secretKey: string,
  ): string {
    // 1. 排除 signature 字段，并按参数名自然排序
    const sortedParams: Array<[string, string]> = [];
    const keys = Object.keys(queryParams)
      .filter((key) => key !== 'signature')
      .sort();

    // 2. 收集需要签名的参数（排除空值）
    for (const key of keys) {
      const value = queryParams[key];
      // 空值或空字符串不参与签名
      if (value != null && value !== '') {
        sortedParams.push([key, value]);
      }
    }

    // 3. 构建 baseString：encoded_key=encoded_value&encoded_key=encoded_value
    const baseStringParts: string[] = [];
    for (const [key, value] of sortedParams) {
      // 使用 encodeURIComponent 进行标准 URL 编码（只对值编码）
      const encodedValue = encodeURIComponent(value);
      // 键不编码，只对值编码
      baseStringParts.push(`${key}=${encodedValue}`);
    }
    const baseString = baseStringParts.join('&');

    // 4. 使用HMAC-SHA1算法对baseString进行加密，密钥是APISecret
    const hmac = crypto.createHmac('sha1', Buffer.from(secretKey, 'utf-8'));
    hmac.update(Buffer.from(baseString, 'utf-8'));
    const signature = hmac.digest('base64');

    return signature;
  }
}

