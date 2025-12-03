/**
 * Cookie 转换工具
 * 将浏览器 cookie 字符串转换为 Netscape 格式
 */
export class CookieConverter {
  /**
   * 将浏览器 cookie 字符串转换为 Netscape 格式
   * @param cookieString 浏览器 cookie 字符串（格式：key=value; key=value）或 Netscape 格式
   * @returns Netscape 格式的 cookie 内容
   */
  static convertToNetscapeFormat(cookieString: string): string {
    // 检查是否已经是 Netscape 格式（包含制表符分隔的字段）
    if (cookieString.includes('\t') || cookieString.startsWith('#')) {
      return cookieString;
    }

    // 解析浏览器 cookie 字符串
    const lines: string[] = [
      '# Netscape HTTP Cookie File',
      '# Converted from browser cookie string',
    ];
    const domain = '.bilibili.com';
    const path = '/';
    const secure = 'FALSE';
    // 设置过期时间为 1 年后（Unix 时间戳，秒）
    const expiration = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;

    // 分割 cookie 字符串
    const cookiePairs = cookieString
      .split(';')
      .map((pair) => pair.trim())
      .filter(Boolean);

    for (const pair of cookiePairs) {
      const [name, ...valueParts] = pair.split('=');
      if (name && valueParts.length > 0) {
        const value = valueParts.join('='); // 处理值中包含 = 的情况
        // Netscape 格式：domain	flag	path	secure	expiration	name	value
        lines.push(
          `${domain}\tTRUE\t${path}\t${secure}\t${expiration}\t${name.trim()}\t${value.trim()}`,
        );
      }
    }

    return lines.join('\n');
  }
}
