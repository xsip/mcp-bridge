import { Component, OnInit, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroLanguage } from '@ng-icons/heroicons/outline';
import { SupportedLang, applyLang, readStoredLang } from './language.utils';

/**
 * Self-contained language switcher (English / German). Reads the stored
 * preference on init and applies it immediately — same pattern as
 * `DarkModeToggleComponent`. Only two languages are supported today, so
 * this is a simple toggle rather than a dropdown; each click flips to the
 * other language, in real time, and persists the choice to localStorage.
 *
 * Usage:
 *   <ui-language-switcher />
 */
@Component({
  selector: 'ui-language-switcher',
  standalone: true,
  imports: [TranslatePipe, NgIconComponent],
  viewProviders: [provideIcons({ heroLanguage })],
  template: `
    <button
      type="button"
      (click)="toggle()"
      class="inline-flex h-8 items-center gap-1.5 rounded-xl border border-border-default px-2.5 text-xs font-semibold text-text-secondary hover:border-accent/50 hover:bg-accent-subtle hover:text-accent active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      [title]="'language.switch' | translate"
      style="transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);"
    >
      <ng-icon name="heroLanguage" class="h-3.5 w-3.5" />
      <span class="uppercase">{{ lang() }}</span>
    </button>
  `,
})
export class LanguageSwitcherComponent implements OnInit {
  private readonly translate = inject(TranslateService);
  readonly lang = signal<SupportedLang>(readStoredLang());

  ngOnInit(): void {
    applyLang(this.translate, this.lang());
  }

  toggle(): void {
    const next: SupportedLang = this.lang() === 'en' ? 'de' : 'en';
    this.lang.set(next);
    applyLang(this.translate, next);
  }
}
