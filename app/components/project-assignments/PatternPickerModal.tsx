import { useEffect, useState } from "react";
import { projectsSuggestAssignmentsCreate } from "~/lib/api/generated/projects/projects";
import type {
  ProjectAssignmentPattern,
  ProjectMonthlyAssignmentRequest,
} from "~/lib/api/generated/models";
import { PatternCard } from "./PatternCard";
import { flattenPatternToAssignmentRequests } from "./utils";

type PatternPickerModalProps = {
  open: boolean;
  projectId: string;
  onClose: () => void;
  onAcceptPattern: (requests: ProjectMonthlyAssignmentRequest[]) => Promise<boolean>;
};

export function PatternPickerModal(props: PatternPickerModalProps) {
  const { open, projectId, onClose, onAcceptPattern } = props;
  const { isLoading, error, patterns } = useProjectAssignmentPatterns(open, projectId);
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState("");

  useEffect(() => {
    if (open) setAcceptError("");
  }, [open]);

  if (!open) return null;

  const handleAccept = async (pattern: ProjectAssignmentPattern) => {
    if (pattern.members.length === 0) return;
    if (
      !window.confirm(
        `${pattern.label} を採用しますか? ${pattern.members.length} 人 × 各月の割当が未確定として登録されます。`,
      )
    ) {
      return;
    }
    setIsAccepting(true);
    setAcceptError("");
    try {
      const requests = flattenPatternToAssignmentRequests(pattern, projectId);
      const ok = await onAcceptPattern(requests);
      if (ok) onClose();
    } catch {
      setAcceptError("パターンの登録に失敗しました");
    } finally {
      setIsAccepting(false);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      <Header />
      <Body
        isLoading={isLoading}
        error={error || acceptError}
        patterns={patterns}
        isAccepting={isAccepting}
        onAccept={handleAccept}
      />
      <Footer onClose={onClose} isAccepting={isAccepting} />
    </ModalShell>
  );
}

async function fetchProjectAssignmentPatterns(
  projectId: string,
): Promise<{ patterns: ProjectAssignmentPattern[]; error: string }> {
  try {
    const response = await projectsSuggestAssignmentsCreate(projectId, {});
    if (response.status !== 200) {
      return { patterns: [], error: "候補パターンの取得に失敗しました" };
    }
    return { patterns: response.data.patterns ?? [], error: "" };
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 400) {
      return {
        patterns: [],
        error: "プロジェクトの開始日が設定されていないため、候補パターンを生成できません。",
      };
    }
    return { patterns: [], error: "候補パターンの取得に失敗しました" };
  }
}

function useProjectAssignmentPatterns(open: boolean, projectId: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [patterns, setPatterns] = useState<ProjectAssignmentPattern[]>([]);

  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    setError("");
    setPatterns([]);
    let cancelled = false;
    fetchProjectAssignmentPatterns(projectId).then((result) => {
      if (cancelled) return;
      setPatterns(result.patterns);
      setError(result.error);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  return { isLoading, error, patterns };
}

function ModalShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <button
        type="button"
        aria-label="閉じる"
        onClick={onClose}
        className="fixed inset-0 bg-black bg-opacity-25 cursor-default"
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-5xl w-full p-6 max-h-[90vh] flex flex-col">
          {children}
        </div>
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="mb-4">
      <h3 className="text-lg font-medium text-gray-900">候補パターン</h3>
      <p className="text-xs text-gray-500 mt-1">
        プロジェクトの完了予測日に近い順に表示されます。採用すると、未確定の割当として登録されます。
      </p>
    </div>
  );
}

function Body({
  isLoading,
  error,
  patterns,
  isAccepting,
  onAccept,
}: {
  isLoading: boolean;
  error: string;
  patterns: ProjectAssignmentPattern[];
  isAccepting: boolean;
  onAccept: (pattern: ProjectAssignmentPattern) => void;
}) {
  if (error) {
    return <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 mb-4">{error}</div>;
  }
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40 text-gray-500">パターンを生成中...</div>
    );
  }
  if (patterns.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-8 text-center">
        条件に合うパターンを生成できませんでした。プロジェクトの開始日・目標終了日・配分可能なメンバーをご確認ください。
      </div>
    );
  }
  return (
    <div className="flex gap-4 overflow-x-auto flex-1 pb-2">
      {patterns.map((pattern) => (
        <PatternCard
          key={pattern.pattern_ids.join("-")}
          pattern={pattern}
          isAccepting={isAccepting}
          onAccept={onAccept}
        />
      ))}
    </div>
  );
}

function Footer({ onClose, isAccepting }: { onClose: () => void; isAccepting: boolean }) {
  return (
    <div className="mt-4 flex justify-end">
      <button
        type="button"
        onClick={onClose}
        disabled={isAccepting}
        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
      >
        閉じる
      </button>
    </div>
  );
}
