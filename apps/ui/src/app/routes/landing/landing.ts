import {AfterViewInit, Component, inject} from '@angular/core';
import {RouterLink} from '@angular/router';
import {TranslatePipe} from '@ngx-translate/core';
import {NgIconComponent, provideIcons} from '@ng-icons/core';
import {
  heroArrowRight,
  heroBolt,
  heroChatBubbleLeftRight,
  heroCommandLine,
  heroLockClosed,
  heroPuzzlePiece,
  heroRocketLaunch,
  heroServerStack,
  heroShieldCheck,
  heroSignal,
} from '@ng-icons/heroicons/outline';
import {ActiveSectionService} from '../../services/active-section.service';
import {AnimateOnScrollDirective} from '../../directives/animate-on-scroll.directive';

interface Step {
  icon: string;
  titleKey: string;
  descriptionKey: string;
}

interface Feature {
  icon: string;
  titleKey: string;
  descriptionKey: string;
}

interface FaqItem {
  questionKey: string;
  answerKey: string;
}

/** ids of every in-page section the nav/sidenav can scroll to and highlight. */
const SECTION_HREFS = ['#how-it-works', '#features', '#faq'];

const STEPS: Step[] = [
  { icon: 'heroLockClosed', titleKey: 'landing.steps.register.title', descriptionKey: 'landing.steps.register.description' },
  { icon: 'heroCommandLine', titleKey: 'landing.steps.agent.title', descriptionKey: 'landing.steps.agent.description' },
  { icon: 'heroSignal', titleKey: 'landing.steps.connect.title', descriptionKey: 'landing.steps.connect.description' },
  { icon: 'heroChatBubbleLeftRight', titleKey: 'landing.steps.use.title', descriptionKey: 'landing.steps.use.description' },
];

const FEATURES: Feature[] = [
  { icon: 'heroLockClosed', titleKey: 'landing.features.noPortForwarding.title', descriptionKey: 'landing.features.noPortForwarding.description' },
  { icon: 'heroServerStack', titleKey: 'landing.features.multipleMcps.title', descriptionKey: 'landing.features.multipleMcps.description' },
  { icon: 'heroShieldCheck', titleKey: 'landing.features.secureAuth.title', descriptionKey: 'landing.features.secureAuth.description' },
  { icon: 'heroBolt', titleKey: 'landing.features.realtime.title', descriptionKey: 'landing.features.realtime.description' },
  { icon: 'heroPuzzlePiece', titleKey: 'landing.features.anyClient.title', descriptionKey: 'landing.features.anyClient.description' },
  { icon: 'heroCommandLine', titleKey: 'landing.features.openArchitecture.title', descriptionKey: 'landing.features.openArchitecture.description' },
];

const FAQ: FaqItem[] = [
  { questionKey: 'landing.faq.items.whatIsMcp.question', answerKey: 'landing.faq.items.whatIsMcp.answer' },
  { questionKey: 'landing.faq.items.security.question', answerKey: 'landing.faq.items.security.answer' },
  { questionKey: 'landing.faq.items.selfHost.question', answerKey: 'landing.faq.items.selfHost.answer' },
  { questionKey: 'landing.faq.items.multipleAgents.question', answerKey: 'landing.faq.items.multipleAgents.answer' },
];

/**
 * Public marketing landing page — the app's main route (`''`). Explains
 * the MCP Bridge use case (expose a localhost MCP server publicly without
 * port forwarding) and funnels visitors toward the dashboard/login CTA,
 * which is intentionally out of scope for this component.
 */
@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, TranslatePipe, NgIconComponent, AnimateOnScrollDirective],
  viewProviders: [
    provideIcons({
      heroArrowRight,
      heroBolt,
      heroChatBubbleLeftRight,
      heroCommandLine,
      heroLockClosed,
      heroPuzzlePiece,
      heroRocketLaunch,
      heroServerStack,
      heroShieldCheck,
      heroSignal,
    }),
  ],
  template: `
    <!-- Hero -->
    <section class="relative overflow-hidden bg-dot-grid">
      <div class="mx-auto flex max-w-6xl flex-col items-center px-6 pb-20 pt-5 text-center md:pt-5">
        <span
          class="mb-6 inline-flex items-center gap-2 rounded-full border border-border-default bg-primary-2 px-4 py-1.5 text-xs font-medium text-text-secondary animate-fade-in"
        >
          <ng-icon name="heroRocketLaunch" class="h-3.5 w-3.5 text-accent" />
          {{ 'landing.hero.eyebrow' | translate }}
        </span>

        <h1 class="mb-5 text-4xl font-semibold tracking-tight text-text-primary animate-slide-up md:text-6xl">
          {{ 'landing.hero.title' | translate }}
          <span class="text-gradient-accent">{{ 'landing.hero.titleHighlight' | translate }}</span>
        </h1>

        <img
          class="dark:hidden mt-5 block mb-5 rounded-xl"
          [src]="'preview/logs-light.png'"
          role="img"
          alt="logs  light"
        />
        <img
          class="dark:block mt-5 hidden mb-5 rounded-xl"
          [src]="'preview/logs-dark.png'"
          role="img"
          alt="logs dark"
        />

        <p class="mt-6 max-w-2xl text-lg text-text-secondary animate-slide-up">
          {{ 'landing.hero.subtitle' | translate }}
        </p>

        <div class="mt-10 flex flex-col items-center gap-3 sm:flex-row animate-slide-up">
          <a
            routerLink="/dashboard"
            class="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white shadow-glow-accent hover-lift"
          >
            {{ 'landing.hero.primaryCta' | translate }}
            <ng-icon name="heroArrowRight" class="h-4 w-4" />
          </a>
          <a
            href="#how-it-works"
            (click)="onSectionLinkClick($event, 'how-it-works')"
            class="inline-flex items-center gap-2 rounded-xl border border-border-default bg-primary px-6 py-3 text-sm font-semibold text-text-primary hover-lift"
          >
            {{ 'landing.hero.secondaryCta' | translate }}
          </a>
        </div>

        <!-- Request-flow snippet -->
        <div
          uiAnimateOnScroll="zoom"
          class="mt-16 w-full max-w-2xl overflow-hidden rounded-2xl border border-border-default bg-primary-2 text-left shadow-depth-lg glass"
        >
          <div class="flex items-center gap-1.5 border-b border-border-subtle px-4 py-3">
            <span class="h-2.5 w-2.5 rounded-full bg-error-muted"></span>
            <span class="h-2.5 w-2.5 rounded-full bg-warn-muted"></span>
            <span class="h-2.5 w-2.5 rounded-full bg-success-muted"></span>
            <span class="ml-2 text-xs text-text-muted">{{ 'landing.hero.snippetLabel' | translate }}</span>
          </div>
          <pre class="overflow-x-auto px-4 py-4 font-mono text-xs leading-relaxed text-text-secondary"><code
          ><span class="text-code-comment"># {{ 'landing.hero.snippetComment' | translate }}</span>
GET https:&#47;&#47;bridge.example.com&#47;mcp&#47;alice-notes&#47;tools&#47;list

<span class="text-code-property">→</span> {{ 'landing.hero.snippetArrow' | translate }}</code></pre>
        </div>

        <!--<div class=" w-full h-full bg-[url('/preview/logs-light.png')] dark:bg-[url('/preview/logs-dark.png')] bg-contain bg-center bg-no-repeat"></div>!-->



      </div>
    </section>

    <!-- How it works -->
    <section id="how-it-works" class="border-t border-border-subtle bg-primary px-6 py-20">
      <div class="mx-auto max-w-6xl">
        <div uiAnimateOnScroll="up" class="mx-auto max-w-2xl text-center">
          <h2 class="text-3xl font-semibold tracking-tight text-text-primary">{{ 'landing.howItWorks.title' | translate }}</h2>
          <p class="mt-3 text-text-secondary">{{ 'landing.howItWorks.subtitle' | translate }}</p>
        </div>

        <ol class="mt-14 grid gap-6 md:grid-cols-4">
          @for (step of steps; track step.titleKey; let i = $index) {
            <li uiAnimateOnScroll="up" [aosDelay]="i * 80" class="relative rounded-2xl border border-border-default bg-primary-2 p-6 hover-lift">
              <span class="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent-subtle text-accent-text">
                <ng-icon [name]="step.icon" class="h-5 w-5" />
              </span>
              <span class="absolute right-6 top-6 text-sm font-semibold text-text-disabled">{{ i + 1 }}</span>
              <h3 class="text-sm font-semibold text-text-primary">{{ step.titleKey | translate }}</h3>
              <p class="mt-2 text-sm text-text-secondary">{{ step.descriptionKey | translate }}</p>
            </li>
          }
        </ol>
      </div>
    </section>

    <!-- Architecture -->
    <section id="architecture" class="border-t border-border-subtle bg-primary-2 px-6 py-20">
      <div class="mx-auto max-w-5xl">
        <div uiAnimateOnScroll="up" class="mx-auto max-w-2xl text-center">
          <h2 class="text-3xl font-semibold tracking-tight text-text-primary">{{ 'landing.architecture.title' | translate }}</h2>
          <p class="mt-3 text-text-secondary">{{ 'landing.architecture.subtitle' | translate }}</p>
        </div>

        <div class="mt-14 flex flex-col items-center gap-4 md:flex-row md:justify-between">
          <div uiAnimateOnScroll="right" class="flex-1 rounded-2xl border border-border-default bg-primary p-6 text-center shadow-depth-sm">
            <ng-icon name="heroChatBubbleLeftRight" class="mx-auto h-6 w-6 text-secondary-accent-text" />
            <p class="mt-3 text-sm font-semibold text-text-primary">{{ 'landing.architecture.client.title' | translate }}</p>
            <p class="mt-1 text-xs text-text-muted">{{ 'landing.architecture.client.description' | translate }}</p>
          </div>

          <ng-icon name="heroArrowRight" class="h-5 w-5 shrink-0 rotate-90 text-text-disabled md:rotate-0" />

          <div uiAnimateOnScroll="zoom" [aosDelay]="80" class="flex-1 rounded-2xl border border-accent/40 bg-primary p-6 text-center shadow-glow-accent">
            <ng-icon name="heroServerStack" class="mx-auto h-6 w-6 text-accent-text" />
            <p class="mt-3 text-sm font-semibold text-text-primary">{{ 'landing.architecture.backend.title' | translate }}</p>
            <p class="mt-1 text-xs text-text-muted">{{ 'landing.architecture.backend.description' | translate }}</p>
          </div>

          <ng-icon name="heroArrowRight" class="h-5 w-5 shrink-0 rotate-90 text-text-disabled md:rotate-0" />

          <div uiAnimateOnScroll="left" [aosDelay]="160" class="flex-1 rounded-2xl border border-border-default bg-primary p-6 text-center shadow-depth-sm">
            <ng-icon name="heroCommandLine" class="mx-auto h-6 w-6 text-tertiary-accent-text" />
            <p class="mt-3 text-sm font-semibold text-text-primary">{{ 'landing.architecture.agent.title' | translate }}</p>
            <p class="mt-1 text-xs text-text-muted">{{ 'landing.architecture.agent.description' | translate }}</p>
          </div>
        </div>

        <p class="mx-auto mt-10 max-w-2xl text-center text-sm text-text-muted">
          {{ 'landing.architecture.note' | translate }}
        </p>
      </div>
    </section>

    <!-- Features -->
    <section id="features" class="border-t border-border-subtle bg-primary px-6 py-20">
      <div class="mx-auto max-w-6xl">
        <div uiAnimateOnScroll="up" class="mx-auto max-w-2xl text-center">
          <h2 class="text-3xl font-semibold tracking-tight text-text-primary">{{ 'landing.features.title' | translate }}</h2>
          <img
            class="dark:hidden mt-5 block mb-5 rounded-xl"
            [src]="'preview/mcp-list-light.png'"
            role="img"
            alt="mcp list light"
          />
          <img
            class="dark:block mt-5 hidden mb-5 rounded-xl"
            [src]="'preview/mcp-list-dark.png'"
            role="img"
            alt="mcp list dark"
          />
          <p class="mt-3 text-text-secondary">{{ 'landing.features.subtitle' | translate }}</p>
        </div>

        <div class="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          @for (feature of features; track feature.titleKey; let i = $index) {
            <div uiAnimateOnScroll="up" [aosDelay]="(i % 3) * 80" class="rounded-2xl border border-border-default bg-primary-2 p-6 hover-lift">
              <span class="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent-subtle text-accent-text">
                <ng-icon [name]="feature.icon" class="h-5 w-5" />
              </span>
              <h3 class="text-sm font-semibold text-text-primary">{{ feature.titleKey | translate }}</h3>
              <p class="mt-2 text-sm text-text-secondary">{{ feature.descriptionKey | translate }}</p>
            </div>
          }
        </div>
      </div>
    </section>

    <!-- FAQ -->
    <section id="faq" class="border-t border-border-subtle bg-primary-2 px-6 py-20">
      <div class="mx-auto max-w-3xl">
        <h2 uiAnimateOnScroll="up" class="text-center text-3xl font-semibold tracking-tight text-text-primary">
          {{ 'landing.faq.title' | translate }}
        </h2>

        <div class="mt-10 space-y-3">
          @for (item of faq; track item.questionKey; let i = $index) {
            <details
              uiAnimateOnScroll="up"
              [aosDelay]="i * 60"
              class="group rounded-xl border border-border-default bg-primary p-5 open:shadow-depth-sm"
            >
              <summary class="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-text-primary">
                {{ item.questionKey | translate }}
                <ng-icon name="heroArrowRight" class="h-4 w-4 shrink-0 text-text-muted transition-transform group-open:rotate-90" />
              </summary>
              <p class="mt-3 text-sm text-text-secondary">{{ item.answerKey | translate }}</p>
            </details>
          }
        </div>
      </div>
    </section>

    <!-- Final CTA -->
    <section class="border-t border-border-subtle bg-primary px-6 py-20">
      <div
        uiAnimateOnScroll="zoom"
        class="mx-auto flex max-w-4xl flex-col items-center gap-6 rounded-3xl border border-accent/30 bg-primary-2 px-8 py-14 text-center shadow-glow-accent"
      >
        <h2 class="text-3xl font-semibold tracking-tight text-text-primary">{{ 'landing.finalCta.title' | translate }}</h2>
        <p class="max-w-xl text-text-secondary">{{ 'landing.finalCta.subtitle' | translate }}</p>
        <a
          routerLink="/dashboard"
          class="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white shadow-glow-accent hover-lift"
        >
          {{ 'landing.finalCta.button' | translate }}
          <ng-icon name="heroArrowRight" class="h-4 w-4" />
        </a>
      </div>
    </section>

    <!-- Footer -->
    <footer class="border-t border-border-subtle bg-primary px-6 py-10">
      <div class="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-text-muted md:flex-row">
        <div class="flex items-center gap-2">
          <img src="logo-no-text.png" alt="MCP Bridge" class="h-8" />
          <span>{{ 'landing.footer.copyright' | translate }}</span>
        </div>
        <p>{{ 'landing.footer.tagline' | translate }}</p>
      </div>
    </footer>
  `,
})
export class Landing implements AfterViewInit {
  private readonly activeSection = inject(ActiveSectionService);

  protected readonly steps = STEPS;
  protected readonly features = FEATURES;
  protected readonly faq = FAQ;

  ngAfterViewInit(): void {
    this.activeSection.observe(SECTION_HREFS);

    // Deep link support: `/#features` on first load should land on that section.
    if (typeof window !== 'undefined' && window.location.hash) {
      this.activeSection.scrollToSection(window.location.hash);
    }
  }

  protected onSectionLinkClick(event: Event, fragment: string): void {
    event.preventDefault();
    this.activeSection.scrollToSection('#' + fragment);
  }
}
