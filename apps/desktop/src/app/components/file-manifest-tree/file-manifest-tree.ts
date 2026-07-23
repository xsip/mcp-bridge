import { Component, computed, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroChevronDown, heroChevronRight, heroDocument, heroFolder } from '@ng-icons/heroicons/outline';
import { MarketPlaceItemAssetManifestEntryDto } from '@mcp-loop/ui-client';

interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  children: TreeNode[];
}

/**
 * Renders the flat `fileManifest` captured at zip-upload time (see
 * `MarketplaceService.addVersion`) as a collapsible folder/file tree, so a
 * user can inspect what a version contains before downloading it.
 */
@Component({
  selector: 'app-file-manifest-tree',
  standalone: true,
  imports: [NgTemplateOutlet, NgIconComponent],
  viewProviders: [provideIcons({ heroChevronDown, heroChevronRight, heroDocument, heroFolder })],
  template: `
    <ul class="space-y-0.5">
      @for (node of tree(); track node.path) {
        <ng-container [ngTemplateOutlet]="nodeTpl" [ngTemplateOutletContext]="{ $implicit: node, depth: 0 }" />
      }
    </ul>

    <ng-template #nodeTpl let-node let-depth="depth">
      <li>
        <button
          type="button"
          class="press-feedback flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs hover:bg-primary-2"
          [style.padding-left.px]="depth * 16 + 6"
          (click)="node.isDirectory && toggle(node.path)"
        >
          @if (node.isDirectory) {
            <ng-icon [name]="isExpanded(node.path) ? 'heroChevronDown' : 'heroChevronRight'" class="h-3 w-3 shrink-0 text-text-muted" />
            <ng-icon name="heroFolder" class="h-3.5 w-3.5 shrink-0 text-text-muted" />
          } @else {
            <span class="w-3 shrink-0"></span>
            <ng-icon name="heroDocument" class="h-3.5 w-3.5 shrink-0 text-text-muted" />
          }
          <span class="min-w-0 flex-1 truncate text-text-primary">{{ node.name }}</span>
          @if (!node.isDirectory) {
            <span class="shrink-0 text-text-muted">{{ formatSize(node.size) }}</span>
          }
        </button>

        @if (node.isDirectory && isExpanded(node.path)) {
          <ul>
            @for (child of node.children; track child.path) {
              <ng-container [ngTemplateOutlet]="nodeTpl" [ngTemplateOutletContext]="{ $implicit: child, depth: depth + 1 }" />
            }
          </ul>
        }
      </li>
    </ng-template>
  `,
  styles: ``,
})
export class FileManifestTreeComponent {
  readonly entries = input.required<MarketPlaceItemAssetManifestEntryDto[]>();

  private readonly expandedPaths = signal(new Set<string>());

  protected readonly tree = computed(() => buildTree(this.entries()));

  protected isExpanded(path: string): boolean {
    return this.expandedPaths().has(path);
  }

  protected toggle(path: string): void {
    const next = new Set(this.expandedPaths());
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    this.expandedPaths.set(next);
  }

  protected formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB'];
    let value = bytes / 1024;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }
    return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unitIndex]}`;
  }
}

function buildTree(entries: MarketPlaceItemAssetManifestEntryDto[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', isDirectory: true, size: 0, children: [] };
  const nodesByPath = new Map<string, TreeNode>([['', root]]);

  for (const entry of entries) {
    const segments = entry.path.split('/').filter(Boolean);
    let parent = root;
    let pathSoFar = '';

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      pathSoFar = pathSoFar ? `${pathSoFar}/${segment}` : segment;
      const isLastSegment = i === segments.length - 1;

      let node = nodesByPath.get(pathSoFar);
      if (!node) {
        node = {
          name: segment,
          path: pathSoFar,
          isDirectory: isLastSegment ? entry.isDirectory : true,
          size: isLastSegment ? entry.size : 0,
          children: [],
        };
        nodesByPath.set(pathSoFar, node);
        parent.children.push(node);
      }
      parent = node;
    }
  }

  const sortChildren = (node: TreeNode): void => {
    node.children.sort((a, b) => (a.isDirectory === b.isDirectory ? a.name.localeCompare(b.name) : a.isDirectory ? -1 : 1));
    node.children.forEach(sortChildren);
  };
  sortChildren(root);

  return root.children;
}
