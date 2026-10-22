import React, { useMemo, useState } from "react";
import type { User } from "../../types/api";

interface JudgeAssignmentSelectProps {
  judges: User[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  disabled?: boolean;
}

export const JudgeAssignmentSelect: React.FC<JudgeAssignmentSelectProps> = ({
  judges,
  selectedIds,
  onChange,
  loading,
  error,
  onRetry,
  disabled = false,
}) => {
  const [search, setSearch] = useState("");

  const judgesById = useMemo(
    () => new Map(judges.map((judge) => [judge.id, judge])),
    [judges],
  );

  const filteredJudges = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return judges;
    return judges.filter(
      (judge) =>
        judge.name.toLowerCase().includes(query) ||
        judge.email.toLowerCase().includes(query),
    );
  }, [judges, search]);

  const toggleJudge = (judgeId: string) => {
    if (selectedIds.includes(judgeId)) {
      onChange(selectedIds.filter((id) => id !== judgeId));
      return;
    }
    onChange([...selectedIds, judgeId]);
  };

  return (
    <div className="judge-assignment-field">
      <label className="judge-assignment-label">Assigned Judges</label>
      <p className="judge-assignment-help">
        Select one or more active judge accounts. Search by name or email.
      </p>

      {selectedIds.length > 0 ? (
        <div className="judge-selection-chips" aria-label="Selected judges">
          {selectedIds.map((judgeId) => {
            const judge = judgesById.get(judgeId);
            return (
              <span key={judgeId} className="judge-selection-chip">
                <span>
                  <strong>{judge?.name ?? "Unavailable judge"}</strong>
                  {judge?.email ? ` (${judge.email})` : ""}
                </span>
                <button
                  type="button"
                  className="judge-selection-remove"
                  onClick={() => toggleJudge(judgeId)}
                  aria-label={`Remove ${judge?.name ?? "unavailable judge"}`}
                  disabled={disabled}
                >
                  &times;
                </button>
              </span>
            );
          })}
        </div>
      ) : (
        <div className="judge-selection-empty">No judges selected yet.</div>
      )}

      {loading ? (
        <div className="judge-picker-state" role="status">
          <span className="loading-spinner judge-picker-spinner" />
          Loading judge directory...
        </div>
      ) : error ? (
        <div className="judge-picker-state judge-picker-error" role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
            Retry
          </button>
        </div>
      ) : judges.length === 0 ? (
        <div className="judge-picker-state">
          No judge accounts exist yet. Provision a judge account first, then return to this panel.
        </div>
      ) : (
        <>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search judges by name or email..."
            aria-label="Search judges"
            disabled={disabled}
          />

          {filteredJudges.length === 0 ? (
            <div className="judge-picker-state">
              No judges match &quot;{search.trim()}&quot;. Try a different name or email.
            </div>
          ) : (
            <div className="judge-picker-options">
              {filteredJudges.map((judge) => {
                const selected = selectedIds.includes(judge.id);
                const unavailable = !judge.isActive && !selected;

                return (
                  <label
                    key={judge.id}
                    className={`judge-picker-option${unavailable ? " is-unavailable" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={disabled || unavailable}
                      onChange={() => toggleJudge(judge.id)}
                    />
                    <span className="judge-picker-option-copy">
                      <strong>{judge.name}</strong>
                      <span>{judge.email}</span>
                    </span>
                    {!judge.isActive ? (
                      <span className="badge badge-inactive">Inactive</span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          )}

          <div className="judge-assignment-footnote">
            Inactive judges cannot be newly assigned. If a selected judge is deactivated,
            remove them before saving.
          </div>
        </>
      )}
    </div>
  );
};
