import React, { useEffect, useState } from "react";
import { KARVAANLogo } from "../../components/common/KARVAANLogo";
import { api } from "../../services/api";
import type {
  Competition,
  EvaluationParameter,
  Panel,
  Participant,
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

export const AdminDashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>("competitions");
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>("");
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);

  const [panels, setPanels] = useState<Panel[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [parameters, setParameters] = useState<EvaluationParameter[]>([]);
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

  // Form states
  const [newCompName, setNewCompName] = useState("");
  const [newCompDesc, setNewCompDesc] = useState("");

  const [newPanelName, setNewPanelName] = useState("");
  const [newPanelDesc, setNewPanelDesc] = useState("");
  const [newPanelJudges, setNewPanelJudges] = useState<string[]>([]);

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

  useEffect(() => {
    loadCompetitions();
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
    try {
      await api.provisionUser({
        name: newJudgeName,
        email: newJudgeEmail,
        password: newJudgePassword,
        role: "judge",
      });
      notifySuccess(`Judge account for '${newJudgeName}' created successfully.`);
      setNewJudgeName("");
      setNewJudgeEmail("");
      setNewJudgePassword("");
      setShowCreateJudge(false);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleCreatePanel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompetitionId) return;
    try {
      await api.createPanel(selectedCompetitionId, {
        name: newPanelName,
        description: newPanelDesc,
        judges: newPanelJudges,
      });
      notifySuccess(`Panel '${newPanelName}' created successfully`);
      setNewPanelName("");
      setNewPanelDesc("");
      setNewPanelJudges([]);
      setShowCreatePanel(false);
      loadCompetitionData(selectedCompetitionId);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleCreateParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompetitionId) return;
    try {
      await api.createParticipant(selectedCompetitionId, {
        name: newPartName,
        registrationId: newPartRegId,
        email: newPartEmail || undefined,
        panel: newPartPanel || undefined,
      });
      notifySuccess(`Participant '${newPartName}' registered`);
      setNewPartName("");
      setNewPartRegId("");
      setNewPartEmail("");
      setNewPartPanel("");
      setShowCreateParticipant(false);
      loadCompetitionData(selectedCompetitionId);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleCreateParameter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompetitionId) return;
    try {
      await api.createParameter(selectedCompetitionId, {
        name: newParamName,
        description: newParamDesc,
        maxMarks: Number(newParamMax),
        weightage: Number(newParamWeight),
        applicableRounds: newParamRounds,
      });
      notifySuccess(`Evaluation criterion '${newParamName}' created`);
      setNewParamName("");
      setNewParamDesc("");
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
          <KARVAANLogo size="sm" variant="light" showTagline={true} />
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
              onClick={() => setShowCreateJudge(true)}
            >
              + Provision Judge
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
              <button
                className="btn btn-gold"
                onClick={() => setShowCreatePanel(true)}
              >
                + Create Panel
              </button>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Panel Name</th>
                    <th>Description</th>
                    <th>Assigned Judges</th>
                    <th>Status</th>
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
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", padding: "24px" }}>
                        No panels created for this competition yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
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
                onClick={() => setShowCreateParticipant(true)}
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
                      const panelName =
                        typeof part.panel === "object" && part.panel
                          ? part.panel.name
                          : "Unassigned";

                      return (
                        <tr key={part._id}>
                          <td style={{ fontFamily: "monospace", fontWeight: 700 }}>
                            {part.registrationId}
                          </td>
                          <td style={{ fontWeight: 600 }}>{part.name}</td>
                          <td>{panelName}</td>
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
                            <span style={{ fontSize: "12px", color: "var(--color-slate)" }}>
                              {part.isActive ? "Active" : "Deactivated"}
                            </span>
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
                    <th>Max Marks</th>
                    <th>Weightage</th>
                    <th>Applicable Rounds</th>
                    <th>Version</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parameters.length > 0 ? (
                    parameters.map((param) => (
                      <tr key={param._id}>
                        <td style={{ fontWeight: 600 }}>{param.name}</td>
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
                      <td colSpan={6} style={{ textAlign: "center", padding: "24px" }}>
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
                  placeholder="e.g. KARVAAN 2026 Tech Summit"
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
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateJudge(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-gold">
                  Provision Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE PANEL */}
      {showCreatePanel && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h3 style={{ marginBottom: "16px" }}>Create Evaluation Panel</h3>
            <form onSubmit={handleCreatePanel}>
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
                />
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                  Description
                </label>
                <input
                  type="text"
                  value={newPanelDesc}
                  onChange={(e) => setNewPanelDesc(e.target.value)}
                  placeholder="Focus areas..."
                />
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                  Judge ID(s) (comma-separated 24-character ObjectIds)
                </label>
                <input
                  type="text"
                  onChange={(e) =>
                    setNewPanelJudges(
                      e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    )
                  }
                  placeholder="e.g. 6ad90b62ebbc07ae63a150a8"
                  required
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreatePanel(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-gold">
                  Create Panel
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
            <h3 style={{ marginBottom: "16px" }}>Register Participant</h3>
            <form onSubmit={handleCreateParticipant}>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                  Registration ID
                </label>
                <input
                  type="text"
                  value={newPartRegId}
                  onChange={(e) => setNewPartRegId(e.target.value)}
                  placeholder="e.g. KVN-2026-101"
                  required
                />
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
                />
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                  Assign to Panel
                </label>
                <select
                  value={newPartPanel}
                  onChange={(e) => setNewPartPanel(e.target.value)}
                >
                  <option value="">-- No Panel (Unassigned) --</option>
                  {panels.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateParticipant(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-gold">
                  Register
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
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
    </div>
  );
};
