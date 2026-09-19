/**
 * 联系方式：邮箱 + 社交链接。
 * 换成真实地址/链接时只改这里。
 */

export const contactEmail = "hello@woolab.example";

export interface SocialLink {
  id: string;
  label: { zh: string; en: string };
  href: string;
}

export const socialLinks: SocialLink[] = [
  { id: "instagram", label: { zh: "Instagram", en: "Instagram" }, href: "https://www.instagram.com/yuanabai/" },
  { id: "xiaohongshu", label: { zh: "小红书", en: "RED" }, href: "https://xhslink.cn/o/6HOWfVbZiG4" },
];
