import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SyncModeSelector } from './SyncModeSelector';

describe('SyncModeSelector', () => {
  const mockOnSelect = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders all sync mode options', () => {
      render(
        <SyncModeSelector
          open={true}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />
      );

      // Check all enabled options are visible
      expect(screen.getByText('Bi-directional Sync')).toBeInTheDocument();
      expect(screen.getByText('One-way Transfer')).toBeInTheDocument();
      expect(screen.getByText('Multi-Source → Single Target')).toBeInTheDocument();
      expect(screen.getByText('Single Source → Multi-Target')).toBeInTheDocument();
    });

    it('renders dialog title and description', () => {
      render(
        <SyncModeSelector
          open={true}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Select Sync Mode')).toBeInTheDocument();
      expect(screen.getByText(/Choose how you want to synchronize/i)).toBeInTheDocument();
    });

    it('shows descriptions for each mode', () => {
      render(
        <SyncModeSelector
          open={true}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/Merge changes between Claude and OpenCode/i)).toBeInTheDocument();
      expect(screen.getByText(/Transfer config from one source to another/i)).toBeInTheDocument();
    });

    it('shows disabled state for future modes', () => {
      render(
        <SyncModeSelector
          open={true}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />
      );

      // Find the disabled mode buttons/cards
      const multiSourceOption = screen.getByText('Multi-Source → Single Target').closest('button, [role="option"], [data-testid="sync-mode-option"]');
      const singleSourceOption = screen.getByText('Single Source → Multi-Target').closest('button, [role="option"], [data-testid="sync-mode-option"]');
      
      expect(multiSourceOption).toHaveAttribute('aria-disabled', 'true');
      expect(singleSourceOption).toHaveAttribute('aria-disabled', 'true');
    });

    it('shows "Coming soon" badge for disabled modes', () => {
      render(
        <SyncModeSelector
          open={true}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />
      );

      const comingSoonBadges = screen.getAllByText('Coming Soon');
      expect(comingSoonBadges.length).toBe(2);
    });

    it('does not render when open is false', () => {
      render(
        <SyncModeSelector
          open={false}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.queryByText('Select Sync Mode')).not.toBeInTheDocument();
    });
  });

  describe('Selection behavior', () => {
    it('shows Continue button when bidirectional mode is selected', async () => {
      const user = userEvent.setup();
      render(
        <SyncModeSelector
          open={true}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />
      );

      // Initially no Continue button
      expect(screen.queryByTestId('confirm-sync-mode')).not.toBeInTheDocument();

      const bidirectionalOption = screen.getByText('Bi-directional Sync').closest('button, [role="option"], [data-testid="sync-mode-option"]');
      await user.click(bidirectionalOption!);

      // Now Continue button should appear, but onSelect should NOT be called yet
      expect(mockOnSelect).not.toHaveBeenCalled();
      expect(screen.getByTestId('confirm-sync-mode')).toBeInTheDocument();
    });

    it('calls onSelect with bidirectional mode when Continue is clicked', async () => {
      const user = userEvent.setup();
      render(
        <SyncModeSelector
          open={true}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />
      );

      const bidirectionalOption = screen.getByText('Bi-directional Sync').closest('button, [role="option"], [data-testid="sync-mode-option"]');
      await user.click(bidirectionalOption!);

      const continueButton = screen.getByTestId('confirm-sync-mode');
      await user.click(continueButton);

      expect(mockOnSelect).toHaveBeenCalledWith({ mode: 'bidirectional' });
    });

    it('shows one-way config when one-way transfer is selected', async () => {
      const user = userEvent.setup();
      render(
        <SyncModeSelector
          open={true}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />
      );

      const oneWayOption = screen.getByText('One-way Transfer').closest('button, [role="option"], [data-testid="sync-mode-option"]');
      await user.click(oneWayOption!);

      // Should show the config panel but not call onSelect yet
      expect(mockOnSelect).not.toHaveBeenCalled();
      expect(screen.getByTestId('one-way-config')).toBeInTheDocument();
      expect(screen.getByTestId('source-select')).toBeInTheDocument();
      expect(screen.getByTestId('destination-select')).toBeInTheDocument();
      expect(screen.getByTestId('confirm-sync-mode')).toBeInTheDocument();
    });

    it('calls onSelect with one-way config when continue is clicked', async () => {
      const user = userEvent.setup();
      render(
        <SyncModeSelector
          open={true}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />
      );

      // Select one-way mode
      const oneWayOption = screen.getByText('One-way Transfer').closest('button, [role="option"], [data-testid="sync-mode-option"]');
      await user.click(oneWayOption!);

      // Click continue (default source=claude, destination=opencode)
      const continueButton = screen.getByTestId('confirm-sync-mode');
      await user.click(continueButton);

      expect(mockOnSelect).toHaveBeenCalledWith({
        mode: 'one-way',
        oneWayConfig: {
          source: 'claude',
          destination: 'opencode',
        },
      });
    });

    it('does not call onSelect when disabled mode is clicked', async () => {
      const user = userEvent.setup();
      render(
        <SyncModeSelector
          open={true}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />
      );

      const disabledOption = screen.getByText('Multi-Source → Single Target').closest('button, [role="option"], [data-testid="sync-mode-option"]');
      await user.click(disabledOption!);

      expect(mockOnSelect).not.toHaveBeenCalled();
    });
  });

  describe('One-way config behavior', () => {
    it('shows direction preview based on selections', async () => {
      const user = userEvent.setup();
      render(
        <SyncModeSelector
          open={true}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />
      );

      // Select one-way mode
      const oneWayOption = screen.getByText('One-way Transfer').closest('button, [role="option"], [data-testid="sync-mode-option"]');
      await user.click(oneWayOption!);

      // Check default direction preview
      const configPanel = screen.getByTestId('one-way-config');
      expect(within(configPanel).getByText(/Claude Desktop → OpenCode/)).toBeInTheDocument();
    });

    it('shows Continue button only when a valid mode is selected', async () => {
      const user = userEvent.setup();
      render(
        <SyncModeSelector
          open={true}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />
      );

      // Initially no Continue button
      expect(screen.queryByTestId('confirm-sync-mode')).not.toBeInTheDocument();

      // Select bidirectional mode
      const bidirectionalOption = screen.getByText('Bi-directional Sync').closest('button, [role="option"], [data-testid="sync-mode-option"]');
      await user.click(bidirectionalOption!);

      // Now Continue button should appear
      expect(screen.getByTestId('confirm-sync-mode')).toBeInTheDocument();
    });
  });

  describe('Cancel behavior', () => {
    it('calls onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <SyncModeSelector
          open={true}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('Default selection', () => {
    it('highlights bidirectional as the default/recommended option', () => {
      render(
        <SyncModeSelector
          open={true}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />
      );

      // Look for recommended badge
      const recommendedBadge = screen.getByText('Recommended');
      expect(recommendedBadge).toBeInTheDocument();
      
      // The recommended badge should be inside the bidirectional option
      const bidirectionalOption = screen.getByText('Bi-directional Sync').closest('[data-testid="sync-mode-option"]');
      expect(bidirectionalOption).toBeInTheDocument();
      expect(bidirectionalOption!.querySelector('[data-testid="recommended-badge"]')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper dialog role and label', () => {
      render(
        <SyncModeSelector
          open={true}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-labelledby');
    });

    it('can be navigated with keyboard', async () => {
      const user = userEvent.setup();
      render(
        <SyncModeSelector
          open={true}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />
      );

      // Click on the bidirectional option to select it via keyboard simulation
      const bidirectionalOption = screen.getByText('Bi-directional Sync').closest('[data-testid="sync-mode-option"]') as HTMLElement;
      bidirectionalOption?.focus();
      
      // Press Enter to select the mode
      await user.keyboard('{Enter}');
      
      // Mode is selected, now Continue button is available
      const continueButton = screen.getByTestId('confirm-sync-mode');
      await user.click(continueButton);
      
      expect(mockOnSelect).toHaveBeenCalledWith({ mode: 'bidirectional' });
    });
  });
});
