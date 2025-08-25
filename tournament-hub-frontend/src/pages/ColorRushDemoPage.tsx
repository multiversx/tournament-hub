import React from 'react';
import { ColorRushDemo } from '../components/ColorRushDemo';
import { Layout } from '../components/Layout';

export const ColorRushDemoPage: React.FC = () => {
    return (
        <Layout>
            <ColorRushDemo />
        </Layout>
    );
};

export default ColorRushDemoPage;
