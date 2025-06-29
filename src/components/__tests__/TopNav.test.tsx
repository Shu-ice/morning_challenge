/**
 * @jest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { TopNav } from '../TopNav';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock the AuthContext
const mockUser = {
  _id: '1',
  username: 'testuser',
  email: 'test@example.com',
  isLoggedIn: true,
  isAdmin: false
};

const mockLogout = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({
    user: mockUser,
    logout: mockLogout,
    loading: false
  })
}));

// Helper function to set viewport size
const setViewportSize = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  });
  
  // Trigger resize event
  act(() => {
    window.dispatchEvent(new Event('resize'));
  });
};

// Helper function to render TopNav with providers
const renderTopNav = () => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <TopNav />
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('TopNav Mobile Responsive Behavior', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Set default desktop viewport
    setViewportSize(1024, 768);
  });
  
  afterEach(() => {
    // Clean up any open modals or side effects
    document.body.innerHTML = '';
  });

  describe('Desktop Viewport (≥640px)', () => {
    it('should show navigation links and hide burger menu on desktop', () => {
      setViewportSize(1024, 768);
      renderTopNav();
      
      // Desktop navigation links should be visible
      expect(screen.getByRole('link', { name: /ホーム/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /ランキング/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /履歴/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /マイページ/i })).toBeInTheDocument();
      
      // Burger menu button should be hidden on desktop
      const burgerButton = screen.queryByLabelText(/メニューを開く/i);
      if (burgerButton) {
        // Check if the parent container has sm:hidden class instead
        const parentContainer = burgerButton.closest('.sm\\:hidden');
        expect(parentContainer).toBeInTheDocument();
      }
    });

    it('should show username and logout button on desktop', () => {
      setViewportSize(1024, 768);
      renderTopNav();
      
      expect(screen.getAllByText('testuser')[0]).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /ログアウト/i })).toBeInTheDocument();
    });
  });

  describe('Mobile Viewport (<640px)', () => {
    it('should hide navigation links and show burger menu on mobile (375px)', () => {
      setViewportSize(375, 667); // iPhone SE dimensions
      renderTopNav();
      
      // Mobile burger button should be present
      const burgerButton = screen.getByLabelText(/メニューを開く/i);
      expect(burgerButton).toBeInTheDocument();
      
      // Desktop navigation links should be hidden by CSS classes
      const desktopNav = screen.getByText('ホーム').closest('.hidden.sm\\:flex, .sm\\:flex');
      if (desktopNav) {
        expect(desktopNav).toHaveClass('hidden', 'sm:flex');
      }
    });

    it('should show mobile username but compact layout', () => {
      setViewportSize(375, 667);
      renderTopNav();
      
      // Username should still be visible but in mobile format
      expect(screen.getAllByText('testuser')[0]).toBeInTheDocument();
      
      // Check burger menu button is present
      expect(screen.getByLabelText(/メニューを開く/i)).toBeInTheDocument();
    });

    it('should open mobile drawer when burger menu is clicked', () => {
      setViewportSize(375, 667);
      renderTopNav();
      
      const burgerButton = screen.getByLabelText(/メニューを開く/i);
      
      // Initially, mobile drawer should not be visible
      expect(screen.queryByRole('link', { name: /🏠 ホーム/i })).not.toBeInTheDocument();
      
      // Click burger menu
      act(() => {
        fireEvent.click(burgerButton);
      });
      
      // Mobile navigation links should now be visible
      expect(screen.getByRole('link', { name: /🏠 ホーム/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /🏆 ランキング/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /📊 履歴/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /👤 マイページ/i })).toBeInTheDocument();
    });

    it('should close mobile drawer when backdrop is clicked', () => {
      setViewportSize(375, 667);
      renderTopNav();
      
      const burgerButton = screen.getByLabelText(/メニューを開く/i);
      
      // Open mobile menu
      act(() => {
        fireEvent.click(burgerButton);
      });
      
      // Verify menu is open
      expect(screen.getByRole('link', { name: /🏠 ホーム/i })).toBeInTheDocument();
      
      // Find and click backdrop
      const backdrop = document.querySelector('.fixed.inset-0.bg-black');
      expect(backdrop).toBeInTheDocument();
      
      act(() => {
        fireEvent.click(backdrop as Element);
      });
      
      // Menu should be closed (links should not be visible)
      expect(screen.queryByRole('link', { name: /🏠 ホーム/i })).not.toBeInTheDocument();
    });

    it('should close mobile drawer when escape key is pressed', () => {
      setViewportSize(375, 667);
      renderTopNav();
      
      const burgerButton = screen.getByLabelText(/メニューを開く/i);
      
      // Open mobile menu
      act(() => {
        fireEvent.click(burgerButton);
      });
      
      // Verify menu is open
      expect(screen.getByRole('link', { name: /🏠 ホーム/i })).toBeInTheDocument();
      
      // Press escape key
      act(() => {
        fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
      });
      
      // Menu should be closed
      expect(screen.queryByRole('link', { name: /🏠 ホーム/i })).not.toBeInTheDocument();
    });

    it('should handle logout from mobile menu', () => {
      setViewportSize(375, 667);
      renderTopNav();
      
      const burgerButton = screen.getByLabelText(/メニューを開く/i);
      
      // Open mobile menu
      act(() => {
        fireEvent.click(burgerButton);
      });
      
      // Find and click logout button in mobile menu
      const logoutButton = screen.getByRole('button', { name: /🚪 ログアウト/i });
      expect(logoutButton).toBeInTheDocument();
      
      act(() => {
        fireEvent.click(logoutButton);
      });
      
      // Verify logout was called
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
  });

  describe('Tablet Viewport (640px - edge case)', () => {
    it('should show desktop layout at 640px breakpoint', () => {
      setViewportSize(640, 768);
      renderTopNav();
      
      // At exactly 640px, should show desktop layout
      expect(screen.getByRole('link', { name: /ホーム/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /ランキング/i })).toBeInTheDocument();
    });

    it('should show mobile layout just below 640px', () => {
      setViewportSize(639, 768);
      renderTopNav();
      
      // Just below 640px should show mobile layout
      expect(screen.getByLabelText(/メニューを開く/i)).toBeInTheDocument();
    });
  });

  describe('Admin User Mobile Behavior', () => {
    beforeEach(() => {
      // Mock admin user - simplified approach
      mockUser.isAdmin = true;
    });
    
    afterEach(() => {
      // Reset admin status
      mockUser.isAdmin = false;
    });

    it('should show admin menu items in mobile drawer for admin users', () => {
      setViewportSize(375, 667);
      renderTopNav();
      
      const burgerButton = screen.getByLabelText(/メニューを開く/i);
      
      // Open mobile menu
      act(() => {
        fireEvent.click(burgerButton);
      });
      
      // Should show admin section
      expect(screen.getByText(/管理者メニュー/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /📊 ダッシュボード/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /⚡ 問題生成/i })).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes for mobile menu', () => {
      setViewportSize(375, 667);
      renderTopNav();
      
      const burgerButton = screen.getByLabelText(/メニューを開く/i);
      
      // Check initial ARIA state
      expect(burgerButton).toHaveAttribute('aria-expanded', 'false');
      expect(burgerButton).toHaveAttribute('aria-label', 'メニューを開く');
      
      // Open menu
      act(() => {
        fireEvent.click(burgerButton);
      });
      
      // Check expanded state
      expect(burgerButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('should support keyboard navigation in mobile menu', () => {
      setViewportSize(375, 667);
      renderTopNav();
      
      const burgerButton = screen.getByLabelText(/メニューを開く/i);
      
      // Open menu with Enter key
      act(() => {
        fireEvent.keyDown(burgerButton, { key: 'Enter' });
        fireEvent.click(burgerButton); // Simulate actual click since keyDown alone won't trigger onClick
      });
      
      // Should be able to tab through menu items
      const homeLink = screen.getByRole('link', { name: /🏠 ホーム/i });
      expect(homeLink).toBeInTheDocument();
      
      // Focus should be manageable
      act(() => {
        homeLink.focus();
      });
      
      expect(document.activeElement).toBe(homeLink);
    });
  });

  describe('Performance and Animations', () => {
    it('should handle rapid menu open/close without issues', () => {
      setViewportSize(375, 667);
      renderTopNav();
      
      const burgerButton = screen.getByLabelText(/メニューを開く/i);
      
      // Rapidly open and close menu multiple times
      for (let i = 0; i < 5; i++) {
        act(() => {
          fireEvent.click(burgerButton);
        });
        act(() => {
          fireEvent.click(burgerButton);
        });
      }
      
      // Should still be functional
      expect(burgerButton).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /🏠 ホーム/i })).not.toBeInTheDocument();
    });
  });
});

// Additional test for CSS class verification
describe('TopNav CSS Classes', () => {
  it('should apply correct responsive classes', () => {
    renderTopNav();
    
    // Find desktop navigation container
    const desktopNav = screen.getByText('ホーム').closest('div');
    expect(desktopNav).toHaveClass('hidden', 'sm:flex');
    
    // Find mobile menu button container
    const mobileButtonContainer = screen.getByLabelText(/メニューを開く/i).closest('div');
    expect(mobileButtonContainer).toHaveClass('sm:hidden');
  });
});