import dayjs from 'dayjs';
export * from './fileSystem';

/**
 * 生成 UUID
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * 格式化日期
 */
export function formatDate(date: string | Date, format: string = 'YYYY-MM-DD HH:mm'): string {
  return dayjs(date).format(format);
}

/**
 * 格式化相对时间
 */
export function formatRelativeTime(date: string | Date): string {
  const now = dayjs();
  const target = dayjs(date);
  const diffMinutes = now.diff(target, 'minute');
  const diffHours = now.diff(target, 'hour');
  const diffDays = now.diff(target, 'day');

  if (diffMinutes < 1) return '刚刚';
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;
  return target.format('YYYY-MM-DD');
}

/**
 * 获取当前时间 ISO 字符串
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}
