import { effect, inject } from '@angular/core';
import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { catchError, of, pipe, switchMap, tap } from 'rxjs';
import { AddCustomMcpDto, CustomMcpDto, McpsService, UpdateCustomMcpDto } from '@mcp-loop/ui-client';
import { extractErrorMessage } from '../http-error.util';
import { AgentBridgeService } from '../agent/agent-bridge.service';
import { ToastService } from '../toast/toast.service';

interface McpsState {
  items: CustomMcpDto[];
  status: 'idle' | 'loading' | 'error';
  error: string | null;
}

const initialState: McpsState = {
  items: [],
  status: 'idle',
  error: null,
};

/** CRUD state for the current user's configured MCPs, backing the "MCPS" route. */
export const McpsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, mcpsService = inject(McpsService), toast = inject(ToastService)) => ({
    load: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { status: 'loading', error: null })),
        switchMap(() =>
          mcpsService.listMcps().pipe(
            tap((items) => patchState(store, { items, status: 'idle' })),
            catchError(() => {
              patchState(store, { status: 'error', error: 'Failed to load MCPs.' });
              return of(null);
            }),
          ),
        ),
      ),
    ),

    add: rxMethod<AddCustomMcpDto>(
      pipe(
        tap(() => patchState(store, { status: 'loading', error: null })),
        switchMap((dto) =>
          mcpsService.addMcp(dto).pipe(
            tap((created) => {
              patchState(store, { items: [...store.items(), created], status: 'idle' });
              toast.success(`"${created.name}" added`);
            }),
            catchError((error: unknown) => {
              patchState(store, { status: 'error', error: extractErrorMessage(error) });
              return of(null);
            }),
          ),
        ),
      ),
    ),

    /** `silent` skips the toast — used for the active/inactive checkbox toggle, which shouldn't feel like a form save. */
    update: rxMethod<{ id: string; dto: UpdateCustomMcpDto; silent?: boolean }>(
      pipe(
        tap(() => patchState(store, { status: 'loading', error: null })),
        switchMap(({ id, dto, silent }) =>
          mcpsService.updateMcp(id, dto).pipe(
            tap((updated) => {
              patchState(store, {
                items: store.items().map((item) => (item.id === id ? updated : item)),
                status: 'idle',
              });
              if (!silent) toast.success(`"${updated.name}" updated`);
            }),
            catchError((error: unknown) => {
              patchState(store, { status: 'error', error: extractErrorMessage(error) });
              return of(null);
            }),
          ),
        ),
      ),
    ),

    remove: rxMethod<string>(
      pipe(
        tap(() => patchState(store, { status: 'loading', error: null })),
        switchMap((id) => {
          const removed = store.items().find((item) => item.id === id);
          return mcpsService.removeMcp(id).pipe(
            tap(() => {
              patchState(store, { items: store.items().filter((item) => item.id !== id), status: 'idle' });
              toast.success(removed ? `"${removed.name}" removed` : 'MCP removed');
            }),
            catchError((error: unknown) => {
              patchState(store, { status: 'error', error: extractErrorMessage(error) });
              return of(null);
            }),
          );
        }),
      ),
    ),
  })),
  withHooks({
    onInit(store) {
      // Keeps the Electron agent's local name -> port map current — it's
      // what handleRequest() in electron/agent.js uses to route an
      // incoming request to the right local server. Only active MCPs are
      // tunneled, matching McpLookupService on the backend.
      const agentBridge = inject(AgentBridgeService);
      effect(() => {
        const activeMcps = store.items().filter((mcp) => mcp.active);
        agentBridge.setMcps(
          activeMcps.map((mcp) => ({
            name: mcp.name,
            transport: mcp.transport,
            port: mcp.port,
            subPath: mcp.subPath,
            command: mcp.command,
            args: mcp.args,
            env: mcp.env as Record<string, string> | undefined,
          })),
        );
      });
    },
  }),
);
