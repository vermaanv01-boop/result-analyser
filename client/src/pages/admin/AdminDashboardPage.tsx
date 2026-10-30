import React, { useEffect, useState } from "react";
import { JudgeAssignmentSelect } from "../../components/forms/JudgeAssignmentSelect";
import { VentureCraftLogo } from "../../components/common/VentureCraftLogo";
import { api } from "../../services/api";
import type {
  Competition,
  EvaluationParameter,
  Panel,
  Participant,
  ParticipantEvaluationDetails,
  ProgressReport,
  RoundIdentifier,
  RoundStatus,
  User,
} from "../../types/api";

type AdminTab =
  | "competitions"
  | "panels"
  | "participants"
  | "parameters"
  | "qualification"
  | "progress";

const evaluationRoundStatusLabels: Record<
  ParticipantEvaluationDetails["rounds"][number]["status"],
  string
> = {
  unevaluated: "Unevaluated",
  draft_only: "Draft only",
  in_progress: "In progress",
  complete: "Complete",
};

function formatScore(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function formatMarkPair(awardedMarks: number | null, maxMarks: number): string {
  if (awardedMarks === null) {
    return `Not evaluated / ${formatScore(maxMarks)}`;
  }
  return `${formatScore(awardedMarks)} / ${formatScore(maxMarks)}`;
}

export const AdminDashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>("competitions");
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>("");
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);

  const [panels, setPanels] = useState<Panel[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [parameters, setParameters] = useState<EvaluationParameter[]>([]);
  const [judges, setJudges] = useState<User[]>([]);
  const [judgesLoading, setJudgesLoading] = useState<boolean>(true);
  const [judgesError, setJudgesError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modals state
  const [showCreateComp, setShowCreateComp] = useState(false);
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [showCreateJudge, setShowCreateJudge] = useState(false);
  const [showCreateParticipant, setShowCreateParticipant] = useState(false);
  const [showCreateParam, setShowCreateParam] = useState(false);
  const [showQualifyModal, setShowQualifyModal] = useState(false);

  // Modal in-flight and error states
  const [submittingJudge, setSubmittingJudge] = useState<boolean>(false);
  const [judgeModalError, setJudgeModalError] = useState<string | null>(null);
  const [submittingPanel, setSubmittingPanel] = useState<boolean>(false);
  const [panelModalError, setPanelModalError] = useState<string | null>(null);
  const [submittingParticipant, setSubmittingParticipant] = useState<boolean>(false);
  const [participantModalError, setParticipantModalError] = useState<string | null>(null);
  const [updatingParticipantId, setUpdatingParticipantId] = useState<string | null>(null);
  const [marksParticipant, setMarksParticipant] = useState<Participant | null>(null);
  const [evaluationDetails, setEvaluationDetails] =
    useState<ParticipantEvaluationDetails | null>(null);
  const [evaluationDetailsLoading, setEvaluationDetailsLoading] = useState<boolean>(false);
  const [evaluationDetailsError, setEvaluationDetailsError] = useState<string | null>(null);

  // Form states
  const [newCompName, setNewCompName] = useState("");
  const [newCompDesc, setNewCompDesc] = useState("");

  const [editingPanel, setEditingPanel] = useState<Panel | null>(null);
  const [newPanelName, setNewPanelName] = useState("");
  const [newPanelDesc, setNewPanelDesc] = useState("");
  const [newPanelJudges, setNewPanelJudges] = useState<string[]>([]);
  const [newPanelIsActive, setNewPanelIsActive] = useState<boolean>(true);

  const [newJudgeName, setNewJudgeName] = useState("");
  const [newJudgeEmail, setNewJudgeEmail] = useState("");
  const [newJudgePassword, setNewJudgePassword] = useState("");

  const [newPartName, setNewPartName] = useState("");
  const [newPartRegId, setNewPartRegId] = useState("");
  const [newPartEmail, setNewPartEmail] = useState("");
  const [newPartPanel, setNewPartPanel] = useState("");

  const [newParamName, setNewParamName] = useState("");
  const [newParamDesc, setNewParamDesc] = useState("");
  const [newParamMax, setNewParamMax] = useState<number>(50);
  const [newParamWeight, setNewParamWeight] = useState<number>(1);
  const [newParamRounds, setNewParamRounds] = useState<RoundIdentifier[]>([1, 2]);
  const [newParamPriority, setNewParamPriority] = useState<string>("");

  const [qualifyMethod, setQualifyMethod] = useState<"topN" | "cutoffScore">("topN");
  const [qualifyTopN, setQualifyTopN] = useState<number>(5);
  const [qualifyCutoff, setQualifyCutoff] = useState<number>(60);

  // Load competitions on mount
  const loadCompetitions = async () => {
    try {
      const res = await api.getCompetitions();
      setCompetitions(res.competitions);
      if (res.competitions.length > 0 && !selectedCompetitionId) {
        const first = res.competitions[0]!;
        setSelectedCompetitionId(first._id);
        setSelectedCompetition(first);
      }
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const loadJudges = async () => {
    setJudgesLoading(true);
    setJudgesError(null);
    try {
      const res = await api.getJudges();
      setJudges(res.judges);
    } catch (err: any) {
      setJudgesError(
        err.message || "Could not load the judge directory. Please try again.",
      );
    } finally {
      setJudgesLoading(false);
    }
  };

  const openCreatePanelModal = () => {
    setEditingPanel(null);
    setNewPanelName("");
    setNewPanelDesc("");
    setNewPanelJudges([]);
    setNewPanelIsActive(true);
    setPanelModalError(null);
    setShowCreatePanel(true);
    void loadJudges();
  };

  const openEditPanelModal = (panel: Panel) => {
    setEditingPanel(panel);
    setNewPanelName(panel.name);
    setNewPanelDesc(panel.description ?? "");
    setNewPanelJudges(panel.judges.map((judge) => judge._id));
    setNewPanelIsActive(panel.isActive);
    setPanelModalError(null);
    setShowCreatePanel(true);
    void loadJudges();
  };

  const closePanelModal = () => {
    if (submittingPanel) return;
    setShowCreatePanel(false);
    setEditingPanel(null);
    setPanelModalError(null);
  };

  useEffect(() => {
    loadCompetitions();
    loadJudges();
  }, []);

  // When competition changes, reload child entities
  useEffect(() => {
    if (!selectedCompetitionId) return;
    const comp = competitions.find((c) => c._id === selectedCompetitionId) || null;
    setSelectedCompetition(comp);
    loadCompetitionData(selectedCompetitionId);
  }, [selectedCompetitionId, competitions]);

  const loadCompetitionData = async (compId: string) => {
    setLoading(true);
    setActionError(null);
    try {
      const [panelsRes, partsRes, paramsRes, progRes] = await Promise.all([
        api.getPanels(compId),
        api.getParticipants(compId),
        api.getParameters(compId),
        api.getProgressReport(compId).catch(() => ({ progress: null })),
      ]);
      setPanels(panelsRes.panels);
      setParticipants(partsRes.participants);
      setParameters(paramsRes.parameters);
      setProgress(progRes.progress);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const notifySuccess = (msg: string) => {
    setActionSuccess(msg);
    setActionError(null);
    setTimeout(() => setActionSuccess(null), 4000);
  };

  // Lifecycle handlers
  const handleRoundStatusChange = async (roundNum: RoundIdentifier, newStatus: RoundStatus) => {
    if (!selectedCompetitionId) return;
    try {
      const res = await api.updateRoundStatus(selectedCompetitionId, roundNum, newStatus);
      if (selectedCompetition) {
        setSelectedCompetition({ ...selectedCompetition, rounds: res.rounds });
      }
      notifySuccess(`Round ${roundNum} status updated to '${newStatus}'`);
      loadCompetitions();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  // Creation Handlers
  const handleCreateCompetition = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.createCompetition({ name: newCompName, description: newCompDesc });
      notifySuccess(`Competition '${res.competition.name}' created successfully`);
      setNewCompName("");
      setNewCompDesc("");
      setShowCreateComp(false);
      await loadCompetitions();
      setSelectedCompetitionId(res.competition._id);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleCreateJudge = async (e: React.FormEvent) => {
    e.preventDefault();
    setJudgeModalError(null);

    const trimmedName = newJudgeName.trim();
    const trimmedEmail = newJudgeEmail.trim().toLowerCase();

    if (!trimmedName) {
      setJudgeModalError("Judge full name is required.");
      return;
    }
    if (!trimmedEmail || !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setJudgeModalError("A valid email address is required.");
      return;
    }
    if (newJudgePassword.length < 6) {
      setJudgeModalError("Password must be at least 6 characters.");
      return;
    }

    setSubmittingJudge(true);
    try {
      await api.provisionUser({
        name: trimmedName,
        email: trimmedEmail,
        password: newJudgePassword,
        role: "judge",
      });
      notifySuccess(`Judge account for '${trimmedName}' provisioned successfully.`);
      setNewJudgeName("");
      setNewJudgeEmail("");
      setNewJudgePassword("");
      setShowCreateJudge(false);
      await loadJudges();
    } catch (err: any) {
      setJudgeModalError(err.message || "Failed to provision judge account.");
    } finally {
      setSubmittingJudge(false);
    }
  };

  const handleSavePanel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompetitionId) return;

    const trimmedName = newPanelName.trim();
    const trimmedDescription = newPanelDesc.trim();

    if (!trimmedName) {
      setPanelModalError("Panel name is required.");
      return;
    }
    if (newPanelJudges.length === 0) {
      setPanelModalError("Select at least one active judge for this panel.");
      return;
    }

    setSubmittingPanel(true);
    setPanelModalError(null);
    try {
      const payload = {
        name: trimmedName,
        description: trimmedDescription || undefined,
        judges: newPanelJudges,
        isActive: newPanelIsActive,
      };

      if (editingPanel) {
        await api.updatePanel(selectedCompetitionId, editingPanel._id, payload);
        notifySuccess(`Panel '${trimmedName}' updated successfully.`);
      } else {
        await api.createPanel(selectedCompetitionId, payload);
        notifySuccess(`Panel '${trimmedName}' created successfully.`);
      }

      setNewPanelName("");
      setNewPanelDesc("");
      setNewPanelJudges([]);
      setNewPanelIsActive(true);
      setShowCreatePanel(false);
      setEditingPanel(null);
      await loadCompetitionData(selectedCompetitionId);
    } catch (err: any) {
      setPanelModalError(err.message || "Failed to save panel.");
    } finally {
      setSubmittingPanel(false);
    }
  };

  const handleCreateParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    setParticipantModalError(null);

    if (!selectedCompetitionId) {
      setParticipantModalError("No active competition selected. Please create or select a competition first.");
      return;
    }

    const trimmedName = newPartName.trim();
    const trimmedRegId = newPartRegId.trim().toUpperCase();
    const trimmedEmail = newPartEmail.trim().toLowerCase();

    if (!trimmedName) {
      setParticipantModalError("Participant or team name is required.");
      return;
    }
    if (trimmedEmail && !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setParticipantModalError("Please enter a valid email address.");
      return;
    }

    setSubmittingParticipant(true);
    try {
      await api.createParticipant(selectedCompetitionId, {
        name: trimmedName,
        registrationId: trimmedRegId || undefined,
        email: trimmedEmail || undefined,
        panel: newPartPanel || undefined,
      });
      notifySuccess(
        trimmedRegId
          ? `Participant '${trimmedName}' (${trimmedRegId}) registered successfully.`
          : `Participant '${trimmedName}' registered successfully.`,
      );
      setNewPartName("");
      setNewPartRegId("");
      setNewPartEmail("");
      setNewPartPanel("");
      setShowCreateParticipant(false);
      await loadCompetitionData(selectedCompetitionId);
    } catch (err: any) {
      setParticipantModalError(err.message || "Failed to register participant.");
    } finally {
      setSubmittingParticipant(false);
    }
  };

  const handleCreateParameter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompetitionId) return;
    try {
      const priorityVal = newParamPriority.trim() === "" ? undefined : Number(newParamPriority.trim());
      await api.createParameter(selectedCompetitionId, {
        name: newParamName,
        description: newParamDesc,
        maxMarks: Number(newParamMax),
        weightage: Number(newParamWeight),
        applicableRounds: newParamRounds,
        priority: priorityVal === undefined || Number.isNaN(priorityVal) ? null : priorityVal,
      });
      notifySuccess(`Evaluation criterion '${newParamName}' created`);
      setNewParamName("");
      setNewParamDesc("");
      setNewParamMax(50);
      setNewParamWeight(1);
      setNewParamRounds([1, 2]);
      setNewParamPriority("");
      setShowCreateParam(false);
      loadCompetitionData(selectedCompetitionId);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleQualifyRound2 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompetitionId) return;
    try {
      const res = await api.qualifyRound2(selectedCompetitionId, {
        method: qualifyMethod,
        topN: qualifyMethod === "topN" ? qualifyTopN : undefined,
        cutoffScore: qualifyMethod === "cutoffScore" ? qualifyCutoff : undefined,
      });
      notifySuccess(
        `Round 2 qualification complete: ${res.qualifiedCount} of ${res.totalProcessed} participants advanced.`,
      );
      setShowQualifyModal(false);
      loadCompetitionData(selectedCompetitionId);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleToggleEligibility = async (
    participantId: string,
    round: RoundIdentifier,
    currentEligible: boolean,
  ) => {
    if (!selectedCompetitionId) return;
    try {
      await api.updateEligibility(selectedCompetitionId, participantId, {
        round,
        eligible: !currentEligible,
        ineligibleReason: currentEligible ? "Disqualified by Admin" : undefined,
      });
      notifySuccess(`Participant round ${round} eligibility updated`);
      loadCompetitionData(selectedCompetitionId);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleAssignParticipantPanel = async (
    participantId: string,
    participantName: string,
    panelId: string,
  ) => {
    if (!selectedCompetitionId) return;
    setUpdatingParticipantId(participantId);
    setActionError(null);
    try {
      await api.updateParticipant(selectedCompetitionId, participantId, {
        panel: panelId || null,
      });
      const selectedPanel = panels.find((panel) => panel._id === panelId);
      notifySuccess(
        selectedPanel
          ? `${participantName} assigned to '${selectedPanel.name}'.`
          : `${participantName} moved to unassigned.`,
      );
      await loadCompetitionData(selectedCompetitionId);
    } catch (err: any) {
      setActionError(err.message || "Failed to update the participant's panel.");
    } finally {
      setUpdatingParticipantId(null);
    }
  };

  const openEvaluationDetails = async (participant: Participant) => {
    setMarksParticipant(participant);
    setEvaluationDetails(null);
    setEvaluationDetailsError(null);
    setEvaluationDetailsLoading(true);
    try {
      const response = await api.getParticipantEvaluationDetails(participant._id);
      setEvaluationDetails(response.details);
    } catch (err: any) {
      setEvaluationDetailsError(
        err.message || "Failed to load parameter-wise marks for this participant.",
      );
    } finally {
      setEvaluationDetailsLoading(false);
    }
  };

  const closeEvaluationDetails = () => {
    setMarksParticipant(null);
    setEvaluationDetails(null);
    setEvaluationDetailsError(null);
    setEvaluationDetailsLoading(false);
  };

  return (
    <div style={{ display: "flex", minHeight: "calc(100vh - 68px)" }}>
      {/* Sidebar Navigation */}
      <aside
        style={{
          width: "260px",
          background: "var(--color-navy)",
          color: "#FFFFFF",
          borderRight: "1px solid rgba(228, 218, 201, 0.15)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            padding: "24px 20px",
            borderBottom: "1px solid rgba(228, 218, 201, 0.15)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "20px",
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: "#FFFFFF",
              lineHeight: 1.1,
            }}
          >
            Venture Craft
          </div>
          <div
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "11px",
              letterSpacing: "0.15em",
              color: "var(--color-gold-muted)",
              marginTop: "4px",
              textTransform: "uppercase",
            }}
          >
            Present &bull; Connect &bull; Lead
          </div>
          <div
            style={{
              fontSize: "11px",
              color: "var(--color-gold)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginTop: "12px",
              fontWeight: 600,
            }}
          >
            Administration Console
          </div>
        </div>

        <nav style={{ padding: "16px 12px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {[
            { id: "competitions", label: "Competitions & Rounds" },
            { id: "panels", label: "Panels & Judges" },
            { id: "participants", label: "Participants" },
            { id: "parameters", label: "Evaluation Criteria" },
            { id: "qualification", label: "Round 2 Qualification" },
            { id: "progress", label: "Live Progress Monitor" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AdminTab)}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "10px 14px",
                borderRadius: "4px",
                fontSize: "13px",
                fontWeight: 600,
                textAlign: "left",
                color: activeTab === tab.id ? "var(--color-gold)" : "#D3DAE2",
                background:
                  activeTab === tab.id ? "rgba(181, 154, 101, 0.18)" : "transparent",
                border: "none",
                width: "100%",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: "32px 40px", overflowY: "auto" }}>
        {/* Top Competition Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "28px",
            background: "#FFFFFF",
            padding: "16px 20px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <label style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-navy)" }}>
              Active Competition:
            </label>
            <select
              value={selectedCompetitionId}
              onChange={(e) => setSelectedCompetitionId(e.target.value)}
              style={{ width: "320px", fontWeight: 600 }}
            >
              {competitions.map((comp) => (
                <option key={comp._id} value={comp._id}>
                  {comp.name} ({comp.status.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setJudgeModalError(null);
                setShowCreateJudge(true);
              }}
            >
              + Add Judge
            </button>
            <button
              className="btn btn-gold"
              onClick={() => setShowCreateComp(true)}
            >
              + New Competition
            </button>
          </div>
        </div>

        {/* Feedback alerts */}
        {actionError && (
          <div
            style={{
              padding: "12px 16px",
              background: "var(--color-danger-bg)",
              color: "var(--color-danger)",
              border: "1px solid rgba(142, 46, 46, 0.2)",
              borderRadius: "4px",
              marginBottom: "20px",
              fontSize: "14px",
            }}
          >
            {actionError}
          </div>
        )}
        {actionSuccess && (
          <div
            style={{
              padding: "12px 16px",
              background: "var(--color-success-bg)",
              color: "var(--color-success)",
              border: "1px solid rgba(47, 111, 78, 0.2)",
              borderRadius: "4px",
              marginBottom: "20px",
              fontSize: "14px",
            }}
          >
            {actionSuccess}
          </div>
        )}

        {/* TAB 1: COMPETITIONS & ROUND LIFECYCLES */}
        {activeTab === "competitions" && (
          <div>
            <div style={{ marginBottom: "24px" }}>
              <h2 style={{ fontSize: "22px", marginBottom: "6px" }}>
                Competition & Round Lifecycles
              </h2>
              <p style={{ color: "var(--color-slate)", fontSize: "14px" }}>
                Manage rounds sequentially. Round 2 requires Round 1 closure before starting.
              </p>
            </div>

            {selectedCompetition ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                {selectedCompetition.rounds.map((rnd) => (
                  <div key={rnd.round} className="card">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "16px",
                      }}
                    >
                      <h3 style={{ fontSize: "18px" }}>Round {rnd.round}</h3>
                      <span className={`badge badge-${rnd.status}`}>{rnd.status}</span>
                    </div>

                    <div style={{ fontSize: "13px", color: "var(--color-slate)", marginBottom: "20px" }}>
                      <div>Started: {rnd.startedAt ? new Date(rnd.startedAt).toLocaleString() : "Not started"}</div>
                      <div>Closed: {rnd.closedAt ? new Date(rnd.closedAt).toLocaleString() : "Open / Pending"}</div>
                    </div>

                    <div style={{ display: "flex", gap: "10px" }}>
                      {rnd.status === "pending" && (
                        <button
                          className="btn btn-primary"
                          onClick={() => handleRoundStatusChange(rnd.round, "active")}
                        >
                          Start Round {rnd.round}
                        </button>
                      )}
                      {rnd.status === "active" && (
                        <button
                          className="btn btn-danger"
                          onClick={() => handleRoundStatusChange(rnd.round, "closed")}
                        >
                          Close Round {rnd.round}
                        </button>
                      )}
                      {rnd.status === "closed" && (
                        <span style={{ fontSize: "13px", color: "var(--color-slate)", fontStyle: "italic" }}>
                          Round concluded
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card">No competition selected. Create one above to begin.</div>
            )}
          </div>
        )}

        {/* TAB 2: PANELS & JUDGES */}
        {activeTab === "panels" && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <div>
                <h2 style={{ fontSize: "22px", marginBottom: "4px" }}>Evaluation Panels</h2>
                <p style={{ color: "var(--color-slate)", fontSize: "14px" }}>
                  Judges only evaluate participants assigned to their panels.
                </p>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setJudgeModalError(null);
                    setShowCreateJudge(true);
                  }}
                >
                  + Add Judge
                </button>
                <button className="btn btn-gold" onClick={openCreatePanelModal}>
                  + Create Panel
                </button>
              </div>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Panel Name</th>
                    <th>Description</th>
                    <th>Assigned Judges</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {panels.length > 0 ? (
                    panels.map((p) => (
                      <tr key={p._id}>
                        <td style={{ fontWeight: 600 }}>{p.name}</td>
                        <td>{p.description || "—"}</td>
                        <td>
                          {p.judges.map((j) => (
                            <span
                              key={j._id}
                              style={{
                                display: "inline-block",
                                background: "var(--color-ivory-surface)",
                                border: "1px solid var(--color-border)",
                                padding: "2px 8px",
                                borderRadius: "4px",
                                marginRight: "6px",
                                fontSize: "12px",
                              }}
                            >
                              {j.name} ({j.email})
                            </span>
                          ))}
                        </td>
                        <td>
                          <span className={`badge badge-${p.isActive ? "active" : "inactive"}`}>
                            {p.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => openEditPanelModal(p)}
                          >
                            Edit Panel
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "24px" }}>
                        No panels created for this competition yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Judges Directory */}
            <div style={{ marginTop: "40px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                }}
              >
                <div>
                  <h3 style={{ fontSize: "18px", marginBottom: "4px" }}>Judges Directory</h3>
                  <p style={{ color: "var(--color-slate)", fontSize: "13px" }}>
                    Provisioned judge accounts available for evaluation panel assignment.
                  </p>
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setJudgeModalError(null);
                    setShowCreateJudge(true);
                  }}
                >
                  + Add Judge
                </button>
              </div>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Judge Name</th>
                      <th>Email</th>
                      <th>Assigned Panels</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {judges.length > 0 ? (
                      judges.map((j) => {
                        const jId = j.id || (j as any)._id;
                        const assignedPanels = panels.filter((p) =>
                          p.judges.some((pj) => pj._id === jId),
                        );
                        return (
                          <tr key={jId}>
                            <td style={{ fontWeight: 600 }}>{j.name}</td>
                            <td>{j.email}</td>
                            <td>
                              {assignedPanels.length > 0 ? (
                                assignedPanels.map((p) => (
                                  <span
                                    key={p._id}
                                    style={{
                                      display: "inline-block",
                                      background: "var(--color-ivory-surface)",
                                      border: "1px solid var(--color-border)",
                                      padding: "2px 8px",
                                      borderRadius: "4px",
                                      marginRight: "6px",
                                      fontSize: "12px",
                                    }}
                                  >
                                    {p.name}
                                  </span>
                                ))
                              ) : (
                                <span style={{ color: "var(--color-slate)", fontStyle: "italic", fontSize: "12px" }}>
                                  Unassigned
                                </span>
                              )}
                            </td>
                            <td>
                              <span className={`badge badge-${j.isActive ? "active" : "inactive"}`}>
                                {j.isActive ? "Active" : "Inactive"}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} style={{ textAlign: "center", padding: "24px" }}>
                          No judges provisioned yet. Click "+ Add Judge" to provision a judge account.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PARTICIPANTS */}
        {activeTab === "participants" && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <div>
                <h2 style={{ fontSize: "22px", marginBottom: "4px" }}>Participants</h2>
                <p style={{ color: "var(--color-slate)", fontSize: "14px" }}>
                  Registered students, assigned panels, and round eligibility.
                </p>
              </div>
              <button
                className="btn btn-gold"
                onClick={() => {
                  if (!selectedCompetitionId) {
                    setActionError("Please select or create an active competition first.");
                    return;
                  }
                  setParticipantModalError(null);
                  setShowCreateParticipant(true);
                }}
              >
                + Register Participant
              </button>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Reg ID</th>
                    <th>Full Name</th>
                    <th>Assigned Panel</th>
                    <th>Round 1</th>
                    <th>Round 2</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.length > 0 ? (
                    participants.map((part) => {
                      const r1 = part.eligibility.find((e) => e.round === 1);
                      const r2 = part.eligibility.find((e) => e.round === 2);
                      const currentPanelId =
                        typeof part.panel === "object" && part.panel
                          ? part.panel._id
                          : part.panel ?? "";

                      return (
                        <tr key={part._id}>
                          <td style={{ fontFamily: "monospace", fontWeight: 700 }}>
                            {part.registrationId}
                          </td>
                          <td style={{ fontWeight: 600 }}>{part.name}</td>
                          <td>
                            <select
                              value={currentPanelId}
                              onChange={(event) =>
                                handleAssignParticipantPanel(
                                  part._id,
                                  part.name,
                                  event.target.value,
                                )
                              }
                              disabled={updatingParticipantId === part._id}
                              aria-label={`Panel for ${part.name}`}
                              style={{ minWidth: "170px" }}
                            >
                              <option value="">Unassigned</option>
                              {panels.map((panel) => (
                                <option
                                  key={panel._id}
                                  value={panel._id}
                                  disabled={!panel.isActive && panel._id !== currentPanelId}
                                >
                                  {panel.name}
                                  {panel.isActive ? "" : " (Inactive)"}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <button
                              onClick={() =>
                                handleToggleEligibility(part._id, 1, r1?.eligible ?? false)
                              }
                              className={`badge badge-${r1?.eligible ? "eligible" : "ineligible"}`}
                              style={{ border: "none", cursor: "pointer" }}
                            >
                              {r1?.eligible ? "Eligible" : "Ineligible"}
                            </button>
                          </td>
                          <td>
                            <button
                              onClick={() =>
                                handleToggleEligibility(part._id, 2, r2?.eligible ?? false)
                              }
                              className={`badge badge-${r2?.eligible ? "eligible" : "ineligible"}`}
                              style={{ border: "none", cursor: "pointer" }}
                            >
                              {r2?.eligible ? "Eligible" : "Ineligible"}
                            </button>
                          </td>
                          <td>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                flexWrap: "wrap",
                              }}
                            >
                              <span
                                style={{ fontSize: "12px", color: "var(--color-slate)" }}
                              >
                                {part.isActive ? "Active" : "Deactivated"}
                              </span>
                              <button
                                className="btn btn-secondary"
                                style={{ padding: "6px 10px", fontSize: "12px" }}
                                onClick={() => openEvaluationDetails(part)}
                              >
                                View Marks
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "24px" }}>
                        No participants registered yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: EVALUATION PARAMETERS */}
        {activeTab === "parameters" && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <div>
                <h2 style={{ fontSize: "22px", marginBottom: "4px" }}>Dynamic Criteria</h2>
                <p style={{ color: "var(--color-slate)", fontSize: "14px" }}>
                  Criteria version {selectedCompetition?.parameterConfigVersion || 1}. Updating criteria
                  safely bumps the version and protects historical scores.
                </p>
              </div>
              <button
                className="btn btn-gold"
                onClick={() => setShowCreateParam(true)}
              >
                + Add Criterion
              </button>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Criterion Name</th>
                    <th>Priority</th>
                    <th>Max Marks</th>
                    <th>Weightage</th>
                    <th>Applicable Rounds</th>
                    <th>Version</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parameters.length > 0 ? (
                    [...parameters]
                      .sort((a, b) => {
                        const pa = a.priority ?? 999999;
                        const pb = b.priority ?? 999999;
                        if (pa !== pb) return pa - pb;
                        return a.name.localeCompare(b.name);
                      })
                      .map((param) => (
                        <tr key={param._id}>
                          <td style={{ fontWeight: 600 }}>{param.name}</td>
                          <td>{param.priority === null || param.priority === undefined ? "-" : param.priority}</td>
                          <td style={{ fontWeight: 700 }}>{param.maxMarks} pts</td>
                          <td>{param.weightage}x</td>
                          <td>
                            {param.applicableRounds.map((r) => (
                              <span
                                key={r}
                                className="badge badge-active"
                                style={{ marginRight: "4px", fontSize: "11px" }}
                              >
                                R{r}
                              </span>
                            ))}
                          </td>
                          <td>v{param.configVersion}</td>
                          <td>
                            <span className={`badge badge-${param.isActive ? "active" : "inactive"}`}>
                              {param.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "24px" }}>
                        No evaluation criteria defined yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: ROUND 2 QUALIFICATION */}
        {activeTab === "qualification" && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <div>
                <h2 style={{ fontSize: "22px", marginBottom: "4px" }}>
                  Round 2 Qualification Engine
                </h2>
                <p style={{ color: "var(--color-slate)", fontSize: "14px" }}>
                  Advance participants into Round 2 based on finalized Round 1 scores.
                </p>
              </div>
              <button
                className="btn btn-gold"
                onClick={() => setShowQualifyModal(true)}
              >
                Run Qualification Engine
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "24px" }}>
              <div className="card">
                <h3 style={{ fontSize: "16px", marginBottom: "8px" }}>Round 1 Status</h3>
                <div style={{ fontSize: "14px", color: "var(--color-slate)" }}>
                  Round 1 must be closed before Round 2 can begin.
                </div>
                <div style={{ marginTop: "16px" }}>
                  <span
                    className={`badge badge-${
                      selectedCompetition?.rounds.find((r) => r.round === 1)?.status || "pending"
                    }`}
                  >
                    Round 1: {selectedCompetition?.rounds.find((r) => r.round === 1)?.status}
                  </span>
                </div>
              </div>

              <div className="card">
                <h3 style={{ fontSize: "16px", marginBottom: "8px" }}>Qualified for Round 2</h3>
                <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--color-navy)" }}>
                  {participants.filter((p) => p.eligibility.find((e) => e.round === 2)?.eligible).length}{" "}
                  / {participants.length}
                </div>
                <div style={{ fontSize: "13px", color: "var(--color-slate)", marginTop: "4px" }}>
                  participants currently qualified for Round 2
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: PROGRESS MONITOR */}
        {activeTab === "progress" && (
          <div>
            <div style={{ marginBottom: "20px" }}>
              <h2 style={{ fontSize: "22px", marginBottom: "4px" }}>Evaluation Progress</h2>
              <p style={{ color: "var(--color-slate)", fontSize: "14px" }}>
                Panel and judge evaluation submission metrics across rounds.
              </p>
            </div>

            {progress ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px" }}>
                {progress.panelProgress.map((pan) => (
                  <div key={pan.panelId} className="card">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "12px",
                      }}
                    >
                      <h3 style={{ fontSize: "16px" }}>{pan.panelName}</h3>
                      <div style={{ fontSize: "13px", color: "var(--color-slate)" }}>
                        Judges: {pan.judgeCount} | Participants: {pan.participantCount}
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                      <div
                        style={{
                          background: "var(--color-ivory-surface)",
                          padding: "12px",
                          borderRadius: "4px",
                        }}
                      >
                        <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-navy)" }}>
                          ROUND 1 EVALUATIONS
                        </div>
                        <div style={{ fontSize: "20px", fontWeight: 700, marginTop: "4px" }}>
                          {pan.round1.submitted} / {pan.round1.expected}
                        </div>
                        <div style={{ fontSize: "12px", color: pan.round1.isComplete ? "var(--color-success)" : "var(--color-warning)" }}>
                          {pan.round1.isComplete ? "✓ Complete" : "Pending submissions"}
                        </div>
                      </div>

                      <div
                        style={{
                          background: "var(--color-ivory-surface)",
                          padding: "12px",
                          borderRadius: "4px",
                        }}
                      >
                        <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-navy)" }}>
                          ROUND 2 EVALUATIONS
                        </div>
                        <div style={{ fontSize: "20px", fontWeight: 700, marginTop: "4px" }}>
                          {pan.round2.submitted} / {pan.round2.expected}
                        </div>
                        <div style={{ fontSize: "12px", color: pan.round2.isComplete ? "var(--color-success)" : "var(--color-warning)" }}>
                          {pan.round2.isComplete ? "✓ Complete" : "Pending submissions"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card">Progress data loading or no active competition.</div>
            )}
          </div>
        )}
      </main>

      {/* MODAL: CREATE COMPETITION */}
      {showCreateComp && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h3 style={{ marginBottom: "16px" }}>Create New Competition</h3>
            <form onSubmit={handleCreateCompetition}>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                  Competition Name
                </label>
                <input
                  type="text"
                  value={newCompName}
                  onChange={(e) => setNewCompName(e.target.value)}
                  placeholder="e.g. Venture Craft 2026 Tech Summit"
                  required
                />
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                  Description
                </label>
                <textarea
                  value={newCompDesc}
                  onChange={(e) => setNewCompDesc(e.target.value)}
                  rows={3}
                  placeholder="Brief competition description..."
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateComp(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-gold">
                  Create Competition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PROVISION JUDGE */}
      {showCreateJudge && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h3 style={{ marginBottom: "16px" }}>Provision Judge Account</h3>
            
            {judgeModalError && (
              <div
                style={{
                  padding: "10px 14px",
                  background: "var(--color-danger-bg)",
                  color: "var(--color-danger)",
                  border: "1px solid rgba(142, 46, 46, 0.2)",
                  borderRadius: "4px",
                  marginBottom: "16px",
                  fontSize: "13px",
                }}
              >
                {judgeModalError}
              </div>
            )}

            <form onSubmit={handleCreateJudge}>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                  Judge Full Name
                </label>
                <input
                  type="text"
                  value={newJudgeName}
                  onChange={(e) => setNewJudgeName(e.target.value)}
                  placeholder="Dr. Eleanor Vance"
                  required
                  disabled={submittingJudge}
                />
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={newJudgeEmail}
                  onChange={(e) => setNewJudgeEmail(e.target.value)}
                  placeholder="judge@institution.edu"
                  required
                  disabled={submittingJudge}
                />
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                  Initial Password
                </label>
                <input
                  type="password"
                  value={newJudgePassword}
                  onChange={(e) => setNewJudgePassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  required
                  disabled={submittingJudge}
                />
                <div style={{ fontSize: "11px", color: "var(--color-slate)", marginTop: "4px" }}>
                  Password must be at least 6 characters.
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setJudgeModalError(null);
                    setShowCreateJudge(false);
                  }}
                  disabled={submittingJudge}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-gold" disabled={submittingJudge}>
                  {submittingJudge ? "Provisioning..." : "Provision Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE OR EDIT PANEL */}
      {showCreatePanel && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h3 style={{ marginBottom: "16px" }}>
              {editingPanel ? "Edit Evaluation Panel" : "Create Evaluation Panel"}
            </h3>

            {panelModalError && (
              <div
                role="alert"
                style={{
                  padding: "10px 14px",
                  background: "var(--color-danger-bg)",
                  color: "var(--color-danger)",
                  border: "1px solid rgba(142, 46, 46, 0.2)",
                  borderRadius: "4px",
                  marginBottom: "16px",
                  fontSize: "13px",
                }}
              >
                {panelModalError}
              </div>
            )}

            <form onSubmit={handleSavePanel}>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                  Panel Name
                </label>
                <input
                  type="text"
                  value={newPanelName}
                  onChange={(e) => setNewPanelName(e.target.value)}
                  placeholder="e.g. Artificial Intelligence Panel"
                  required
                  disabled={submittingPanel}
                />
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                  Description
                </label>
                <input
                  type="text"
                  value={newPanelDesc}
                  onChange={(e) => setNewPanelDesc(e.target.value)}
                  placeholder="Focus areas..."
                  disabled={submittingPanel}
                />
              </div>

              <JudgeAssignmentSelect
                judges={judges}
                selectedIds={newPanelJudges}
                onChange={setNewPanelJudges}
                loading={judgesLoading}
                error={judgesError}
                onRetry={() => void loadJudges()}
                disabled={submittingPanel}
              />

              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  marginTop: "14px",
                  fontSize: "13px",
                  cursor: submittingPanel ? "default" : "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={newPanelIsActive}
                  onChange={(e) => setNewPanelIsActive(e.target.checked)}
                  disabled={submittingPanel}
                  style={{ width: "auto", marginTop: "2px" }}
                />
                <span>
                  Panel is active
                  <span
                    style={{
                      display: "block",
                      fontSize: "11px",
                      color: "var(--color-slate)",
                      marginTop: "2px",
                    }}
                  >
                    Inactive panels remain visible but cannot receive new participant assignments.
                  </span>
                </span>
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closePanelModal}
                  disabled={submittingPanel}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-gold" disabled={submittingPanel}>
                  {submittingPanel
                    ? "Saving..."
                    : editingPanel
                      ? "Save Panel Changes"
                      : "Create Panel"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTER PARTICIPANT */}
      {showCreateParticipant && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h3 style={{ marginBottom: "16px" }}>
              Register Participant {selectedCompetition ? `— ${selectedCompetition.name}` : ""}
            </h3>

            {participantModalError && (
              <div
                style={{
                  padding: "10px 14px",
                  background: "var(--color-danger-bg)",
                  color: "var(--color-danger)",
                  border: "1px solid rgba(142, 46, 46, 0.2)",
                  borderRadius: "4px",
                  marginBottom: "16px",
                  fontSize: "13px",
                }}
              >
                {participantModalError}
              </div>
            )}

            <form onSubmit={handleCreateParticipant}>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                  Registration ID <span style={{ fontSize: "11px", color: "var(--color-slate)", fontWeight: 400 }}>(Optional - auto-generated)</span>
                </label>
                <input
                  type="text"
                  value={newPartRegId}
                  onChange={(e) => setNewPartRegId(e.target.value)}
                  placeholder="Leave blank to auto-generate"
                  disabled={submittingParticipant}
                />
                <div style={{ fontSize: "11px", color: "var(--color-slate)", marginTop: "4px" }}>
                  If provided, must be unique within this competition.
                </div>
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                  Full Name / Team Name
                </label>
                <input
                  type="text"
                  value={newPartName}
                  onChange={(e) => setNewPartName(e.target.value)}
                  placeholder="Student or Team Lead"
                  required
                  disabled={submittingParticipant}
                />
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  value={newPartEmail}
                  onChange={(e) => setNewPartEmail(e.target.value)}
                  placeholder="contact@team.edu"
                  disabled={submittingParticipant}
                />
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                  Assign to Panel
                </label>
                <select
                  value={newPartPanel}
                  onChange={(e) => setNewPartPanel(e.target.value)}
                  disabled={submittingParticipant || loading || panels.length === 0}
                >
                  <option value="">
                    {loading
                      ? "Loading available panels..."
                      : panels.length === 0
                        ? "No panels available yet"
                        : "-- No Panel (Unassigned) --"}
                  </option>
                  {!loading &&
                    panels.map((p) => (
                      <option key={p._id} value={p._id} disabled={!p.isActive}>
                        {p.name}
                        {p.isActive ? "" : " (Inactive)"}
                      </option>
                    ))}
                </select>
                <div style={{ fontSize: "11px", color: "var(--color-slate)", marginTop: "4px" }}>
                  {loading
                    ? "Loading evaluation panels for this competition."
                    : panels.length === 0
                      ? "Create an evaluation panel first, then assign this participant to it."
                      : "Only active panels can receive new participant assignments."}
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setParticipantModalError(null);
                    setShowCreateParticipant(false);
                  }}
                  disabled={submittingParticipant}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-gold" disabled={submittingParticipant}>
                  {submittingParticipant ? "Registering..." : "Register Participant"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE PARAMETER */}
      {showCreateParam && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h3 style={{ marginBottom: "16px" }}>Add Dynamic Evaluation Criterion</h3>
            <form onSubmit={handleCreateParameter}>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                  Criterion Title
                </label>
                <input
                  type="text"
                  value={newParamName}
                  onChange={(e) => setNewParamName(e.target.value)}
                  placeholder="e.g. Architecture & Security"
                  required
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                    Maximum Marks
                  </label>
                  <input
                    type="number"
                    value={newParamMax}
                    onChange={(e) => setNewParamMax(Number(e.target.value))}
                    min={1}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                    Weightage Multiplier
                  </label>
                  <input
                    type="number"
                    value={newParamWeight}
                    onChange={(e) => setNewParamWeight(Number(e.target.value))}
                    min={0}
                    step={0.1}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                    Tie-break Priority (1 = highest)
                  </label>
                  <input
                    type="number"
                    value={newParamPriority}
                    onChange={(e) => setNewParamPriority(e.target.value)}
                    min={1}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                  Applicable Rounds
                </label>
                <div style={{ display: "flex", gap: "16px", marginTop: "6px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px" }}>
                    <input
                      type="checkbox"
                      checked={newParamRounds.includes(1)}
                      onChange={(e) =>
                        setNewParamRounds(
                          e.target.checked
                            ? [...newParamRounds, 1]
                            : newParamRounds.filter((r) => r !== 1),
                        )
                      }
                      style={{ width: "auto" }}
                    />
                    Round 1
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px" }}>
                    <input
                      type="checkbox"
                      checked={newParamRounds.includes(2)}
                      onChange={(e) =>
                        setNewParamRounds(
                          e.target.checked
                            ? [...newParamRounds, 2]
                            : newParamRounds.filter((r) => r !== 2),
                        )
                      }
                      style={{ width: "auto" }}
                    />
                    Round 2
                  </label>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateParam(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-gold">
                  Add Criterion
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RUN QUALIFICATION ENGINE */}
      {showQualifyModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h3 style={{ marginBottom: "16px" }}>Run Round 2 Qualification</h3>
            <form onSubmit={handleQualifyRound2}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                  Qualification Rule
                </label>
                <select
                  value={qualifyMethod}
                  onChange={(e) => setQualifyMethod(e.target.value as any)}
                >
                  <option value="topN">Top N Ranked Participants</option>
                  <option value="cutoffScore">Minimum Normalized Cutoff Score (%)</option>
                </select>
              </div>

              {qualifyMethod === "topN" ? (
                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                    Number of Top Qualifiers (N)
                  </label>
                  <input
                    type="number"
                    value={qualifyTopN}
                    onChange={(e) => setQualifyTopN(Number(e.target.value))}
                    min={1}
                    required
                  />
                </div>
              ) : (
                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                    Minimum Score (%) Cutoff
                  </label>
                  <input
                    type="number"
                    value={qualifyCutoff}
                    onChange={(e) => setQualifyCutoff(Number(e.target.value))}
                    min={0}
                    max={100}
                    required
                  />
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowQualifyModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-gold">
                  Qualify Participants
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PARAMETER-WISE PARTICIPANT MARKS */}
      {marksParticipant && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: "960px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "16px",
                marginBottom: "16px",
              }}
            >
              <div>
                <h3 style={{ marginBottom: "4px" }}>
                  Evaluation Marks — {marksParticipant.name}
                </h3>
                <div style={{ fontSize: "13px", color: "var(--color-slate)" }}>
                  {marksParticipant.registrationId}
                  {evaluationDetails?.participant.panelName
                    ? ` • ${evaluationDetails.participant.panelName}`
                    : ""}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeEvaluationDetails}
              >
                Close
              </button>
            </div>

            {evaluationDetailsLoading && (
              <div style={{ padding: "24px", textAlign: "center", color: "var(--color-slate)" }}>
                Loading parameter-wise marks...
              </div>
            )}

            {evaluationDetailsError && (
              <div
                style={{
                  padding: "10px 14px",
                  background: "var(--color-danger-bg)",
                  color: "var(--color-danger)",
                  border: "1px solid rgba(142, 46, 46, 0.2)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "13px",
                  marginBottom: "16px",
                }}
              >
                {evaluationDetailsError}
              </div>
            )}

            {evaluationDetails && (
              <div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                    gap: "12px",
                    padding: "16px",
                    background: "var(--color-surface-muted, #F4F6F8)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-sm)",
                    marginBottom: "14px",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "12px", color: "var(--color-slate)" }}>
                      Student submitted total
                    </div>
                    <div style={{ fontSize: "20px", fontWeight: 700 }}>
                      {evaluationDetails.overall.submittedTotalMarks === null
                        ? "Not evaluated"
                        : formatScore(evaluationDetails.overall.submittedTotalMarks)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "12px", color: "var(--color-slate)" }}>
                      Maximum possible (evaluated rounds)
                    </div>
                    <div style={{ fontSize: "20px", fontWeight: 700 }}>
                      {evaluationDetails.overall.evaluatedRounds.length > 0
                        ? formatScore(evaluationDetails.overall.maxPossibleMarks)
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "12px", color: "var(--color-slate)" }}>
                      Evaluated rounds
                    </div>
                    <div style={{ fontSize: "20px", fontWeight: 700 }}>
                      {evaluationDetails.overall.evaluatedRounds.length > 0
                        ? evaluationDetails.overall.evaluatedRounds
                            .map((round) => `Round ${round}`)
                            .join(", ")
                        : "None"}
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: "12px", color: "var(--color-slate)", marginBottom: "16px" }}>
                  Totals include submitted evaluations only. Draft marks and unrecorded
                  criteria are shown below but excluded from the submitted total.
                </p>

                {evaluationDetails.rounds.map((round) => (
                  <div
                    key={round.round}
                    style={{
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-sm)",
                      padding: "16px",
                      marginBottom: "16px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "12px",
                        flexWrap: "wrap",
                        marginBottom: "12px",
                      }}
                    >
                      <h4 style={{ fontSize: "16px" }}>Round {round.round}</h4>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            padding: "3px 8px",
                            borderRadius: "999px",
                            background: "#EEF2F6",
                            color: "var(--color-slate)",
                            textTransform: "capitalize",
                          }}
                        >
                          Round {round.roundStatus}
                        </span>
                        <span
                          style={{
                            fontSize: "11px",
                            padding: "3px 8px",
                            borderRadius: "999px",
                            background:
                              round.status === "complete"
                                ? "var(--color-success-bg)"
                                : round.status === "in_progress"
                                  ? "#FFF4DB"
                                  : "#EEF2F6",
                            color:
                              round.status === "complete"
                                ? "var(--color-success)"
                                : round.status === "in_progress"
                                  ? "#8A5A00"
                                  : "var(--color-slate)",
                            fontWeight: 600,
                          }}
                        >
                          {evaluationRoundStatusLabels[round.status]}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                        gap: "10px",
                        fontSize: "13px",
                        marginBottom: "12px",
                      }}
                    >
                      <div>
                        <span style={{ color: "var(--color-slate)" }}>Submitted: </span>
                        <strong>{round.submittedEvaluationCount}</strong>
                      </div>
                      <div>
                        <span style={{ color: "var(--color-slate)" }}>Drafts: </span>
                        <strong>{round.draftEvaluationCount}</strong>
                      </div>
                      <div>
                        <span style={{ color: "var(--color-slate)" }}>Configured criteria: </span>
                        <strong>{round.configuredCriteria.length}</strong>
                      </div>
                      <div>
                        <span style={{ color: "var(--color-slate)" }}>Submitted total: </span>
                        <strong>
                          {round.submittedTotalMarks === null
                            ? "Not evaluated"
                            : formatMarkPair(
                                round.submittedTotalMarks,
                                round.maxPossibleMarks,
                              )}
                        </strong>
                      </div>
                    </div>

                    {round.evaluations.length === 0 ? (
                      <div>
                        <div
                          style={{
                            fontSize: "13px",
                            color: "var(--color-slate)",
                            marginBottom: "8px",
                          }}
                        >
                          No evaluations recorded for this round.
                        </div>
                        {round.configuredCriteria.length > 0 && (
                          <table>
                            <thead>
                              <tr>
                                <th>Criterion</th>
                                <th>Marks</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {round.configuredCriteria.map((criterion) => (
                                <tr key={criterion.parameterId}>
                                  <td>
                                    {criterion.parameterName}
                                    {criterion.isActive ? "" : " (Inactive)"}
                                  </td>
                                  <td>{formatMarkPair(null, criterion.maxMarks)}</td>
                                  <td>Not evaluated</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    ) : (
                      round.evaluations.map((evaluation) => (
                        <div
                          key={evaluation.evaluationId}
                          style={{
                            borderTop: "1px solid var(--color-border)",
                            paddingTop: "12px",
                            marginTop: "12px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: "10px",
                              flexWrap: "wrap",
                              marginBottom: "8px",
                            }}
                          >
                            <div style={{ fontWeight: 600 }}>
                              {evaluation.judgeName}
                              {evaluation.judgeEmail ? (
                                <span
                                  style={{
                                    marginLeft: "8px",
                                    fontSize: "12px",
                                    fontWeight: 400,
                                    color: "var(--color-slate)",
                                  }}
                                >
                                  {evaluation.judgeEmail}
                                </span>
                              ) : null}
                            </div>
                            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                              <span
                                style={{
                                  fontSize: "11px",
                                  padding: "3px 8px",
                                  borderRadius: "999px",
                                  background:
                                    evaluation.status === "submitted"
                                      ? "var(--color-success-bg)"
                                      : "#FFF4DB",
                                  color:
                                    evaluation.status === "submitted"
                                      ? "var(--color-success)"
                                      : "#8A5A00",
                                  fontWeight: 600,
                                }}
                              >
                                {evaluation.status === "submitted" ? "Submitted" : "Draft"}
                              </span>
                              <span style={{ fontSize: "11px", color: "var(--color-slate)" }}>
                                {evaluation.submittedAt
                                  ? new Date(evaluation.submittedAt).toLocaleString()
                                  : evaluation.updatedAt
                                    ? `Last saved ${new Date(evaluation.updatedAt).toLocaleString()}`
                                    : "Not submitted"}
                              </span>
                            </div>
                          </div>

                          <table>
                            <thead>
                              <tr>
                                <th>Criterion</th>
                                <th>Marks</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {evaluation.criteria.map((criterion) => (
                                <tr key={criterion.parameterId}>
                                  <td>
                                    {criterion.parameterName}
                                    {criterion.source === "snapshot" ? (
                                      <span
                                        style={{
                                          marginLeft: "6px",
                                          fontSize: "11px",
                                          color: "var(--color-slate)",
                                        }}
                                      >
                                        (snapshot)
                                      </span>
                                    ) : null}
                                  </td>
                                  <td>
                                    {formatMarkPair(
                                      criterion.awardedMarks,
                                      criterion.maxMarks,
                                    )}
                                  </td>
                                  <td>
                                    {criterion.isEvaluated ? "Recorded" : "Not evaluated"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>

                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: "12px",
                              flexWrap: "wrap",
                              marginTop: "8px",
                              fontSize: "13px",
                            }}
                          >
                            <span>
                              {evaluation.status === "draft"
                                ? "Draft recorded total: "
                                : "Evaluation total: "}
                              <strong>
                                {formatMarkPair(
                                  evaluation.recordedTotalMarks,
                                  evaluation.maxPossibleMarks,
                                )}
                              </strong>
                            </span>
                            <span
                              style={{
                                color:
                                  evaluation.missingCriterionCount > 0
                                    ? "#8A5A00"
                                    : "var(--color-slate)",
                              }}
                            >
                              {evaluation.missingCriterionCount > 0
                                ? `${evaluation.missingCriterionCount} criterion/criteria not evaluated`
                                : "All criteria recorded"}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
