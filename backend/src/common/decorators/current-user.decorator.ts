import { User } from './user.decorator';

/**
 * CurrentUser 装饰器，是 User 装饰器的别名
 * 用于从请求中获取当前用户信息
 */
export const CurrentUser = User;
