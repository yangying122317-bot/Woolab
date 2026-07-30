/**
 * 联系方式：邮箱 + 社交链接。
 * 换成真实地址/链接时只改这里。
 */

export const contactEmail = "hello@woolab.example";

export interface SocialLink {
  id: string;
  label: string;
  href: string;
}

export const socialLinks: SocialLink[] = [
  { id: "instagram", label: "Instagram", href: "#" },
  { id: "xiaohongshu", label: "小红书", href: "#" },
  { id: "weibo", label: "微博", href: "#" },
];
