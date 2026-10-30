import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { VentureCraftLogo } from "../../components/common/VentureCraftLogo";
import { api } from "../../services/api";
import type {
  Evaluation,
  EvaluationParameter,
  JudgeAssignedPanel,
  RoundIdentifier,
} from "../../types/api";

interface PanelParticipant {
  id: string;
  name: string;
  registrationId: string;
  isEligible: boolean;
  evaluationStatus: "none" | "draft" | "submitted";
}

interface PanelData {
  panel: { id: string; name: string; competitionId: string; competitionName: string };
  activeRound: RoundIdentifier | null;
  participants: PanelParticipant[];
}

function getCompetitionName(panel: JudgeAssignedPanel): string {
  const { competition } = panel;
  if (!competition || typeof competition === "string") {
    return "Assigned competition";
  }
  return competition.name || "Assigned competition";
}

function isEvaluationForParticipant(evaluation: Evaluation, participantId: string): boolean {
  if (!evaluation.participant) return false;
  return typeof evaluation.participant === "string"
    ? evaluation.participant === participantId
    : evaluation.participant._id === participantId;
}

export const JudgePortalPage: React.FC = () => {
  const { user } = useAuth();
  const [panels, setPanels] = useState<JudgeAssignedPanel[]>([]);
  const [selectedPanelId, setSelectedPanelId] = useState<string>("");
  const [panelData, setPanelData] = useState<PanelData | null>(null);
  const [parameters, setParameters] = useState<EvaluationParameter[]>([]);
  const [myEvaluations, setMyEvaluations] = useState<Evaluation[]>([]);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(true);
  const [panelsError, setPanelsError] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState<boolean>(false);
  const [submittingEval, setSubmittingEval] = useState<boolean>(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState<boolean>(false);

  // Form score state: parameterId -> awardedMarks
  const [scores, setScores] = useState<Record<string, number>>({});
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [searchFilter, setSearchFilter] = useState<string>("");

  // 1. Load judge's assigned panels
  useEffect(() => {
    loadPanels();
  }, []);

  const loadPanels = async () => {
    try {
      setLoading(true);
      setPanelsError(null);
      const res = await api.getJudgePanels();
      setPanels(res.panels || []);
      if (res.panels && res.panels.length > 0) {
        setSelectedPanelId(res.panels[0]._id);
      } else {
        setSelectedPanelId("");
      }
    } catch (err: any) {
      setPanels([]);
      setSelectedPanelId("");
      setPanelData(null);
      setParameters([]);
      setMyEvaluations([]);
      setPanelsError(err.message || "Failed to load your assigned judge panels.");
    } finally {
      setLoading(false);
    }
  };

  // 2. When selected panel changes, load participants & competition parameters & evaluations
  useEffect(() => {
    if (!selectedPanelId) return;
    loadPanelDetails(selectedPanelId);
  }, [selectedPanelId]);

  const loadPanelDetails = async (panelId: string) => {
    try {
      setLoading(true);
      setFeedbackMessage(null);
      const pData = await api.getJudgePanelParticipants(panelId);
      setPanelData(pData);

      const evalsRes = await api.getJudgeEvaluations();
      setMyEvaluations(evalsRes.evaluations || []);

      if (pData.panel.competitionId && pData.activeRound) {
        const paramsRes = await api.getParameters(pData.panel.competitionId, {
          round: pData.activeRound,
          isActive: true,
        });
        setParameters(paramsRes.parameters || []);
      } else {
        setParameters([]);
      }

      // Auto-select first participant if none selected or not in list
      if (pData.participants.length > 0) {
        setSelectedParticipantId(pData.participants[0].id);
      } else {
        setSelectedParticipantId("");
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: "error",
        text: err.message || "Failed to load panel participants or parameters.",
      });
    } finally {
      setLoading(false);
    }
  };

  // 3. When selected participant changes or evaluations update, populate scores
  useEffect(() => {
    if (!selectedParticipantId || !panelData || !panelData.activeRound) {
      setScores({});
      return;
    }

    const currentEval = myEvaluations.find(
      (e) =>
        isEvaluationForParticipant(e, selectedParticipantId) &&
        e.round === panelData.activeRound,
    );

    if (currentEval && currentEval.criteria && currentEval.criteria.length > 0) {
      const initialScores: Record<string, number> = {};
      currentEval.criteria.forEach((c) => {
        initialScores[c.parameter] = c.awardedMarks;
      });
      setScores(initialScores);
    } else {
      // Default to 0 for all active parameters
      const defaultScores: Record<string, number> = {};
      parameters.forEach((param) => {
        defaultScores[param._id] = 0;
      });
      setScores(defaultScores);
    }
    setFeedbackMessage(null);
  }, [selectedParticipantId, panelData, myEvaluations, parameters]);

  const selectedParticipant = panelData?.participants.find(
    (p) => p.id === selectedParticipantId,
  );

  const activeRound = panelData?.activeRound;

  // Check if evaluation for selected participant is already submitted
  const existingEvaluation = myEvaluations.find(
    (e) => isEvaluationForParticipant(e, selectedParticipantId) && e.round === activeRound,
  );

  const isSubmitted =
    existingEvaluation?.status === "submitted" ||
    selectedParticipant?.evaluationStatus === "submitted";

  const handleScoreChange = (paramId: string, val: number, max: number) => {
    if (isSubmitted) return;
    const clamped = Math.max(0, Math.min(val, max));
    setScores((prev) => ({
      ...prev,
      [paramId]: clamped,
    }));
  };

  // Calculations for current evaluation
  const totalAwarded = parameters.reduce((sum, param) => {
    return sum + (scores[param._id] ?? 0);
  }, 0);

  const totalMax = parameters.reduce((sum, param) => sum + param.maxMarks, 0);

  const percentage = totalMax > 0 ? ((totalAwarded / totalMax) * 100).toFixed(1) : "0.0";

  // Save Draft Action
  const handleSaveDraft = async () => {
    if (!panelData || !selectedParticipant || !activeRound) return;
    try {
      setSavingDraft(true);
      setFeedbackMessage(null);

      const scorePayload = parameters.map((param) => ({
        parameter: param._id,
        awardedMarks: scores[param._id] ?? 0,
      }));

      await api.saveEvaluationDraft({
        competition: panelData.panel.competitionId,
        participant: selectedParticipant.id,
        panel: selectedPanelId,
        round: activeRound,
        scores: scorePayload,
      });

      // Reload panel details to refresh statuses
      await loadPanelDetails(selectedPanelId);
      setFeedbackMessage({
        type: "success",
        text: `Draft evaluation saved successfully for ${selectedParticipant.name}.`,
      });
    } catch (err: any) {
      setFeedbackMessage({
        type: "error",
        text: err.message || "Failed to save draft evaluation.",
      });
    } finally {
      setSavingDraft(false);
    }
  };

  // Submit Final Evaluation Action
  const handleSubmitEvaluation = async () => {
    if (!panelData || !selectedParticipant || !activeRound) return;
    try {
      setSubmittingEval(true);
      setFeedbackMessage(null);

      const scorePayload = parameters.map((param) => ({
        parameter: param._id,
        awardedMarks: scores[param._id] ?? 0,
      }));

      await api.submitEvaluation({
        competition: panelData.panel.competitionId,
        participant: selectedParticipant.id,
        panel: selectedPanelId,
        round: activeRound,
        scores: scorePayload,
      });

      setShowSubmitConfirm(false);
      // Reload panel details to update submitted status
      await loadPanelDetails(selectedPanelId);
      setFeedbackMessage({
        type: "success",
        text: `Evaluation successfully submitted and finalized for ${selectedParticipant.name}.`,
      });
    } catch (err: any) {
      setFeedbackMessage({
        type: "error",
        text: err.message || "Failed to submit evaluation.",
      });
    } finally {
      setSubmittingEval(false);
    }
  };

  // Participant list filtered by search
  const filteredParticipants = (panelData?.participants || []).filter(
    (p) =>
      p.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      p.registrationId.toLowerCase().includes(searchFilter.toLowerCase()),
  );

  const completedCount = (panelData?.participants || []).filter(
    (p) => p.evaluationStatus === "submitted",
  ).length;

  const totalParticipantsCount = panelData?.participants.length || 0;
  const pendingCount = Math.max(totalParticipantsCount - completedCount, 0);

  return (
    <div
      className="judge-page responsive-page-container"
    >
      {/* Page Header */}
      <div
        className="judge-page-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "24px",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <VentureCraftLogo variant="emblem" height={44} />
          <div>
            <h1 style={{ fontSize: "28px", color: "var(--color-navy)", marginBottom: "4px" }}>
              Judge Evaluation Portal
            </h1>
            <p style={{ color: "var(--color-slate)", fontSize: "14px" }}>
              Select assigned panel and score participant criteria in real-time.
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexWrap: "wrap",
                marginTop: "8px",
                fontSize: "13px",
                color: "var(--color-slate)",
              }}
            >
              <span className="badge badge-draft">Judge</span>
              <strong style={{ color: "var(--color-navy)" }}>{user?.name}</strong>
              <span>{user?.email}</span>
            </div>
          </div>
        </div>

        {/* Panel Switcher */}
        {panels.length > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-navy)" }}>
              Assigned Panel:
            </span>
            <select
              value={selectedPanelId}
              onChange={(e) => setSelectedPanelId(e.target.value)}
              style={{ width: "220px", fontWeight: 600 }}
            >
              {panels.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Feedback Banner */}
      {feedbackMessage && (
        <div
          style={{
            padding: "12px 18px",
            borderRadius: "var(--radius-sm)",
            marginBottom: "20px",
            background:
              feedbackMessage.type === "success"
                ? "var(--color-success-bg)"
                : "var(--color-danger-bg)",
            color:
              feedbackMessage.type === "success"
                ? "var(--color-success)"
                : "var(--color-danger)",
            border: `1px solid ${
              feedbackMessage.type === "success"
                ? "rgba(47, 111, 78, 0.3)"
                : "rgba(142, 46, 46, 0.3)"
            }`,
            fontSize: "14px",
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>{feedbackMessage.text}</span>
          <button
            onClick={() => setFeedbackMessage(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "inherit",
              fontSize: "16px",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
      )}

      {panels.length > 0 && (
        <div className="judge-overview">
          <div className="card judge-stat-card">
            <div className="judge-stat-label">Assigned Panels</div>
            <div className="judge-stat-value">{panels.length}</div>
            <div className="judge-stat-detail">
              {panels.map((panel) => (
                <div key={panel._id}>
                  <strong>{panel.name}</strong>
                  <span>{getCompetitionName(panel)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card judge-stat-card">
            <div className="judge-stat-label">Selected Panel Participants</div>
            <div className="judge-stat-value">
              {panelData ? totalParticipantsCount : "-"}
            </div>
            <div className="judge-stat-detail">
              <span>{panelData?.panel.name || "Loading panel details..."}</span>
            </div>
          </div>

          <div className="card judge-stat-card">
            <div className="judge-stat-label">Completed Evaluations</div>
            <div className="judge-stat-value">{panelData ? completedCount : "-"}</div>
            <div className="judge-stat-detail">
              <span>Submitted for the selected panel</span>
            </div>
          </div>

          <div className="card judge-stat-card">
            <div className="judge-stat-label">Pending Evaluations</div>
            <div className="judge-stat-value">{panelData ? pendingCount : "-"}</div>
            <div className="judge-stat-detail">
              <span>Participants awaiting submission</span>
            </div>
          </div>
        </div>
      )}

      {loading && !panelData ? (
        <div className="card" style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontFamily: "var(--font-heading)", fontSize: "18px", color: "var(--color-navy)" }}>
            Loading Judge Panels and Criteria...
          </div>
        </div>
      ) : panelsError ? (
        <div className="card" style={{ textAlign: "center", padding: "60px 20px" }}>
          <h2 style={{ fontSize: "20px", color: "var(--color-danger)", marginBottom: "8px" }}>
            Unable to Load Judge Dashboard
          </h2>
          <p style={{ color: "var(--color-slate)", maxWidth: "560px", margin: "0 auto 20px" }}>
            {panelsError}
          </p>
          <button onClick={loadPanels} className="btn btn-gold">
            Retry
          </button>
        </div>
      ) : panels.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "60px 20px" }}>
          <h2 style={{ fontSize: "20px", color: "var(--color-navy)", marginBottom: "8px" }}>
            No Panels Assigned
          </h2>
          <p style={{ color: "var(--color-slate)", maxWidth: "500px", margin: "0 auto" }}>
            No evaluation panels have been assigned to your account yet.
          </p>
          <p style={{ color: "var(--color-slate)", maxWidth: "500px", margin: "8px auto 0", fontSize: "13px" }}>
            Please contact the competition administrator if you believe this is an error.
          </p>
        </div>
      ) : (
        <>
          {/* Panel & Active Round Status Bar */}
          <div
            className="card"
            style={{
              marginBottom: "24px",
              padding: "18px 24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "16px",
              background: "#FFFFFF",
              borderLeft: "4px solid var(--color-gold)",
            }}
          >
            <div>
              <div style={{ fontSize: "12px", color: "var(--color-slate)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Competition: {panelData?.panel.competitionName || "Active"}
              </div>
              <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--color-navy)", marginTop: "2px" }}>
                {panelData?.panel.name}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "11px", color: "var(--color-slate)", textTransform: "uppercase" }}>
                  Active Round
                </div>
                <div>
                  {activeRound ? (
                    <span className="badge badge-active" style={{ fontSize: "13px", padding: "4px 10px" }}>
                      Round {activeRound} In Progress
                    </span>
                  ) : (
                    <span className="badge badge-closed" style={{ fontSize: "13px", padding: "4px 10px" }}>
                      No Active Round
                    </span>
                  )}
                </div>
              </div>

              <div style={{ height: "36px", width: "1px", background: "var(--color-border)" }} />

              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "11px", color: "var(--color-slate)", textTransform: "uppercase" }}>
                  Panel Progress
                </div>
                <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--color-navy)" }}>
                  {completedCount} / {totalParticipantsCount} Submitted
                </div>
              </div>
            </div>
          </div>

          {/* Main 2-Column Evaluation Workspace */}
          <div className="judge-workspace">
            {/* Left Column: Participant Roster */}
            <div className="card" style={{ padding: "16px" }}>
              <div style={{ marginBottom: "12px" }}>
                <h3 style={{ fontSize: "16px", color: "var(--color-navy)", marginBottom: "8px" }}>
                  Participants ({filteredParticipants.length})
                </h3>
                <input
                  type="text"
                  placeholder="Search participant or ID..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  style={{ fontSize: "13px", padding: "7px 10px" }}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  maxHeight: "680px",
                  overflowY: "auto",
                }}
              >
                {filteredParticipants.length === 0 ? (
                  <div style={{ padding: "24px 12px", textAlign: "center", color: "var(--color-slate)", fontSize: "13px" }}>
                    No participants found.
                  </div>
                ) : (
                  filteredParticipants.map((part) => {
                    const isSelected = part.id === selectedParticipantId;
                    return (
                      <div
                        key={part.id}
                        onClick={() => setSelectedParticipantId(part.id)}
                        style={{
                          padding: "12px 14px",
                          borderRadius: "var(--radius-sm)",
                          cursor: "pointer",
                          border: isSelected
                            ? "1px solid var(--color-gold)"
                            : "1px solid var(--color-border-subtle)",
                          background: isSelected
                            ? "rgba(181, 154, 101, 0.08)"
                            : "#FFFFFF",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-navy)" }}>
                              {part.name}
                            </div>
                            <div style={{ fontSize: "12px", color: "var(--color-slate)", fontFamily: "monospace" }}>
                              {part.registrationId}
                            </div>
                          </div>

                          <div>
                            {part.evaluationStatus === "submitted" ? (
                              <span className="badge badge-submitted" style={{ fontSize: "10px" }}>
                                Final
                              </span>
                            ) : part.evaluationStatus === "draft" ? (
                              <span className="badge badge-draft" style={{ fontSize: "10px" }}>
                                Draft
                              </span>
                            ) : (
                              <span
                                style={{
                                  fontSize: "10px",
                                  padding: "2px 6px",
                                  borderRadius: "3px",
                                  background: "var(--color-ivory-surface)",
                                  color: "var(--color-slate)",
                                  border: "1px solid var(--color-border)",
                                }}
                              >
                                Pending
                              </span>
                            )}
                          </div>
                        </div>

                        {!part.isEligible && (
                          <div
                            style={{
                              marginTop: "6px",
                              fontSize: "11px",
                              color: "var(--color-danger)",
                              fontWeight: 600,
                            }}
                          >
                            ⚠ Ineligible for Round {activeRound || 1}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Column: Active Participant Evaluation Sheet */}
            <div className="card" style={{ padding: "28px" }}>
              {!selectedParticipant ? (
                <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--color-slate)" }}>
                  Select a participant from the panel list to view and score criteria.
                </div>
              ) : !activeRound ? (
                <div style={{ textAlign: "center", padding: "60px 20px" }}>
                  <h3 style={{ fontSize: "18px", color: "var(--color-danger)", marginBottom: "8px" }}>
                    Round Inactive
                  </h3>
                  <p style={{ color: "var(--color-slate)", maxWidth: "450px", margin: "0 auto" }}>
                    No round is currently active for this competition. Scoring is only permitted during an active round.
                  </p>
                </div>
              ) : !selectedParticipant.isEligible ? (
                <div style={{ textAlign: "center", padding: "60px 20px" }}>
                  <h3 style={{ fontSize: "18px", color: "var(--color-danger)", marginBottom: "8px" }}>
                    Participant Ineligible for Round {activeRound}
                  </h3>
                  <p style={{ color: "var(--color-slate)", maxWidth: "450px", margin: "0 auto" }}>
                    This participant has not qualified or has been marked ineligible for Round {activeRound}. Scores cannot be submitted.
                  </p>
                </div>
              ) : (
                <div>
                  {/* Evaluation Header */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      paddingBottom: "18px",
                      borderBottom: "1px solid var(--color-border)",
                      marginBottom: "24px",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <h2 style={{ fontSize: "22px", color: "var(--color-navy)" }}>
                          {selectedParticipant.name}
                        </h2>
                        {isSubmitted ? (
                          <span className="badge badge-submitted">
                            🔒 Locked & Submitted
                          </span>
                        ) : selectedParticipant.evaluationStatus === "draft" ? (
                          <span className="badge badge-draft">Draft in Progress</span>
                        ) : (
                          <span className="badge badge-pending">Ready for Scoring</span>
                        )}
                      </div>
                      <div style={{ fontSize: "13px", color: "var(--color-slate)", marginTop: "4px" }}>
                        Registration ID: <strong>{selectedParticipant.registrationId}</strong> | Round {activeRound}
                      </div>
                    </div>

                    {/* Live Score Summary */}
                    <div
                      style={{
                        textAlign: "right",
                        background: "var(--color-ivory-surface)",
                        padding: "10px 18px",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      <div style={{ fontSize: "11px", color: "var(--color-slate)", textTransform: "uppercase" }}>
                        Total Marks Awarded
                      </div>
                      <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--color-navy)" }}>
                        {totalAwarded} <span style={{ fontSize: "14px", color: "var(--color-slate)", fontWeight: 400 }}>/ {totalMax}</span>
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--color-gold)", fontWeight: 600 }}>
                        {percentage}% Normalized
                      </div>
                    </div>
                  </div>

                  {isSubmitted && existingEvaluation?.submittedAt && (
                    <div
                      style={{
                        padding: "12px 16px",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--color-success-bg)",
                        color: "var(--color-success)",
                        border: "1px solid rgba(47, 111, 78, 0.2)",
                        fontSize: "13px",
                        marginBottom: "24px",
                      }}
                    >
                      ✓ This evaluation was finalized on{" "}
                      <strong>{new Date(existingEvaluation.submittedAt).toLocaleString()}</strong>. In accordance with competition rules, submitted evaluations are immutable.
                    </div>
                  )}

                  {/* Criteria List */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    {parameters.length === 0 ? (
                      <div style={{ padding: "30px", textAlign: "center", color: "var(--color-slate)" }}>
                        No evaluation parameters configured for Round {activeRound}.
                      </div>
                    ) : (
                      parameters.map((param, index) => {
                        const currentMark = scores[param._id] ?? 0;
                        return (
                          <div
                            key={param._id}
                            style={{
                              padding: "18px 20px",
                              borderRadius: "var(--radius-sm)",
                              border: "1px solid var(--color-border)",
                              background: "#FFFFFF",
                              boxShadow: "var(--shadow-sm)",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "flex-start",
                                marginBottom: "8px",
                              }}
                            >
                              <div style={{ flex: 1, paddingRight: "20px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                  <span
                                    style={{
                                      fontFamily: "var(--font-heading)",
                                      fontSize: "15px",
                                      color: "var(--color-gold)",
                                    }}
                                  >
                                    #{index + 1}
                                  </span>
                                  <h4 style={{ fontSize: "16px", color: "var(--color-navy)", margin: 0 }}>
                                    {param.name}
                                  </h4>
                                </div>
                                {param.description && (
                                  <p style={{ fontSize: "13px", color: "var(--color-slate)", marginTop: "4px" }}>
                                    {param.description}
                                  </p>
                                )}
                                {param.guidelines && (
                                  <div
                                    style={{
                                      marginTop: "6px",
                                      padding: "6px 10px",
                                      background: "var(--color-ivory-surface)",
                                      borderLeft: "3px solid var(--color-gold)",
                                      fontSize: "12px",
                                      color: "var(--color-charcoal)",
                                    }}
                                  >
                                    <strong>Scoring Guide:</strong> {param.guidelines}
                                  </div>
                                )}
                              </div>

                              {/* Marks Input & Max */}
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <div style={{ textAlign: "right" }}>
                                  <div style={{ fontSize: "11px", color: "var(--color-slate)" }}>
                                    Max: {param.maxMarks}
                                  </div>
                                  <div style={{ fontSize: "10px", color: "var(--color-gold)" }}>
                                    Wt: {param.weightage}
                                  </div>
                                </div>

                                <input
                                  type="number"
                                  min={0}
                                  max={param.maxMarks}
                                  step={0.5}
                                  disabled={isSubmitted}
                                  value={currentMark}
                                  onChange={(e) =>
                                    handleScoreChange(
                                      param._id,
                                      parseFloat(e.target.value) || 0,
                                      param.maxMarks,
                                    )
                                  }
                                  style={{
                                    width: "80px",
                                    textAlign: "center",
                                    fontSize: "16px",
                                    fontWeight: 700,
                                    padding: "8px",
                                    color: isSubmitted
                                      ? "var(--color-slate)"
                                      : "var(--color-navy)",
                                    background: isSubmitted ? "#F4EFE4" : "#FFFFFF",
                                  }}
                                />
                              </div>
                            </div>

                            {/* Mark Slider for intuitive touch & adjustment */}
                            {!isSubmitted && (
                              <div style={{ marginTop: "12px" }}>
                                <input
                                  type="range"
                                  min={0}
                                  max={param.maxMarks}
                                  step={0.5}
                                  value={currentMark}
                                  onChange={(e) =>
                                    handleScoreChange(
                                      param._id,
                                      parseFloat(e.target.value) || 0,
                                      param.maxMarks,
                                    )
                                  }
                                  style={{
                                    width: "100%",
                                    accentColor: "var(--color-gold)",
                                    cursor: "pointer",
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Action Footer */}
                  {!isSubmitted && (
                    <div
                      style={{
                        marginTop: "32px",
                        paddingTop: "20px",
                        borderTop: "1px solid var(--color-border)",
                        display: "flex",
                        justifyContent: "flex-end",
                        alignItems: "center",
                        gap: "14px",
                      }}
                    >
                      <button
                        onClick={handleSaveDraft}
                        disabled={savingDraft || submittingEval}
                        className="btn btn-secondary"
                        style={{ padding: "10px 22px" }}
                      >
                        {savingDraft ? "Saving Draft..." : "Save Draft"}
                      </button>

                      <button
                        onClick={() => setShowSubmitConfirm(true)}
                        disabled={savingDraft || submittingEval || parameters.length === 0}
                        className="btn btn-gold"
                        style={{ padding: "10px 24px" }}
                      >
                        Finalize & Submit Evaluation
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Confirmation Modal for Final Submission */}
      {showSubmitConfirm && selectedParticipant && activeRound && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: "500px" }}>
            <h3 style={{ fontSize: "20px", color: "var(--color-navy)", marginBottom: "12px" }}>
              Finalize Evaluation Submission
            </h3>

            <p style={{ fontSize: "14px", color: "var(--color-charcoal)", lineHeight: 1.6, marginBottom: "16px" }}>
              You are about to submit the final evaluation for:
            </p>

            <div
              style={{
                background: "var(--color-ivory-surface)",
                padding: "14px 18px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--color-border)",
                marginBottom: "20px",
              }}
            >
              <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--color-navy)" }}>
                {selectedParticipant.name}
              </div>
              <div style={{ fontSize: "13px", color: "var(--color-slate)", marginTop: "2px" }}>
                ID: {selectedParticipant.registrationId} | Round {activeRound}
              </div>
              <div style={{ marginTop: "10px", fontSize: "14px", color: "var(--color-gold)", fontWeight: 600 }}>
                Awarded: {totalAwarded} / {totalMax} ({percentage}%)
              </div>
            </div>

            <div
              style={{
                padding: "12px",
                background: "var(--color-warning-bg)",
                color: "var(--color-warning)",
                border: "1px solid rgba(148, 105, 27, 0.3)",
                borderRadius: "var(--radius-sm)",
                fontSize: "13px",
                marginBottom: "24px",
              }}
            >
              ⚠ <strong>Permanent Action:</strong> Once finalized, your evaluation is sealed in the blockchain/database and cannot be altered or deleted.
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button
                className="btn btn-secondary"
                disabled={submittingEval}
                onClick={() => setShowSubmitConfirm(false)}
              >
                Go Back & Review
              </button>
              <button
                className="btn btn-gold"
                disabled={submittingEval}
                onClick={handleSubmitEvaluation}
              >
                {submittingEval ? "Submitting..." : "Yes, Finalize & Lock"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
