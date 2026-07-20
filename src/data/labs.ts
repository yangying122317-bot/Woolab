import type { Localized } from "../i18n/dict";

export interface LabProject {
  id: string;
  title: Localized;
  description: Localized;
  /** 项目配图（放在 public/assets/lab/ 下） */
  image: string;
  /** 可选外部链接 */
  link?: string;
}

/**
 * 实验室项目：持续追加即可，列表页自动渲染。
 */
export const labProjects: LabProject[] = [
  {
    id: "experiment-1",
    title: { zh: "实验一（占位）", en: "Experiment 1 (placeholder)" },
    description: {
      zh: "占位描述：这里可以放小游戏、互动或任何好玩的尝试。",
      en: "Placeholder: mini games, interactive toys or any fun experiments.",
    },
    image: "/assets/lab/lab-1.svg",
  },
  {
    id: "experiment-2",
    title: { zh: "实验二（占位）", en: "Experiment 2 (placeholder)" },
    description: {
      zh: "占位描述。",
      en: "Placeholder description.",
    },
    image: "/assets/lab/lab-2.svg",
  },
];
