import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { catchError, of, pipe, switchMap, tap } from 'rxjs';
import { McpLogsService, McpLogWithContextDto } from '@mcp-loop/ui-client';
import { extractErrorMessage } from '../http-error.util';
import { ToastService } from '../toast/toast.service';

const DEFAULT_PAGE_SIZE = 25;
const POLL_INTERVAL_MS = 3000;
const TOOL_CALLS_ONLY_STORAGE_KEY = 'mcp-loop.desktop.logs.toolCallsOnly';
const TODAY_ONLY_STORAGE_KEY = 'mcp-loop.desktop.logs.todayOnly';

function readStoredBool(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

function persistBool(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* localStorage unavailable — the preference just won't survive a reload */
  }
}

interface LogsState {
  items: McpLogWithContextDto[];
  total: number;
  page: number;
  pageSize: number;
  /** Scopes list + bulk-delete-all to one MCP; null means "every MCP the user owns". */
  mcpId: string | null;
  /** When true, only JSON-RPC "tools/call" entries are returned — persisted across restarts. */
  toolCallsOnly: boolean;
  /** When true, only today's (server-local calendar day) entries are returned — persisted across restarts. */
  todayOnly: boolean;
  status: 'idle' | 'loading' | 'error';
  error: string | null;
  selectedIds: string[];
}

const initialState: LogsState = {
  items: [],
  total: 0,
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  mcpId: null,
  toolCallsOnly: readStoredBool(TOOL_CALLS_ONLY_STORAGE_KEY),
  todayOnly: readStoredBool(TODAY_ONLY_STORAGE_KEY),
  status: 'idle',
  error: null,
  selectedIds: [],
};

/**
 * Backs the "Logs" route. Polls continuously while the route is active —
 * there's no WebSocket push channel for logs — but the poll is scheduled
 * *relative to the last fetch*, not on a fixed wall-clock interval. A fixed
 * `interval()` used to race pagination: clicking "Next" fired a request that
 * the next unrelated poll tick would immediately cancel via `switchMap`
 * (both went through the same `fetchPage`), so the click visibly did
 * nothing. Rescheduling the next poll only after each fetch settles means a
 * manual action (page change, filter change, delete) always wins and simply
 * pushes the next poll back by a full interval.
 */
export const LogsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ total, pageSize }) => ({
    pageCount: computed(() => Math.max(1, Math.ceil(total() / pageSize()))),
  })),
  withMethods((store, mcpLogsService = inject(McpLogsService), toast = inject(ToastService)) => {
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let pollingEnabled = false;

    function clearPollTimer(): void {
      if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = null;
      }
    }

    function schedulePoll(): void {
      clearPollTimer();
      if (!pollingEnabled) return;
      pollTimer = setTimeout(() => fetchPage(), POLL_INTERVAL_MS);
    }

    const fetchPage = rxMethod<void>(
      pipe(
        switchMap(() => {
          // Any pending poll is superseded by this fetch — whether this
          // call *is* the poll tick or a manual action pre-empting it.
          clearPollTimer();

          const { mcpId, page, pageSize, toolCallsOnly, todayOnly } = store;
          const request$ = mcpId()
            ? mcpLogsService.listMcpLogs(mcpId() as string, page(), pageSize(), toolCallsOnly(), todayOnly())
            : mcpLogsService.listAllMcpLogs(page(), pageSize(), toolCallsOnly(), todayOnly());
          return request$.pipe(
            tap((result) => {
              patchState(store, { items: result.items, total: result.total, status: 'idle', error: null });

              // A delete can empty the page the user was on (e.g. the last page) —
              // snap back to the new last page instead of showing "Page 4 of 3".
              const newPageCount = Math.max(1, Math.ceil(result.total / store.pageSize()));
              if (store.page() > newPageCount) {
                patchState(store, { page: newPageCount });
                fetchPage();
                return;
              }
              schedulePoll();
            }),
            catchError((error: unknown) => {
              patchState(store, { status: 'error', error: extractErrorMessage(error) });
              schedulePoll();
              return of(null);
            }),
          );
        }),
      ),
    );

    return {
      /** Re-fetches the current page/filter immediately — used by the initial load and after mutations. */
      refresh: fetchPage,

      /**
       * Enables polling and arms the next tick (idempotent) — call once when
       * the Logs route mounts. Doesn't fetch immediately itself; the
       * route's initial `setFilter()` call already does that, and this just
       * guarantees a poll gets scheduled regardless of whether that initial
       * fetch has run yet.
       */
      startPolling(): void {
        pollingEnabled = true;
        schedulePoll();
      },

      /** Stops polling — call when the Logs route unmounts, since this store outlives the route. */
      stopPolling(): void {
        pollingEnabled = false;
        clearPollTimer();
      },

      /** Sets which MCP to scope the list to (or null for "all") and jumps back to page 1. */
      setFilter(mcpId: string | null, forceFetch: boolean): void {
        if(store.mcpId() === mcpId && !forceFetch)
          return;
        patchState(store, { mcpId, page: 1, selectedIds: [] });
        fetchPage();
      },

      /** Toggles the "tool calls only" filter, persists it, and re-fetches from page 1. Combinable with `todayOnly`. */
      setToolCallsOnly(toolCallsOnly: boolean): void {
        if (store.toolCallsOnly() === toolCallsOnly) return;
        persistBool(TOOL_CALLS_ONLY_STORAGE_KEY, toolCallsOnly);
        patchState(store, { toolCallsOnly, page: 1, selectedIds: [] });
        fetchPage();
      },

      /** Toggles the "today only" filter, persists it, and re-fetches from page 1. Combinable with `toolCallsOnly`. */
      setTodayOnly(todayOnly: boolean): void {
        if (store.todayOnly() === todayOnly) return;
        persistBool(TODAY_ONLY_STORAGE_KEY, todayOnly);
        patchState(store, { todayOnly, page: 1, selectedIds: [] });
        fetchPage();
      },

      goToPage(page: number): void {
        if (page < 1) return;
        patchState(store, { page, selectedIds: [] });
        fetchPage();
      },

      toggleSelected(id: string): void {
        const selected = store.selectedIds();
        patchState(store, {
          selectedIds: selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id],
        });
      },

      toggleSelectAllOnPage(): void {
        const idsOnPage = store.items().map((item) => item.id);
        const allSelected = idsOnPage.every((id) => store.selectedIds().includes(id));
        patchState(store, { selectedIds: allSelected ? [] : idsOnPage });
      },

      deleteOne: rxMethod<string>(
        pipe(
          switchMap((id) =>
            mcpLogsService.deleteMcpLog(id).pipe(
              tap(() => {
                patchState(store, { selectedIds: store.selectedIds().filter((x) => x !== id) });
                fetchPage();
                toast.success('Log entry deleted');
              }),
              catchError((error: unknown) => {
                patchState(store, { status: 'error', error: extractErrorMessage(error) });
                return of(null);
              }),
            ),
          ),
        ),
      ),

      /** Deletes every currently-selected row. */
      deleteSelected: rxMethod<void>(
        pipe(
          switchMap(() => {
            const ids = store.selectedIds();
            if (!ids.length) return of(null);
            return mcpLogsService.deleteMcpLogs({ ids }).pipe(
              tap(() => {
                patchState(store, { selectedIds: [] });
                fetchPage();
                toast.success(`${ids.length} log ${ids.length === 1 ? 'entry' : 'entries'} deleted`);
              }),
              catchError((error: unknown) => {
                patchState(store, { status: 'error', error: extractErrorMessage(error) });
                return of(null);
              }),
            );
          }),
        ),
      ),

      /** Deletes every log matching the current filter (one MCP, or all of them if unfiltered). */
      deleteAllInScope: rxMethod<void>(
        pipe(
          switchMap(() => {
            const mcpId = store.mcpId();
            return mcpLogsService.deleteMcpLogs(mcpId ? { mcpId } : {}).pipe(
              tap(() => {
                patchState(store, { page: 1, selectedIds: [] });
                fetchPage();
                toast.success('All matching logs deleted');
              }),
              catchError((error: unknown) => {
                patchState(store, { status: 'error', error: extractErrorMessage(error) });
                return of(null);
              }),
            );
          }),
        ),
      ),
    };
  }),
);
