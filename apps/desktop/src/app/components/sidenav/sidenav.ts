import {Component, inject, input} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroArrowRightOnRectangle,
  heroExclamationTriangle,
  heroKey,
  heroListBullet,
  heroServerStack
} from '@ng-icons/heroicons/outline';
import { DarkModeToggleComponent, LanguageSwitcherComponent } from '@mcp-bridge/ui-components';
import { AuthStore } from '../../core/auth/auth.store';
import { AgentBridgeService } from '../../core/agent/agent-bridge.service';
import {TooltipDirective} from "../../directives/tooltip.directive";

/**
 * Left-hand navigation for the authenticated shell — "MCPS" (configure
 * MCPs) and "Logs" (proxied request/response history), plus the agent
 * connection indicator, dark-mode toggle, and logout at the bottom.
 */
@Component({
  selector: 'ui-sidenav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslatePipe, NgIconComponent, DarkModeToggleComponent, LanguageSwitcherComponent, TooltipDirective],
  viewProviders: [provideIcons({ heroServerStack, heroListBullet, heroArrowRightOnRectangle, heroKey,heroExclamationTriangle })],
  template: `
    <aside
      class="flex h-full {{smallMode() ? 'w-16' : 'w-56'}} shrink-0 flex-col border-r border-border-default  bg-primary-2">
      <div class="flex items-center justify-center flex-col gap-2 py-5">
        <img src="favicon.png" alt="MCP Bridge" class="w-24 animate-float"/>
        @if (!smallMode()) {
          <span class="text-sm font-semibold tracking-tight text-text-primary">MCP Bridge</span>
        }
      </div>

      <nav class="flex-1 space-y-1 px-3 stagger-children">
        <a
          routerLink="/mcps"
          uiTooltipPosition="right"
          [uiTooltip]="smallMode() ? ('sidenav.mcps' | translate): ''"
          routerLinkActive="bg-accent-subtle text-accent shadow-depth-sm"
          class="msg-enter flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-text-secondary hover:bg-accent-subtle hover:text-accent hover:translate-x-0.5"
        >
          <ng-icon name="heroServerStack" class="h-4 w-4"/>
          @if (!smallMode()) {
            {{ 'sidenav.mcps' | translate }}
          }
        </a>
        <a
          routerLink="/logs"
          uiTooltipPosition="right"
          [uiTooltip]="smallMode() ? ('sidenav.logs' | translate): ''"
          routerLinkActive="bg-accent-subtle text-accent shadow-depth-sm"
          class="msg-enter flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-text-secondary hover:bg-accent-subtle hover:text-accent hover:translate-x-0.5"
        >
          <ng-icon name="heroListBullet" class="h-4 w-4"/>
          @if (!smallMode()) {
            {{ 'sidenav.logs' | translate }}
          }
        </a>
        <a
          routerLink="/auth-keys"
          uiTooltipPosition="right"
          [uiTooltip]="smallMode() ? ('sidenav.apiKeys' | translate): ''"

          routerLinkActive="bg-accent-subtle text-accent shadow-depth-sm"
          class="msg-enter flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-text-secondary hover:bg-accent-subtle hover:text-accent hover:translate-x-0.5"
        >
          <ng-icon name="heroKey" class="h-4 w-4"/>
          @if (!smallMode()) {
            {{ 'sidenav.apiKeys' | translate }}
          }
        </a>
      </nav>

      <div class="space-y-3 border-t border-border-subtle p-3">
        @if (agentBridge.bridgeAvailable()) {
          <div class="flex items-center {{smallMode() ? 'justify-center': ''}} gap-2 px-2 text-xs text-text-muted">
            <span
              class="h-2 w-2 rounded-full transition-colors duration-300"
              [class.bg-success-muted]="agentBridge.status() === 'connected'"
              [class.animate-glow-pulse]="agentBridge.status() === 'connected'"
              [class.bg-warn-muted]="agentBridge.status() === 'connecting'"
              [class.animate-pulse]="agentBridge.status() === 'connecting'"
              [class.bg-error-muted]="agentBridge.status() === 'error'"
              [class.bg-text-disabled]="agentBridge.status() === 'disconnected'"
              uiTooltipPosition="right"
              [uiTooltip]="smallMode() ? ('sidenav.agentStatus.' + agentBridge.status()  | translate): ''"
            ></span>
            @if(!smallMode()) {
              {{ 'sidenav.agentStatus.' + agentBridge.status() | translate }}
            }
          </div>
        } @else {
          @if(smallMode()) {
            <div
              uiTooltipPosition="right"
              [uiTooltip]="smallMode() ? ('sidenav.notElectron' | translate): ''"
              class="flex w-full items-center justify-center">
            <ng-icon [name]="'heroExclamationTriangle'" class="h-3.5 w-3.5"/>
            </div>
          } @else {
            <p class="px-2 text-xs text-text-muted">{{ 'sidenav.notElectron' | translate }}</p>
          }
        }

        @if (authStore.username(); as username) {
          @if(!smallMode()) {
          <p class="truncate px-2 text-xs text-text-muted">{{ username }}</p>

          }
        }
        <div class="flex items-center {{smallMode() ? 'flex-col justify-center gap-2': 'justify-between px-1'}}  ">

          <div class="flex items-center {{smallMode() ? 'flex-col gap-2': 'gap-1.5'}}">
            <div
              uiTooltipPosition="right"
              [uiTooltip]="smallMode() ? ('sidenav.darkModeToggle' | translate): ''"
              >
            <ui-dark-mode-toggle/>
            </div>

            <ui-language-switcher />
          </div>

          <button
            type="button"
            (click)="authStore.logout()"
            uiTooltipPosition="right"
            [uiTooltip]="smallMode() ? ('sidenav.logout' | translate): ''"

            class="press-feedback inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-text-secondary hover:bg-error-bg hover:text-error-text"
          >
            <ng-icon name="heroArrowRightOnRectangle" class="h-3.5 w-3.5"/>
            @if(!smallMode()) {
              {{ 'sidenav.logout' | translate }}
            }
          </button>
        </div>
      </div>
    </aside>
  `,
})
export class SidenavComponent {
  smallMode = input<boolean>();
  protected readonly authStore = inject(AuthStore);
  protected readonly agentBridge = inject(AgentBridgeService);
}
