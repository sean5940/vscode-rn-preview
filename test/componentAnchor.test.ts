import { describe, expect, it } from 'vitest';
import { componentLine } from '../src/componentAnchor.ts';

const lines = (source: string): string[] => source.trim().split('\n');

describe('componentLine', () => {
    it('finds the line of a component wrapped in React.memo', () => {
        const source = lines(`
import React from 'react';

type Props = { label: string };

export const Badge = React.memo((props: Props) => null);
        `);

        expect(componentLine(source, 'Badge.tsx')).toBe(4);
    });

    it('finds a function declaration too', () => {
        const source = lines(`
import React from 'react';

export function SubscriptionScreen() {}
        `);

        expect(componentLine(source, 'SubscriptionScreen.tsx')).toBe(2);
    });

    // Many files put export interface and export type above the component.
    it('skips type exports', () => {
        const source = lines(`
export interface TabsRef extends ScrollView {}

export type TabsProps = { items: string[] };

export const Tabs = React.forwardRef((props, ref) => null);
        `);

        expect(componentLine(source, 'Tabs.tsx')).toBe(4);
    });

    // When a file exports several components, the one matching the file name is that file's subject.
    it('prefers the export matching the file name', () => {
        const source = lines(`
export const BadgeIcon = () => null;

export const Badge = () => null;
        `);

        expect(componentLine(source, 'Badge.tsx')).toBe(2);
    });

    it('finds the definePreview line in a declaration file', () => {
        const source = lines(`
import { definePreview } from '@preview';
import { Badge } from '@ui/components/badge/Badge';

const LABEL = 'Basic';

export default definePreview({
    component: Badge,
});
        `);

        expect(componentLine(source, 'Badge.preview.tsx')).toBe(5);
    });

    it('anchors at the top when there is nothing to find', () => {
        expect(componentLine(lines('const hidden = 1;'), 'Nothing.tsx')).toBe(0);
    });
});
