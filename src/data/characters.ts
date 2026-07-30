import type { Localized } from "../i18n/dict";

export interface Character {
  id: string;
  name: Localized;
  /** 一句话标签，例如性格或身份 */
  tagline: Localized;
  /** 详细介绍 */
  description: Localized;
  /** 角色图片路径（放在 public/assets/characters/ 下） */
  image: string;
  /** 身份卡上的档案项（生日/性格/喜好等），按顺序展示 */
  profile?: { label: Localized; value: Localized }[];
}

/**
 * 角色数据：新增角色只需追加一条记录 + 一张图片。
 */
export const characters: Character[] = [
  {
    id: "sheep",
    name: { zh: "小羊", en: "Little Sheep" },
    tagline: { zh: "这个世界的主人", en: "Owner of this world" },
    description: {
      zh: "占位介绍：这里写小羊的性格、爱好和它的小故事。",
      en: "Placeholder: describe Little Sheep's personality, hobbies and stories here.",
    },
    image: "/assets/characters/char-sheep.svg",
    profile: [
      {
        label: { zh: "生日", en: "Birthday" },
        value: { zh: "占位：某月某日", en: "TBD" },
      },
      {
        label: { zh: "性格", en: "Personality" },
        value: { zh: "占位：慢吞吞但很执着", en: "Slow but determined" },
      },
      {
        label: { zh: "喜欢", en: "Likes" },
        value: { zh: "占位：晒太阳、囤毛线", en: "Sunbathing, hoarding yarn" },
      },
    ],
  },
  {
    id: "friend-a",
    name: { zh: "伙伴 A", en: "Friend A" },
    tagline: { zh: "占位角色", en: "Placeholder character" },
    description: {
      zh: "占位介绍：替换成这个角色的设定文案。",
      en: "Placeholder: replace with this character's profile.",
    },
    image: "/assets/characters/char-friend-a.svg",
  },
  {
    id: "friend-b",
    name: { zh: "伙伴 B", en: "Friend B" },
    tagline: { zh: "占位角色", en: "Placeholder character" },
    description: {
      zh: "占位介绍：替换成这个角色的设定文案。",
      en: "Placeholder: replace with this character's profile.",
    },
    image: "/assets/characters/char-friend-b.svg",
  },
];
