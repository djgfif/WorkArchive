import { Outlet } from 'react-router-dom';
import { Container } from '@mantine/core';

export function MinimalLayout() {
  return (
    <main className="layout-shell layout-shell--minimal">
      <Container px="md" size={760}>
        <Outlet />
      </Container>
    </main>
  );
}
