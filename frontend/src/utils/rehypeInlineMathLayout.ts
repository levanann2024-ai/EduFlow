import type { Element, Root, Text } from 'hast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';
import { formatInlineMathLayout } from './inlineMathLayout';

export const rehypeInlineMathLayout: Plugin<[], Root> = () => (tree) => {
  visit(tree, 'element', (node: Element) => {
    if (node.tagName !== 'code') return;
    const classNames = node.properties.className;
    if (!Array.isArray(classNames) || !classNames.includes('math-inline')) return;

    const mathText = node.children.find((child): child is Text => child.type === 'text');
    if (!mathText) return;
    mathText.value = formatInlineMathLayout(mathText.value);
  });
};
