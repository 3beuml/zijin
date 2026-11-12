/**
 * 子衿 · 内联 SVG 图标集（美工：v0.5）。
 * 24×24 视窗、1.8 描边、圆角端点，stroke 用 currentColor——
 * 颜色全部交给 CSS（design-ui 的令牌），图标本身不带颜色。
 * 不引外部图标库：本应用离线运行，仓库里不添依赖。
 */
interface IconProps {
  size?: number;
  className?: string;
}

function Svg({ size = 20, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** 今日：日历 + 当日圆点 */
export function IconToday(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      <circle cx="12" cy="14.5" r="1.6" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** 学生：两个人 */
export function IconStudents(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
      <circle cx="16.5" cy="9.5" r="2.4" />
      <path d="M15.5 14.3c2.3.2 4.2 1.7 4.8 4.4" />
    </Svg>
  );
}

/** 添加：加号（dock 中键圆盘里用） */
export function IconPlus(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" strokeWidth={2.2} />
    </Svg>
  );
}

/** 待办：勾选框 */
export function IconTodos(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
      <path d="M8 12.2l2.8 2.8L16.4 9" />
    </Svg>
  );
}

/** 我的：单人像 */
export function IconMine(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8.2" r="3.4" />
      <path d="M5 19.5c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6" />
    </Svg>
  );
}

/** 沟通：对话气泡 */
export function IconTalk(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 6.5A2.5 2.5 0 0 1 7 4h10a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 17 16H9.8L5.6 19.6c-.6.5-1.1.2-1.1-.6V6.5z" />
      <path d="M8.5 9h7M8.5 12h4.5" />
    </Svg>
  );
}

/** 谈心：心形 */
export function IconHeart(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 19.8s-7.2-4.4-7.2-9.3C4.8 7.4 7 5.5 9.3 5.5c1.2 0 2.1.6 2.7 1.5.6-.9 1.5-1.5 2.7-1.5 2.3 0 4.5 1.9 4.5 5 0 4.9-7.2 9.3-7.2 9.3z" />
    </Svg>
  );
}

/** 家访：房子 */
export function IconHomeVisit(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 11l8-6.5L20 11" />
      <path d="M6 9.8V19h12V9.8" />
      <path d="M10 19v-4.5h4V19" />
    </Svg>
  );
}

/** 其他：三个点 */
export function IconMore(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="5.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** 导入：托盘 + 下箭头 */
export function IconImport(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 14v4.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V14" />
      <path d="M12 4v10M8 10.5L12 14l4-3.5" />
    </Svg>
  );
}

/** 关闭：× */
export function IconClose(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

/** 搜索：放大镜 */
export function IconSearch(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="10.5" cy="10.5" r="5.5" />
      <path d="M15 15l4.5 4.5" />
    </Svg>
  );
}

/** 勾（完成态） */
export function IconCheck(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Svg>
  );
}

/** 空态插画：摊开的本子 + 笔（纯装饰，尺寸可放大） */
export function IconNotebookEmpty({ size = 64, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M10 18c6-3 14-3 20 0v28c-6-3-14-3-20 0V18z" />
      <path d="M54 18c-6-3-14-3-20 0v28c6-3 14-3 20 0V18z" />
      <path d="M16 24h10M16 30h10M38 24h10M38 30h10" opacity={0.5} />
      <path d="M44 40l10-14 4 3-10 14-5 2 1-5z" />
    </svg>
  );
}
