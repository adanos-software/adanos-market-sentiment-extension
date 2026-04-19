export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Record<string, string> = {},
  children: Array<HTMLElement | string> = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
  children.forEach((child) => node.append(child));
  return node;
}

export function formatNumber(value: number | null, digits = 0): string {
  if (value === null) return "-";
  return value.toFixed(digits);
}

export function sentimentTone(value: number | null): "positive" | "negative" | "neutral" {
  if (value === null) return "neutral";
  if (value > 0.05) return "positive";
  if (value < -0.05) return "negative";
  return "neutral";
}

