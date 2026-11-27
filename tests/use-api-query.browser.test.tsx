import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { PageError, PageLoading } from "../app/components/page-state";
import { useApiQuery } from "../app/hooks/useApiQuery";

type Deferred = {
  promise: Promise<string>;
  resolve: (v: string) => void;
  reject: (e: Error) => void;
};

function deferred(): Deferred {
  let resolve!: (v: string) => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<string>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

type Snapshot = { data: string | null; hasError: boolean; isLoading: boolean };

let reloadQuery: () => void = () => {};
// Every render's state, so a test can assert that an intermediate state was never shown.
let renders: Snapshot[] = [];

function Harness({
  id,
  enabled,
  keepPreviousData,
  fetcher,
}: {
  id: string;
  enabled?: boolean;
  keepPreviousData?: boolean;
  fetcher: (id: string) => Promise<string>;
}) {
  const { data, error, isLoading, reload } = useApiQuery(() => fetcher(id), [id], {
    enabled,
    keepPreviousData,
  });
  reloadQuery = reload;
  const snapshot: Snapshot = { data: data ?? null, hasError: error !== null, isLoading };
  renders.push(snapshot);
  return <div data-testid="state">{JSON.stringify(snapshot)}</div>;
}

const readState = (container: HTMLElement): Snapshot =>
  JSON.parse(container.querySelector('[data-testid="state"]')?.textContent ?? "{}");

async function waitForState(container: HTMLElement, predicate: (s: Snapshot) => boolean) {
  const start = Date.now();
  while (Date.now() - start < 3000) {
    if (predicate(readState(container))) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(`state predicate not met; last = ${JSON.stringify(readState(container))}`);
}

const tick = () => new Promise((r) => setTimeout(r, 20));

describe("useApiQuery", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    renders = [];
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    root.unmount();
    container.remove();
    vi.restoreAllMocks();
  });

  test("is loading from the first render, then exposes the resolved data", async () => {
    const d = deferred();
    root.render(<Harness id="a" fetcher={() => d.promise} />);
    await waitForState(container, (s) => s.isLoading);
    expect(renders[0]).toEqual({ data: null, hasError: false, isLoading: true });

    d.resolve("A");
    await waitForState(container, (s) => s.isLoading === false);
    expect(readState(container)).toEqual({ data: "A", hasError: false, isLoading: false });
  });

  test("exposes a rejection as error with no data", async () => {
    const d = deferred();
    root.render(<Harness id="a" fetcher={() => d.promise} />);
    await waitForState(container, (s) => s.isLoading);
    d.reject(new Error("boom"));
    await waitForState(container, (s) => s.isLoading === false);
    expect(readState(container)).toEqual({ data: null, hasError: true, isLoading: false });
  });

  test("does not fetch while disabled, and loads once enabled", async () => {
    const fetcher = vi.fn(() => Promise.resolve("A"));
    root.render(<Harness id="a" enabled={false} fetcher={fetcher} />);
    await tick();
    expect(fetcher).not.toHaveBeenCalled();
    expect(readState(container)).toEqual({ data: null, hasError: false, isLoading: false });

    renders = [];
    root.render(<Harness id="a" enabled fetcher={fetcher} />);
    await waitForState(container, (s) => s.data === "A");
    expect(fetcher).toHaveBeenCalledTimes(1);
    // No render after enabling shows a settled-but-empty state before the request resolves.
    expect(renders.every((s) => s.isLoading || s.data === "A")).toBe(true);
  });

  test("drops the result when disabled again", async () => {
    const fetcher = vi.fn(() => Promise.resolve("A"));
    root.render(<Harness id="a" enabled fetcher={fetcher} />);
    await waitForState(container, (s) => s.data === "A");

    root.render(<Harness id="a" enabled={false} fetcher={fetcher} />);
    await waitForState(container, (s) => s.data === null);
    expect(readState(container)).toEqual({ data: null, hasError: false, isLoading: false });
  });

  test("a slow response for superseded deps never overwrites the current one", async () => {
    const slow = deferred();
    const fast = deferred();
    const fetcher = (id: string) => (id === "a" ? slow.promise : fast.promise);
    root.render(<Harness id="a" fetcher={fetcher} />);
    await waitForState(container, (s) => s.isLoading);

    root.render(<Harness id="b" fetcher={fetcher} />);
    fast.resolve("B");
    await waitForState(container, (s) => s.data === "B");

    slow.resolve("A");
    await tick();
    expect(readState(container).data).toBe("B");
  });

  test("new deps show loading, never the previous deps' data", async () => {
    const next = deferred();
    const fetcher = (id: string) => (id === "a" ? Promise.resolve("A") : next.promise);
    root.render(<Harness id="a" fetcher={fetcher} />);
    await waitForState(container, (s) => s.data === "A");

    renders = [];
    root.render(<Harness id="b" fetcher={fetcher} />);
    await waitForState(container, (s) => s.isLoading);
    expect(renders.some((s) => s.data === "A")).toBe(false);

    next.resolve("B");
    await waitForState(container, (s) => s.data === "B");
  });

  test("reload refetches with the same deps", async () => {
    let call = 0;
    const fetcher = vi.fn(() => Promise.resolve(`v${++call}`));
    root.render(<Harness id="a" fetcher={fetcher} />);
    await waitForState(container, (s) => s.data === "v1");

    reloadQuery();
    await waitForState(container, (s) => s.data === "v2");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  test("keepPreviousData exposes the last result while a reload is in flight", async () => {
    const second = deferred();
    let call = 0;
    const fetcher = () => (++call === 1 ? Promise.resolve("v1") : second.promise);
    root.render(<Harness id="a" keepPreviousData fetcher={fetcher} />);
    await waitForState(container, (s) => s.data === "v1");

    reloadQuery();
    await waitForState(container, (s) => s.isLoading);
    expect(readState(container)).toEqual({ data: "v1", hasError: false, isLoading: true });

    second.resolve("v2");
    await waitForState(container, (s) => s.data === "v2" && s.isLoading === false);
  });

  test("a synchronous throw in the fetcher becomes an error", async () => {
    root.render(
      <Harness
        id="a"
        fetcher={() => {
          throw new Error("sync");
        }}
      />,
    );
    await waitForState(container, (s) => s.hasError);
    expect(readState(container).isLoading).toBe(false);
  });
});

describe("page-state components", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  test("PageLoading and PageError render the shared markup", async () => {
    root.render(
      <>
        <PageLoading />
        <PageError message="失敗しました" />
      </>,
    );
    await tick();
    expect(container.querySelector(".h-64 .text-gray-500")?.textContent).toBe("読み込み中...");
    expect(container.querySelector(".bg-red-50 .text-red-800")?.textContent).toBe("失敗しました");
  });
});
