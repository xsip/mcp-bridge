import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroCheck } from '@ng-icons/heroicons/outline';

/**
 * Design-system checkbox — a drop-in replacement for the native
 * `<input type="checkbox">`, which doesn't pick up the app's theme.
 *
 * Same binding shape as the native element it replaces:
 *   <ui-checkbox [checked]="cond" (checkedChange)="onToggle()" />
 * `(checkedChange)` emits the new boolean value but existing call sites
 * that only care "something changed" can ignore the argument, same as they
 * ignored the native `(change)` event before.
 *
 * Stops the underlying click from propagating, so it's safe to nest inside
 * a larger clickable row (e.g. a "click anywhere to toggle" label) without
 * the click firing twice.
 */
@Component({
  selector: 'ui-checkbox',
  standalone: true,
  imports: [NgIconComponent],
  viewProviders: [provideIcons({ heroCheck })],
  template: `
    <button
      type="button"
      role="checkbox"
      [attr.aria-checked]="checked"
      [attr.aria-label]="ariaLabel || null"
      [disabled]="disabled"
      (click)="onClick($event)"
      class="inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border-default bg-primary transition-all duration-150 hover:border-accent/50 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-50"
      [class.bg-accent]="checked"
      [class.border-accent]="checked"
    >
      @if (checked) {
        <ng-icon name="heroCheck" class="h-3 w-3 animate-scale-in text-white" />
      }
    </button>
  `,
})
export class CheckboxComponent {
  @Input() checked = false;
  @Input() disabled = false;
  @Input() ariaLabel?: string;
  @Output() checkedChange = new EventEmitter<boolean>();

  protected onClick(event: Event): void {
    event.stopPropagation();
    if (this.disabled) return;
    this.checked = !this.checked;
    this.checkedChange.emit(this.checked);
  }
}
