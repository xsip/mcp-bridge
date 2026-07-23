import { Component, ElementRef, forwardRef, input, viewChild } from '@angular/core';
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroBars3BottomLeft,
  heroBold,
  heroItalic,
  heroLink,
  heroListBullet,
  heroNumberedList,
  heroUnderline,
} from '@ng-icons/heroicons/outline';

/**
 * Minimal WYSIWYG editor for the marketplace description field — a
 * `contenteditable` region driven by `document.execCommand` (still broadly
 * supported despite being nominally deprecated; there's no successor API for
 * this scope, and pulling in a full editor library like Quill/TipTap felt
 * disproportionate for "bold/italic/lists/link"). Implements
 * `ControlValueAccessor` so it plugs into `[(ngModel)]` exactly like every
 * other form field in this app (none of which use reactive forms).
 *
 * The value is raw HTML. Angular's `[innerHTML]` binding sanitizes on
 * display everywhere this is rendered back out, so unsafe markup (e.g. a
 * pasted `<script>`) never executes — it just gets stripped by Angular's
 * built-in sanitizer at render time, not here at edit time.
 */
@Component({
  selector: 'app-rich-text-editor',
  standalone: true,
  imports: [NgIconComponent],
  viewProviders: [provideIcons({ heroBold, heroItalic, heroUnderline, heroListBullet, heroNumberedList, heroLink, heroBars3BottomLeft })],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RichTextEditorComponent),
      multi: true,
    },
  ],
  template: `
    <div class="rounded-lg border border-border-default bg-primary" [class.opacity-60]="disabled">
      <div class="flex flex-wrap items-center gap-0.5 border-b border-border-subtle p-1.5">
        <button type="button" tabindex="-1" (mousedown)="exec($event, 'bold')" class="toolbar-btn" aria-label="Bold">
          <ng-icon name="heroBold" class="h-3.5 w-3.5" />
        </button>
        <button type="button" tabindex="-1" (mousedown)="exec($event, 'italic')" class="toolbar-btn" aria-label="Italic">
          <ng-icon name="heroItalic" class="h-3.5 w-3.5" />
        </button>
        <button type="button" tabindex="-1" (mousedown)="exec($event, 'underline')" class="toolbar-btn" aria-label="Underline">
          <ng-icon name="heroUnderline" class="h-3.5 w-3.5" />
        </button>
        <span class="mx-1 h-4 w-px bg-border-subtle"></span>
        <button type="button" tabindex="-1" (mousedown)="exec($event, 'insertUnorderedList')" class="toolbar-btn" aria-label="Bulleted list">
          <ng-icon name="heroListBullet" class="h-3.5 w-3.5" />
        </button>
        <button type="button" tabindex="-1" (mousedown)="exec($event, 'insertOrderedList')" class="toolbar-btn" aria-label="Numbered list">
          <ng-icon name="heroNumberedList" class="h-3.5 w-3.5" />
        </button>
        <span class="mx-1 h-4 w-px bg-border-subtle"></span>
        <button type="button" tabindex="-1" (mousedown)="link($event)" class="toolbar-btn" aria-label="Insert link">
          <ng-icon name="heroLink" class="h-3.5 w-3.5" />
        </button>
        <button type="button" tabindex="-1" (mousedown)="exec($event, 'removeFormat')" class="toolbar-btn" aria-label="Clear formatting">
          <ng-icon name="heroBars3BottomLeft" class="h-3.5 w-3.5" />
        </button>
      </div>

      <div
        #editable
        [id]="editorId()"
        class="min-h-[6rem] max-w-none px-3 py-2 text-sm text-text-primary focus:outline-none [&_a]:text-accent [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
        [attr.contenteditable]="!disabled"
        (input)="onInput()"
        (blur)="onTouched()"
      ></div>
    </div>
  `,
  styles: `
    .toolbar-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 1.75rem;
      width: 1.75rem;
      border-radius: 0.375rem;
      color: var(--color-text-secondary);
    }
    .toolbar-btn:hover {
      background: var(--color-accent-subtle);
      color: var(--color-accent);
    }
  `,
})
export class RichTextEditorComponent implements ControlValueAccessor {
  /** Id applied to the editable region — pass one in so an external `<label for>` can target it. */
  readonly editorId = input<string | undefined>(undefined);

  private readonly editable = viewChild.required<ElementRef<HTMLDivElement>>('editable');

  protected disabled = false;
  private onChange: (value: string) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    const el = this.editable().nativeElement;
    // Only touch the DOM when the incoming value actually differs — avoids
    // clobbering cursor position on every keystroke's own writeValue echo.
    if (el.innerHTML !== (value ?? '')) {
      el.innerHTML = value ?? '';
    }
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  protected onInput(): void {
    this.onChange(this.editable().nativeElement.innerHTML);
  }

  protected exec(event: MouseEvent, command: string): void {
    event.preventDefault(); // keeps focus (and the current selection) inside the editable region
    document.execCommand(command);
    this.onInput();
  }

  protected link(event: MouseEvent): void {
    event.preventDefault();
    const url = window.prompt('Link URL');
    if (!url) return;
    document.execCommand('createLink', false, url);
    this.onInput();
  }
}
